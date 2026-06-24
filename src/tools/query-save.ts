import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorResponse, validResponse } from "../helpers";
import { validateSave } from "../saves";
import { cdbToSql } from "cdb-converter";
import initSqlJs from "sql.js";
import { readFileSync } from "node:fs";

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

/**
 * Reject anything that isn't a single read-only `SELECT`/`WITH` statement.
 * The save is loaded into an in-memory sql.js database (changes are never
 * written back to disk), but we still enforce read-only intent defensively.
 */
function assertReadOnlyQuery(rawQuery: string): string {
	// Strip a single trailing semicolon, then reject any further statement
	// separators to prevent stacked statements.
	const query = rawQuery.trim().replace(/;\s*$/, "");

	if (query.length === 0) {
		throw new Error("Query is empty.");
	}

	if (query.includes(";")) {
		throw new Error(
			"Only a single statement is allowed — remove extra semicolons.",
		);
	}

	if (!/^(select|with)\b/i.test(query)) {
		throw new Error(
			"Only read-only SELECT (or WITH … SELECT) queries are allowed.",
		);
	}

	// Defense in depth: reject statements that could mutate or attach data.
	const forbidden =
		/\b(insert|update|delete|drop|create|alter|replace|attach|detach|reindex|vacuum|pragma|truncate)\b/i;
	const match = forbidden.exec(query);
	if (match) {
		throw new Error(
			`Write/DDL keyword "${match[0].toUpperCase()}" is not allowed — this tool is read-only.`,
		);
	}

	return query;
}

export function registerQuerySave(server: McpServer): void {
	server.registerTool(
		"query_save",
		{
			title: "Query PCM save (read-only)",
			description:
				"Run a read-only SQL query against any table in a Pro Cycling Manager `.cdb` save file. Only a single SELECT (or WITH … SELECT) statement is allowed; write/DDL statements are rejected and the save is never modified. Results are capped (default 100, max 1000 rows). Use `get_save_info` to discover table names and `get_table_info` to inspect their columns.",
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
		},
		async ({ savePath, query, limit }) => {
			let db: ReturnType<typeof cdbToSql> | undefined;
			try {
				const save = await validateSave(savePath);
				const safeQuery = assertReadOnlyQuery(query);
				const effectiveLimit = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);

				const SQL = await initSqlJs();
				const cdbBuffer = readFileSync(save.path);
				db = cdbToSql(cdbBuffer, SQL);

				// Fetch one extra row to detect truncation.
				const stmt = db.prepare(safeQuery);
				const columns = stmt.getColumnNames();
				const rows: Record<string, unknown>[] = [];
				let truncated = false;

				while (stmt.step()) {
					if (rows.length >= effectiveLimit) {
						truncated = true;
						break;
					}
					rows.push(stmt.getAsObject());
				}
				stmt.free();

				const output: z.infer<typeof outputSchema> = {
					columns,
					rows,
					rowCount: rows.length,
					limit: effectiveLimit,
					truncated,
				};

				return validResponse(output);
			} catch (error) {
				return errorResponse(String(error));
			} finally {
				db?.close();
			}
		},
	);
}
