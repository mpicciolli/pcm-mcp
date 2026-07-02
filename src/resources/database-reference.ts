import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DATABASE_REFERENCE, DATABASE_REFERENCE_URI } from "../reference";

export function registerDatabaseResource(server: McpServer): void {
	server.registerResource(
		"pcm-database-reference",
		DATABASE_REFERENCE_URI,
		{
			title: "PCM save database reference",
			description:
				"Conventions for querying a PCM `.cdb` save: table prefixes (DYN_/STA_/GAM_), column typing, foreign keys, and display columns.",
			mimeType: "text/markdown",
		},
		async (uri) => ({
			contents: [
				{
					uri: uri.href,
					mimeType: "text/markdown",
					text: DATABASE_REFERENCE,
				},
			],
		}),
	);
}
