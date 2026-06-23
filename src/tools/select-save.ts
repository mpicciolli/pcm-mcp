import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorResponse, validResponse } from "../helpers";
import { validateSave } from "../saves";

const outputSchema = z.object({
	path: z.string().describe("Absolute path to the .cdb save file"),
	name: z.string().describe("File name, e.g. `MyCareer.cdb`"),
	lastModified: z
		.string()
		.describe(
			"Last modified timestamp in ISO 8601 format, e.g. `2024-06-01T12:34:56.789Z`",
		),
	sizeBytes: z.number().describe("File size in bytes"),
});

export function registerSelectSave(server: McpServer): void {
	server.registerTool(
		"select_save",
		{
			title: "Select PCM save",
			description:
				"Validate that an absolute path points to an existing Pro Cycling Manager `.cdb` save file and return its metadata. Stateless: nothing is stored — keep the returned path in conversation context to pass to later tools.",
			inputSchema: {
				savePath: z.string().describe("Absolute path to the .cdb save file"),
			},
			outputSchema,
		},
		async ({ savePath }) => {
			try {
				const save = await validateSave(savePath);

				const output: z.infer<typeof outputSchema> = {
					...save,
				};

				return validResponse(output);
			} catch (error) {
				return errorResponse(String(error));
			}
		},
	);
}
