import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorResponse, validResponse } from "../helpers";
import { validateSave } from "../saves";
import { cdbToSql } from "cdb-converter";
import initSqlJs from "sql.js";
import { readFileSync } from "node:fs";

const outputSchema = z.object({
	tables: z
		.array(
			z.object({
				id: z.number().describe("Table ID"),
				name: z.string().describe("Table name"),
			}),
		)
		.describe("Tables in the .cdb save file"),
	tableCount: z.number().describe("Number of tables in the .cdb save file"),
});

export function registerGetSaveInfo(server: McpServer): void {
	server.registerTool(
		"get_save_info",
		{
			title: "Get PCM save info",
			description: "",
			inputSchema: {
				savePath: z.string().describe("Absolute path to the .cdb save file"),
			},
			outputSchema,
		},
		async ({ savePath }) => {
			let db: ReturnType<typeof cdbToSql> | undefined;
			try {
				const save = await validateSave(savePath);

				const SQL = await initSqlJs();

				const cdbBuffer = readFileSync(save.path);

				db = cdbToSql(cdbBuffer, SQL);

				const results = db.exec("SELECT * FROM DB_STRUCTURE");

				const rows = results[0]?.values ?? [];

				console.error(rows);

				const tables = rows.map((row) => ({
					id: Number(row[1]),
					name: String(row[0]),
				}));

				console.error(tables);

				const output: z.infer<typeof outputSchema> = {
					tables,
					tableCount: tables.length,
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
