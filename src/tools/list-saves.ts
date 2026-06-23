import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorResponse, validResponse } from "../helpers";
import { listSaves } from "../saves";

const outputSchema = z.object({
	saves: z
		.array(
			z.object({
				path: z.string().describe("Absolute path to the .cdb save file"),
				name: z.string().describe("File name, e.g. `MyCareer.cdb`"),
				lastModified: z
					.string()
					.describe(
						"Last modified timestamp in ISO 8601 format, e.g. `2024-06-01T12:34:56.789Z`",
					),
				sizeBytes: z.number().describe("File size in bytes"),
			}),
		)
		.describe("Discovered `.cdb` save files, newest first"),
});

export function registerListSaves(server: McpServer): void {
	server.registerTool(
		"list_saves",
		{
			title: "List PCM saves",
			description:
				"Discover Pro Cycling Manager `.cdb` career save files on this machine by scanning the `Pro Cycling Manager <year>/Cloud` folders under %APPDATA% (Windows only). Returns each save's absolute path, file name, last modified date and size (newest first).",
			outputSchema,
		},
		async () => {
			try {
				const saves = await listSaves();

				const output: z.infer<typeof outputSchema> = {
					saves,
				};

				return validResponse(output);
			} catch (error) {
				return errorResponse(String(error));
			}
		},
	);
}
