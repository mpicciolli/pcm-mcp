import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { explainQueryError } from "../helpers";
import { withSaveDb, writeSaveDb } from "../save-db";

const outputSchema = z.object({
	outputPath: z
		.string()
		.describe("Absolute path of the modified .cdb save that was written"),
	rowsModified: z
		.number()
		.describe("Number of rows changed by the statement (INSERT/UPDATE/DELETE)"),
	statement: z
		.string()
		.describe("The normalized statement that was executed"),
});

export function registerUpdateSave(server: McpServer): void {
	server.registerTool(
		"pcm_update_save",
		{
			title: "Update PCM save (writes a new .cdb)",
			description:
				"Run a single write statement (INSERT, UPDATE or DELETE) against a Pro Cycling Manager `.cdb` save and write the result to a NEW `.cdb` file. The source save is never modified: the edited database is serialized to `outputPath`, which must differ from `savePath`. Only one data-mutating statement is allowed; SELECT, schema changes (DROP/CREATE/ALTER) and stacked statements are rejected. Use `pcm_query_save` to read, and `pcm_get_save_schema`/`pcm_get_table_schema` to discover tables and columns.",
			inputSchema: {
				savePath: z
					.string()
					.describe("Absolute path to the source .cdb save file"),
				outputPath: z
					.string()
					.describe(
						"Absolute path of the .cdb file to write the modified save to (must differ from savePath)",
					),
				statement: z
					.string()
					.describe(
						"A single write statement, e.g. `UPDATE DYN_cyclist SET gene_sprint = 80 WHERE IDcyclist = 42`",
					),
			},
			outputSchema,
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
				idempotentHint: false,
				openWorldHint: false,
			},
		},
		async ({ savePath, outputPath, statement }) =>
			withSaveDb(
				savePath,
				async (db, save) => {
					const safe = assertWriteStatement(statement);

					try {
						db.run(safe);
					} catch (error) {
						throw explainQueryError(error);
					}

					const rowsModified = db.getRowsModified();
					const written = await writeSaveDb(db, outputPath, save.path);

					const output: z.infer<typeof outputSchema> = {
						outputPath: written,
						rowsModified,
						statement: safe,
					};
					return output;
				},
				{ queryOnly: false },
			),
	);
}

/**
 * Enforce that a statement is a single data-mutating write.
 *
 * Uses an opener whitelist (`INSERT`/`UPDATE`/`DELETE`) rather than a keyword
 * blocklist:
 *  - it rejects reads (`SELECT`/`WITH`) — those belong to `pcm_query_save`, and
 *  - it rejects DDL (`DROP`/`CREATE`/`ALTER`/`PRAGMA`/…), which would alter the
 *    schema and break the `sqlToCdb` round-trip (it needs the table structure /
 *    `DB_STRUCTURE` intact to re-encode the `.cdb`).
 *
 * Stacked statements are rejected too (only the first would run anyway, and
 * banning the extra `;` also shuts out `ATTACH`/`DETACH`, which must stand
 * alone).
 */
export function assertWriteStatement(rawStatement: string): string {
	// Strip a single trailing semicolon, then reject any further statement
	// separators to prevent stacked statements.
	const statement = rawStatement.trim().replace(/;\s*$/, "");

	if (statement.length === 0) {
		throw new Error("Statement is empty.");
	}

	if (statement.includes(";")) {
		throw new Error(
			"Only a single statement is allowed — remove extra semicolons.",
		);
	}

	if (!/^(insert|update|delete)\b/i.test(statement)) {
		throw new Error(
			"Only a single INSERT, UPDATE or DELETE statement is allowed. " +
				"Use pcm_query_save to read; schema changes (DROP/CREATE/ALTER) are not supported.",
		);
	}

	return statement;
}
