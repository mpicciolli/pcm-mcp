import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { withSaveDb } from "../save-db";

const riderSchema = z.object({
	id: z.number().describe("Cyclist ID (IDcyclist)"),
	firstName: z.string().describe("First name (gene_sz_firstname)"),
	lastName: z.string().describe("Last name (gene_sz_lastname)"),
	age: z
		.number()
		.nullable()
		.describe(
			"Age in years, derived from gene_i_birthdate and the current game date (GAM_config.gene_i_date). Null when the birth date is missing.",
		),
	type: z
		.string()
		.nullable()
		.describe(
			"Rider type key (STA_type_rider.CONSTANT via fkIDtype_rider), e.g. sprint, mountain, tour, timetrial, flat, ardennaises, flandriennes. Null when unset.",
		),
	overall: z
		.number()
		.nullable()
		.describe(
			"Overall ability / note globale (value_f_current_ability) — null on saves that pre-date this column.",
		),
	contractEndYear: z
		.number()
		.nullable()
		.describe(
			"Year the active contract ends (DYN_contract_cyclist.iYearEnd). Null when no active contract is found.",
		),
	wage: z
		.number()
		.nullable()
		.describe(
			"Salary for the contract period (DYN_contract_cyclist.finan_i_period_wage). Null when no active contract is found.",
		),
	value: z
		.number()
		.nullable()
		.describe(
			"Market value / valeur (value_f_capital) — null on saves that pre-date this column.",
		),
});

const outputSchema = z.object({
	teamId: z.number().describe("Team ID the roster belongs to (IDteam)"),
	count: z.number().describe("Number of cyclists in the roster"),
	riders: z
		.array(riderSchema)
		.describe("Roster cyclists, ordered by overall ability (highest first)"),
});

/** Compute age in whole years from two YYYYMMDD integers (e.g. 20030503). */
function ageFromYmd(currentYmd: number, birthYmd: number): number {
	let age = Math.floor(currentYmd / 10000) - Math.floor(birthYmd / 10000);
	// Decrement if this year's birthday (MMDD) has not occurred yet.
	if (currentYmd % 10000 < birthYmd % 10000) {
		age--;
	}
	return age;
}

export function registerGetTeamRoster(server: McpServer): void {
	server.registerTool(
		"pcm_get_team_roster",
		{
			title: "Get PCM team roster",
			description:
				"List the roster of a team in a Pro Cycling Manager `.cdb` save file. Defaults to the active human player's team (GAM_user.game_i_active = 1) when `teamId` is omitted. Joins DYN_cyclist with its active DYN_contract_cyclist and STA_type_rider, and for each rider returns name, age, rider type, overall ability (note globale), contract end year, wage and market value. Ordered by overall ability, highest first.",
			inputSchema: {
				savePath: z.string().describe("Absolute path to the .cdb save file"),
				teamId: z
					.number()
					.int()
					.optional()
					.describe(
						"Team ID (IDteam) whose roster to list. Defaults to the active player's team when omitted.",
					),
			},
			outputSchema,
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false,
			},
		},
		async ({ savePath, teamId }) =>
			withSaveDb(savePath, (db, save) => {
				// Resolve the target team: explicit teamId, else the active player's team.
				let resolvedTeamId = teamId;
				if (resolvedTeamId == null) {
					const teamResult = db.exec(
						"SELECT fkIDteam_duplicate FROM GAM_user WHERE game_i_active = 1",
					);
					const value = teamResult[0]?.values?.[0]?.[0];
					if (value == null) {
						throw new Error(
							`No active player (game_i_active = 1) found in ${save.name}; pass teamId explicitly.`,
						);
					}
					resolvedTeamId = Number(value);
				}

				// The current in-game date (YYYYMMDD) is the reference point for age.
				const dateResult = db.exec(
					"SELECT gene_i_date FROM GAM_config LIMIT 1",
				);
				const currentYmdRaw = dateResult[0]?.values?.[0]?.[0];
				const currentYmd =
					currentYmdRaw != null ? Number(currentYmdRaw) : null;

				// Some columns are absent on saves that pre-date them — detect them so
				// the query stays valid across PCM versions.
				const columnInfo = db.exec(`PRAGMA table_info("DYN_cyclist")`);
				const columnNames = new Set(
					(columnInfo[0]?.values ?? []).map((r) => String(r[1])),
				);
				const hasCurrentAbility = columnNames.has("value_f_current_ability");
				const hasCapital = columnNames.has("value_f_capital");

				const stmt = db.prepare(
					`SELECT
						c.IDcyclist                AS id,
						c.gene_sz_firstname        AS firstName,
						c.gene_sz_lastname         AS lastName,
						c.gene_i_birthdate         AS birthdate,
						${hasCurrentAbility ? "c.value_f_current_ability" : "NULL"} AS overall,
						${hasCapital ? "c.value_f_capital" : "NULL"} AS value,
						tr.CONSTANT                AS type,
						ct.iYearEnd                AS contractEndYear,
						ct.finan_i_period_wage     AS wage
					FROM DYN_cyclist c
					LEFT JOIN STA_type_rider tr ON c.fkIDtype_rider = tr.IDtype_rider
					LEFT JOIN DYN_contract_cyclist ct
						ON ct.fkIDcyclist = c.IDcyclist AND ct.gene_b_active_contract = 1
					WHERE c.fkIDteam = :teamId
					ORDER BY overall DESC, c.gene_sz_lastname ASC`,
				);

				const riders: z.infer<typeof riderSchema>[] = [];
				try {
					stmt.bind({ ":teamId": resolvedTeamId });
					while (stmt.step()) {
						const row = stmt.getAsObject();
						const birthdate =
							row.birthdate != null ? Number(row.birthdate) : null;
						riders.push({
							id: Number(row.id),
							firstName: String(row.firstName),
							lastName: String(row.lastName),
							age:
								currentYmd != null && birthdate != null
									? ageFromYmd(currentYmd, birthdate)
									: null,
							type: row.type != null ? String(row.type) : null,
							overall: row.overall != null ? Number(row.overall) : null,
							contractEndYear:
								row.contractEndYear != null
									? Number(row.contractEndYear)
									: null,
							wage: row.wage != null ? Number(row.wage) : null,
							value: row.value != null ? Number(row.value) : null,
						});
					}
				} finally {
					stmt.free();
				}

				const output: z.infer<typeof outputSchema> = {
					teamId: resolvedTeamId,
					count: riders.length,
					riders,
				};
				return output;
			}),
	);
}
