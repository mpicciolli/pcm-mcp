import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListSaves } from "./list-saves.js";
import { registerSelectSave } from "./select-save.js";

export function registerTools(server: McpServer): void {
	registerListSaves(server);
	registerSelectSave(server);
}
