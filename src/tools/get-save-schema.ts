import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { withSaveDb } from "../save-db";

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

export function registerGetSaveSchema(server: McpServer): void {
	server.registerTool(
		"get_save_schema",
		{
			title: "Get PCM save schema",
			description: "",
			inputSchema: {
				savePath: z.string().describe("Absolute path to the .cdb save file"),
			},
			outputSchema,
		},
		async ({ savePath }) =>
			withSaveDb(savePath, (db) => {
				const results = db.exec("SELECT * FROM DB_STRUCTURE");
				const rows = results[0]?.values ?? [];

				const tables = rows.map((row) => ({
					id: Number(row[1]),
					name: String(row[0]),
				}));

				const output: z.infer<typeof outputSchema> = {
					tables,
					tableCount: tables.length,
				};

				return output;
			}),
	);
}
