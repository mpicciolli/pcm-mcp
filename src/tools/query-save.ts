import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DATABASE_REFERENCE_URI } from "../reference";
import { explainQueryError, parseSingleStatement } from "../helpers";
import { withSaveDb } from "../save-db";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

/**
 * A condensed save-schema cheatsheet kept in the tool description (returned on
 * every turn) so the model can write correct joins without an extra lookup.
 * Deliberately short — the full reference (FK exceptions, examples) lives in the
 * `pcm://docs/database` resource; keep this in sync with `DATABASE.md`.
 */
const SCHEMA_CHEATSHEET = `## Save schema cheatsheet
Full reference: read the \`${DATABASE_REFERENCE_URI}\` resource.
- **Table prefixes**: \`DYN_\` = mutable career data (\`DYN_cyclist\`, \`DYN_team\`, \`DYN_contract_cyclist\`); \`STA_\` = static lookups/enums (\`STA_country\`, \`STA_race\`, \`STA_type_rider\`); \`GAM_\` = session/player state; \`DB_STRUCTURE\` lists every table.
- **Column type by prefix**: \`_i_\`/\`fkID\`/\`ID\` = INTEGER, \`_sz_\` = TEXT, \`_f_\` = REAL, \`_b_\` = boolean, \`_ilist_\` = serialized int list. Declared types carry a numeric offset (e.g. \`INTEGER 499717\`) — match on affinity, not equality.
- **Foreign keys**: \`fkID{Suffix}\` → \`{DYN|STA|GAM}_{Suffix}\`, joined on the target's \`ID{Suffix}\`. The suffix is semantic — watch exceptions (\`fkIDteam_duplicate\` → \`DYN_team.IDteam\`; \`fkIDnextdivision\` → \`STA_division.IDdivision\`).
- **Display labels**: \`DYN_*\` use \`gene_sz_name\`; \`STA_*\` usually key off \`CONSTANT\` (enum string), with exceptions like \`STA_country.gene_sz_flag\`. \`gene_strID_*\` are string-table indices, not labels.`;

function buildDescription(): string {
	const base =
		"Run a read-only SQL query against any table in a Pro Cycling Manager `.cdb` save file. Only a single SELECT (or WITH … SELECT) statement is allowed; write/DDL statements are rejected and the save is never modified. Results are capped (default 100, max 1000 rows). Use `pcm_get_save_schema` to discover table names and `pcm_get_table_schema` to inspect their columns.";

	return `${base}\n\n${SCHEMA_CHEATSHEET}`;
}

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
			description: buildDescription(),
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
 * Enforce that a query is a single read-only statement.
 *
 * Parsing is delegated to {@link parseSingleStatement}, so a `;` inside a string
 * literal, comment or quoted identifier is not mistaken for a statement
 * separator. CTEs are classified by their leaf operation, so `WITH … SELECT`
 * reads (`LISTING`) while `WITH … DELETE` writes (`MODIFICATION`) — only the
 * former is accepted. `PRAGMA query_only = ON` (see {@link withSaveDb}) stays as
 * the engine-level backstop.
 */
export function assertReadOnlyQuery(rawQuery: string): string {
	const { text, statement } = parseSingleStatement(rawQuery, "Query");

	if (statement.executionType !== "LISTING") {
		throw new Error(
			"Only read-only SELECT (or WITH … SELECT) queries are allowed.",
		);
	}

	return text;
}
