import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function validResponse(
	structured:
		| {
				[x: string]: unknown;
		  }
		| undefined,
): CallToolResult {
	return {
		content: [
			{
				type: "text",
				text: structured ? JSON.stringify(structured, null, 2) : "",
			},
		],
		structuredContent: structured,
	};
}

export function errorResponse(error: string): CallToolResult {
	return {
		content: [
			{
				type: "text",
				text: error,
			},
		],
		isError: true,
	};
}

export interface StartlistTeam {
	id: number;
	cyclists: number[];
}

/**
 * Build a Pro Cycling Manager startlist XML document from a list of teams and
 * their cyclist rosters. The output mirrors PCM's expected format: a
 * `<startlist>` root, `<team id="N">` children (4-space indent) and
 * self-closing `<cyclist id="N" />` elements (8-space indent).
 */
export function buildStartlistXml(teams: StartlistTeam[]): string {
	if (teams.length === 0) {
		throw new Error("Provide at least one team.");
	}
	const lines: string[] = ["<startlist>"];
	for (const team of teams) {
		if (team.cyclists.length === 0) {
			throw new Error(`Team ${team.id} has no cyclists.`);
		}
		lines.push(`    <team id="${team.id}">`);
		for (const cyclistId of team.cyclists) {
			lines.push(`        <cyclist id="${cyclistId}" />`);
		}
		lines.push("    </team>");
	}
	lines.push("</startlist>");
	return `${lines.join("\n")}\n`;
}

/**
 * Translate sql.js "no such table/column" errors into actionable messages that
 * point the caller at the schema-discovery tools. Other errors pass through.
 *
 * Shared by the read (`pcm_query_save`) and write (`pcm_update_save`) tools.
 */
export function explainQueryError(error: unknown): Error {
	const message = error instanceof Error ? error.message : String(error);

	const missingTable = /no such table:\s*(\S+)/i.exec(message);
	if (missingTable) {
		return new Error(
			`Table "${missingTable[1]}" does not exist in this save — use pcm_get_save_schema to list available tables.`,
		);
	}

	const missingColumn = /no such column:\s*(\S+)/i.exec(message);
	if (missingColumn) {
		return new Error(
			`Column "${missingColumn[1]}" does not exist — use pcm_get_table_schema to inspect the table's columns.`,
		);
	}

	// Raised by `PRAGMA query_only = ON` when a statement tries to write.
	if (/readonly database|not authorized/i.test(message)) {
		return new Error(
			"This tool is read-only — the query attempted to modify the save, which is not allowed.",
		);
	}

	return error instanceof Error ? error : new Error(message);
}

/** Compute age in whole years from two YYYYMMDD integers (e.g. 20030503). */
export function ageFromYmd(currentYmd: number, birthYmd: number): number {
	let age = Math.floor(currentYmd / 10000) - Math.floor(birthYmd / 10000);
	// Decrement if this year's birthday (MMDD) has not occurred yet.
	if (currentYmd % 10000 < birthYmd % 10000) {
		age--;
	}
	return age;
}
