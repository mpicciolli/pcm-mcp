import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDatabaseResource } from "./database-reference";

export function registerRessources(server: McpServer): void {
	registerDatabaseResource(server);
}
