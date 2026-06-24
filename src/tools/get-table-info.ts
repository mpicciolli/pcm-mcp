import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { withSaveDb } from "../save-db";

const outputSchema = z.object({
	name: z.string().describe("Table name"),
	rowCount: z.number().describe("Number of rows in the table"),
	columns: z
		.array(
			z.object({
				name: z.string().describe("Column name"),
				type: z.string().describe("Column SQL type"),
				notNull: z
					.boolean()
					.describe("Whether the column has a NOT NULL constraint"),
				primaryKey: z
					.boolean()
					.describe("Whether the column is part of the primary key"),
			}),
		)
		.describe("Columns (schema) of the table"),
	columnCount: z.number().describe("Number of columns in the table"),
});

export function registerGetTableInfo(server: McpServer): void {
	server.registerTool(
		"get_table_info",
		{
			title: "Get PCM table info",
			description:
				"Inspect a single table inside a Pro Cycling Manager `.cdb` save file by name. Returns the table's columns (name, SQL type, NOT NULL and primary key flags) and its row count. Use `get_save_info` first to discover available table names.",
			inputSchema: {
				savePath: z.string().describe("Absolute path to the .cdb save file"),
				tableName: z
					.string()
					.describe(
						"Name of the table to inspect, as listed by `get_save_info`",
					),
			},
			outputSchema,
		},
		async ({ savePath, tableName }) =>
			withSaveDb(savePath, (db, save) => {
				// Validate the table exists (and guard against SQL injection) by
				// matching the name against DB_STRUCTURE before interpolating it.
				// DB_STRUCTURE columns aren't named, so read by position: the table
				// name is the first column (see get_save_info).
				const structure = db.exec("SELECT * FROM DB_STRUCTURE");
				const knownTables = (structure[0]?.values ?? []).map((row) =>
					String(row[0]),
				);
				if (!knownTables.includes(tableName)) {
					throw new Error(
						`Table "${tableName}" not found in ${save.name}. Use get_save_info to list available tables.`,
					);
				}

				const columnInfo = db.exec(`PRAGMA table_info("${tableName}")`);
				const columnRows = columnInfo[0]?.values ?? [];

				// PRAGMA table_info columns: cid, name, type, notnull, dflt_value, pk
				const columns = columnRows.map((row) => ({
					name: String(row[1]),
					type: String(row[2]),
					notNull: Number(row[3]) === 1,
					primaryKey: Number(row[5]) > 0,
				}));

				const countResult = db.exec(`SELECT COUNT(*) FROM "${tableName}"`);
				const rowCount = Number(countResult[0]?.values?.[0]?.[0] ?? 0);

				const output: z.infer<typeof outputSchema> = {
					name: tableName,
					rowCount,
					columns,
					columnCount: columns.length,
				};

				return output;
			}),
	);
}
