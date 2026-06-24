import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListSaves } from "./list-saves.js";
import { registerSelectSave } from "./select-save.js";
import { registerGetSaveInfo } from "./get-save-info.js";
import { registerGetTableInfo } from "./get-table-info.js";
import { registerGetPlayerInfo } from "./get-player-info.js";
import { registerQuerySave } from "./query-save.js";

export function registerTools(server: McpServer): void {
	registerListSaves(server);
	registerSelectSave(server);
	registerGetSaveInfo(server);
	registerGetTableInfo(server);
	registerGetPlayerInfo(server);
	registerQuerySave(server);
}
