import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mapRatings, ratingsColumns, ratingsSchema } from "../schemas/cyclist";
import { getTableColumnNames, withSaveDb } from "../save-db";

const cyclistSchema = z.object({
	id: z.number().describe("Cyclist ID (IDcyclist)"),
	firstName: z.string().describe("First name (gene_sz_firstname)"),
	lastName: z.string().describe("Last name (gene_sz_lastname)"),
	country: z
		.string()
		.nullable()
		.describe("Country name (STA_country.CONSTANT)"),
	...ratingsSchema.shape,
	currentAbility: z
		.number()
		.nullable()
		.describe(
			"Current ability (value_f_current_ability) — null on saves that pre-date this column",
		),
});

const outputSchema = z.object({
	cyclists: z.array(cyclistSchema).describe("Matching cyclists"),
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
					.describe(
						"First name to search for (partial match, case-insensitive)",
					),
				lastName: z
					.string()
					.optional()
					.describe(
						"Last name to search for (partial match, case-insensitive)",
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
		async ({ savePath, firstName = "", lastName = "" }) =>
			withSaveDb(savePath, (db) => {
				const columnNames = getTableColumnNames(db, "DYN_cyclist");
				const hasMediumMountain = columnNames.has("charac_i_medium_mountain");
				const hasCurrentAbility = columnNames.has("value_f_current_ability");

				const stmt = db.prepare(
					`SELECT
						c.IDcyclist,
						c.gene_sz_firstname,
						c.gene_sz_lastname,
						${ratingsColumns(hasMediumMountain)},
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
					const first = firstName.trim();
					const last = lastName.trim();
					if (first.length === 0 && last.length === 0) {
						throw new Error("Provide at least one of firstName or lastName.");
					}

					stmt.bind({
						":lastName": `%${last}%`,
						":firstName": `%${first}%`,
					});

					while (stmt.step()) {
						const row = stmt.getAsObject();
						cyclists.push({
							id: Number(row.IDcyclist),
							firstName: String(row.gene_sz_firstname),
							lastName: String(row.gene_sz_lastname),
							country: row.country != null ? String(row.country) : null,
							...mapRatings(row),
							currentAbility:
								row.currentAbility != null ? Number(row.currentAbility) : null,
						});
					}
				} finally {
					stmt.free();
				}

				const output: z.infer<typeof outputSchema> = {
					cyclists,
				};
				return output;
			}),
	);
}
