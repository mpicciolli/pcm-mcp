import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListSaves } from "./list-saves";
import { registerSelectSave } from "./select-save";
import { registerGetSaveInfo } from "./get-save-info";
import { registerGetTableInfo } from "./get-table-info";
import { registerGetPlayerInfo } from "./get-player-info";
import { registerQuerySave } from "./query-save";

export function registerTools(server: McpServer): void {
	registerListSaves(server);
	registerSelectSave(server);
	registerGetSaveInfo(server);
	registerGetTableInfo(server);
	registerGetPlayerInfo(server);
	registerQuerySave(server);
}
