import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListSaves } from "./list-saves";
import { registerSelectSave } from "./select-save";
import { registerGetSaveSchema } from "./get-save-schema";
import { registerGetTableSchema } from "./get-table-schema";
import { registerGetPlayerInfo } from "./get-player-info";
import { registerGetTeamRoster } from "./get-team-roster";
import { registerQuerySave } from "./query-save";
import { registerUpdateSave } from "./update-save";
import { registerSearchCyclist } from "./search-cyclist";
import { registerGenerateStartlistXml } from "./generate-startlist-xml";
import { registerSearchTeam } from "./search-team";

export function registerTools(server: McpServer): void {
	registerListSaves(server);
	registerSelectSave(server);
	registerGetSaveSchema(server);
	registerGetTableSchema(server);
	registerGetPlayerInfo(server);
	registerGetTeamRoster(server);
	registerQuerySave(server);
	registerUpdateSave(server);
	registerSearchCyclist(server);
	registerGenerateStartlistXml(server);
	registerSearchTeam(server);
}
