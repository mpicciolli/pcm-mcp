import { readFileSync } from "node:fs";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerDatabaseResource } from "./resources/database";
import { registerTools } from "./tools/index";

const { version } = JSON.parse(
	readFileSync(join(__dirname, "../package.json"), "utf-8"),
) as { version: string };

const server = new McpServer({
	name: "pcm-mcp",
	version,
});

registerTools(server);
registerDatabaseResource(server);

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("PCM MCP Server running on stdio");
}

main().catch((error) => {
	console.error("Fatal error in main():", error);
	process.exit(1);
});
