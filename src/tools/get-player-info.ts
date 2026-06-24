import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { errorResponse, validResponse } from "../helpers";
import { validateSave } from "../saves";
import { cdbToSql } from "cdb-converter";
import initSqlJs from "sql.js";
import { readFileSync } from "node:fs";

const outputSchema = z.object({
	login: z.string().describe("Player login (game_sz_login)"),
	teamId: z.number().describe("Team ID (IDteam)"),
	teamName: z.string().describe("Team name (gene_sz_name)"),
	teamShortName: z.string().describe("Team short name (gene_sz_shortname)"),
	division: z.number().describe("Current division (fkIDdivision)"),
	nextDivision: z.number().describe("Next division (fkIDnextdivision)"),
	country: z.number().describe("Country ID (fkIDcountry)"),
	evaluation: z
		.number()
		.describe("Team current evaluation (value_f_current_evaluation)"),
	manager: z.string().describe("General manager name (gene_sz_manager_general)"),
});

export function registerGetPlayerInfo(server: McpServer): void {
	server.registerTool(
		"get_player_info",
		{
			title: "Get PCM player info",
			description:
				"Get the active human player and their team from a Pro Cycling Manager `.cdb` save file. Joins GAM_user (game_i_active = 1) with DYN_team on fkIDteam_duplicate = IDteam and returns the player login plus team details (name, division, country, evaluation and manager).",
			inputSchema: {
				savePath: z.string().describe("Absolute path to the .cdb save file"),
			},
			outputSchema,
		},
		async ({ savePath }) => {
			try {
				const save = await validateSave(savePath);

				const SQL = await initSqlJs();

				const cdbBuffer = readFileSync(save.path);

				const db = cdbToSql(cdbBuffer, SQL);

				const stmt = db.prepare(
					`SELECT
						u.game_sz_login AS login,
						t.IDteam AS teamId,
						t.gene_sz_name AS teamName,
						t.gene_sz_shortname AS teamShortName,
						t.fkIDdivision AS division,
						t.fkIDnextdivision AS nextDivision,
						t.fkIDcountry AS country,
						t.value_f_current_evaluation AS evaluation,
						t.gene_sz_manager_general AS manager
					FROM GAM_user u
					JOIN DYN_team t ON u.fkIDteam_duplicate = t.IDteam
					WHERE u.game_i_active = 1`,
				);

				if (!stmt.step()) {
					stmt.free();
					throw new Error(
						`No active player (game_i_active = 1) found in ${save.name}.`,
					);
				}

				const row = stmt.getAsObject();
				stmt.free();

				const output: z.infer<typeof outputSchema> = {
					login: String(row.login),
					teamId: Number(row.teamId),
					teamName: String(row.teamName),
					teamShortName: String(row.teamShortName),
					division: Number(row.division),
					nextDivision: Number(row.nextDivision),
					country: Number(row.country),
					evaluation: Number(row.evaluation),
					manager: String(row.manager),
				};

				return validResponse(output);
			} catch (error) {
				return errorResponse(String(error));
			}
		},
	);
}
