import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { withSaveDb } from "../save-db";

const cyclistSchema = z.object({
	id: z.number().describe("Cyclist ID (IDcyclist)"),
	firstName: z.string().describe("First name (gene_sz_firstname)"),
	lastName: z.string().describe("Last name (gene_sz_lastname)"),
	country: z.string().nullable().describe("Country name (STA_country.CONSTANT)"),
	plain: z.number().describe("Plain rating (charac_i_plain)"),
	mountain: z.number().describe("Mountain rating (charac_i_mountain)"),
	mediumMountain: z.number().nullable().describe("Medium mountain rating (charac_i_medium_mountain) — null on saves that pre-date this column"),
	downhilling: z.number().describe("Downhilling rating (charac_i_downhilling)"),
	cobble: z.number().describe("Cobblestone rating (charac_i_cobble)"),
	timeTrial: z.number().describe("Time trial rating (charac_i_timetrial)"),
	prologue: z.number().describe("Prologue rating (charac_i_prologue)"),
	sprint: z.number().describe("Sprint rating (charac_i_sprint)"),
	acceleration: z.number().describe("Acceleration rating (charac_i_acceleration)"),
	endurance: z.number().describe("Endurance rating (charac_i_endurance)"),
	resistance: z.number().describe("Resistance rating (charac_i_resistance)"),
	recuperation: z.number().describe("Recuperation rating (charac_i_recuperation)"),
	hill: z.number().describe("Hill rating (charac_i_hill)"),
	baroudeur: z.number().describe("Baroudeur rating (charac_i_baroudeur)"),
	currentAbility: z.number().nullable().describe("Current ability (value_f_current_ability) — null on saves that pre-date this column"),
});

const outputSchema = z.object({
	cyclists: z.array(cyclistSchema).describe("Matching cyclists"),
	resultCount: z.number().describe("Number of results returned (max 10)"),
});

export function registerSearchCyclist(server: McpServer): void {
	server.registerTool(
		"pcm_search_cyclist",
		{
			title: "Search PCM cyclist by name",
			description:
				"Search for a cyclist in a Pro Cycling Manager `.cdb` save file by first name and/or last name (case-insensitive partial match). Returns up to 10 matching cyclists with all their ratings and their country name.",
			inputSchema: {
				savePath: z.string().describe("Absolute path to the .cdb save file"),
				firstName: z
					.string()
					.optional()
					.describe("First name to search for (partial match, case-insensitive)"),
				lastName: z
					.string()
					.optional()
					.describe("Last name to search for (partial match, case-insensitive)"),
			},
			outputSchema,
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false,
			},
		},
		async ({ savePath, firstName = "", lastName = "" }) =>
			withSaveDb(savePath, (db) => {
				const columnInfo = db.exec(`PRAGMA table_info("DYN_cyclist")`);
				const columnNames = new Set(
					(columnInfo[0]?.values ?? []).map((r) => String(r[1])),
				);
				const hasMediumMountain = columnNames.has("charac_i_medium_mountain");
				const hasCurrentAbility = columnNames.has("value_f_current_ability");

				const stmt = db.prepare(
					`SELECT
						c.IDcyclist,
						c.gene_sz_firstname,
						c.gene_sz_lastname,
						c.charac_i_plain           AS plain,
						c.charac_i_mountain        AS mountain,
						${hasMediumMountain ? "c.charac_i_medium_mountain" : "NULL"} AS mediumMountain,
						c.charac_i_downhilling     AS downhilling,
						c.charac_i_cobble          AS cobble,
						c.charac_i_timetrial       AS timeTrial,
						c.charac_i_prologue        AS prologue,
						c.charac_i_sprint          AS sprint,
						c.charac_i_acceleration    AS acceleration,
						c.charac_i_endurance       AS endurance,
						c.charac_i_resistance      AS resistance,
						c.charac_i_recuperation    AS recuperation,
						c.charac_i_hill            AS hill,
						c.charac_i_baroudeur       AS baroudeur,
						${hasCurrentAbility ? "c.value_f_current_ability" : "NULL"} AS currentAbility,
						co.CONSTANT                AS country
					FROM DYN_cyclist c
					LEFT JOIN STA_region r   ON c.fkIDregion = r.IDregion
					LEFT JOIN STA_country co ON r.fkIDcountry = co.IDcountry
					WHERE LOWER(c.gene_sz_lastname)  LIKE LOWER(:lastName)
					  AND LOWER(c.gene_sz_firstname) LIKE LOWER(:firstName)
					LIMIT 10`,
				);

				const cyclists: z.infer<typeof cyclistSchema>[] = [];
				try {
					stmt.bind({
						":lastName": `%${lastName}%`,
						":firstName": `%${firstName}%`,
					});

					while (stmt.step()) {
						const row = stmt.getAsObject();
						cyclists.push({
							id: Number(row.IDcyclist),
							firstName: String(row.gene_sz_firstname),
							lastName: String(row.gene_sz_lastname),
							country: row.country != null ? String(row.country) : null,
							plain: Number(row.plain),
							mountain: Number(row.mountain),
							mediumMountain: row.mediumMountain != null ? Number(row.mediumMountain) : null,
							downhilling: Number(row.downhilling),
							cobble: Number(row.cobble),
							timeTrial: Number(row.timeTrial),
							prologue: Number(row.prologue),
							sprint: Number(row.sprint),
							acceleration: Number(row.acceleration),
							endurance: Number(row.endurance),
							resistance: Number(row.resistance),
							recuperation: Number(row.recuperation),
							hill: Number(row.hill),
							baroudeur: Number(row.baroudeur),
							currentAbility: row.currentAbility != null ? Number(row.currentAbility) : null,
						});
					}
				} finally {
					stmt.free();
				}

				return { cyclists, resultCount: cyclists.length };
			}),
	);
}
