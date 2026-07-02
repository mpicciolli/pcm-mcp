import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { identify } from "sql-query-identifier";
import { z } from "zod";
import { withSaveDb } from "../save-db";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

const outputSchema = z.object({
	columns: z.array(z.string()).describe("Column names returned by the query"),
	rows: z
		.array(z.record(z.string(), z.unknown()))
		.describe("Result rows, one object per row keyed by column name"),
	rowCount: z.number().describe("Number of rows returned"),
	limit: z.number().describe("Maximum number of rows applied to the query"),
	truncated: z
		.boolean()
		.describe("Whether the result was capped at `limit` rows"),
});

export function registerQuerySave(server: McpServer): void {
	server.registerTool(
		"pcm_query_save",
		{
			title: "Query PCM save (read-only)",
			description:
				"Run a read-only SQL query against any table in a Pro Cycling Manager `.cdb` save file. Only a single SELECT (or WITH … SELECT) statement is allowed; write/DDL statements are rejected and the save is never modified. Results are capped (default 100, max 1000 rows). Use `pcm_get_save_schema` to discover table names and `pcm_get_table_schema` to inspect their columns.",
			inputSchema: {
				savePath: z.string().describe("Absolute path to the .cdb save file"),
				query: z
					.string()
					.describe(
						"A single read-only SQL SELECT statement, e.g. `SELECT * FROM DYN_cyclist WHERE gene_sprint > 70`",
					),
				limit: z
					.number()
					.int()
					.positive()
					.max(MAX_LIMIT)
					.optional()
					.describe(
						`Maximum number of rows to return (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT})`,
					),
			},
			outputSchema,
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false,
			},
		},
		async ({ savePath, query, limit }) =>
			withSaveDb(savePath, (db) => {
				const safeQuery = assertReadOnlyQuery(query);
				const effectiveLimit = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);

				let stmt: ReturnType<typeof db.prepare> | undefined;
				let columns: string[] = [];
				const rows: Record<string, unknown>[] = [];
				let truncated = false;

				try {
					stmt = db.prepare(safeQuery);
					columns = stmt.getColumnNames();

					while (stmt.step()) {
						if (rows.length >= effectiveLimit) {
							truncated = true;
							break;
						}
						rows.push(stmt.getAsObject());
					}
				} catch (error) {
					throw explainQueryError(error);
				} finally {
					stmt?.free();
				}
				const output: z.infer<typeof outputSchema> = {
					columns,
					rows,
					rowCount: rows.length,
					limit: effectiveLimit,
					truncated,
				};

				return output;
			}),
	);
}

/**
 * Translate sql.js "no such table/column" errors into actionable messages that
 * point the caller at the schema-discovery tools. Other errors pass through.
 */
function explainQueryError(error: unknown): Error {
	const message = error instanceof Error ? error.message : String(error);

	const missingTable = /no such table:\s*(\S+)/i.exec(message);
	if (missingTable) {
		return new Error(
			`Table "${missingTable[1]}" does not exist in this save — use pcm_get_save_schema to list available tables.`,
		);
	}

	const missingColumn = /no such column:\s*(\S+)/i.exec(message);
	if (missingColumn) {
		return new Error(
			`Column "${missingColumn[1]}" does not exist — use pcm_get_table_schema to inspect the table's columns.`,
		);
	}

	// Raised by `PRAGMA query_only = ON` when a statement tries to write.
	if (/readonly database|not authorized/i.test(message)) {
		return new Error(
			"This tool is read-only — the query attempted to modify the save, which is not allowed.",
		);
	}

	return error instanceof Error ? error : new Error(message);
}

/**
 * Enforce that a query is a single read-only statement.
 *
 * Parsing is delegated to `sql-query-identifier`, which tokenizes SQL properly:
 * a `;` inside a string literal, comment or quoted identifier is not mistaken
 * for a statement separator, and CTEs are classified by their leaf operation —
 * `WITH … SELECT` reads (`LISTING`) while `WITH … DELETE` writes
 * (`MODIFICATION`). Anything that isn't exactly one `LISTING` statement is
 * rejected here; `PRAGMA query_only = ON` (see {@link withSaveDb}) stays as the
 * engine-level backstop.
 */
export function assertReadOnlyQuery(rawQuery: string): string {
	// Strip a single trailing semicolon so a normal `SELECT …;` is accepted;
	// the returned query is what gets prepared.
	const query = rawQuery.trim().replace(/;\s*$/, "");

	if (query.length === 0) {
		throw new Error("Query is empty.");
	}

	const statements = identify(query, { strict: false, dialect: "sqlite" });

	if (statements.length === 0) {
		throw new Error("Query is empty.");
	}

	if (statements.length > 1) {
		throw new Error(
			"Only a single statement is allowed — remove extra semicolons.",
		);
	}

	if (statements[0].executionType !== "LISTING") {
		throw new Error(
			"Only read-only SELECT (or WITH … SELECT) queries are allowed.",
		);
	}

	return query;
}
