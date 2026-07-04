import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cdbToSql } from "cdb-converter";
import initSqlJs from "sql.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerUpdateCyclistRatings } from "../../src/tools/update-cyclist-ratings";
import { saveFixtures } from "../fixtures/save.fixture";
import { createMockMcpServer } from "../mocks/mock-mcp-server";
import type { MockMcpServer } from "../mocks/mock-mcp-server";

/** Read the first cyclist ID out of a `.cdb` file. */
async function readFirstCyclistId(cdbPath: string): Promise<number> {
	const SQL = await initSqlJs();
	const db = cdbToSql(await readFile(cdbPath), SQL);
	try {
		const result = db.exec(
			"SELECT IDcyclist FROM DYN_cyclist ORDER BY IDcyclist LIMIT 1",
		);
		return Number(result[0]?.values?.[0]?.[0]);
	} finally {
		db.close();
	}
}

/** Read a cyclist's rating columns back out of a written `.cdb` file. */
async function readRatings(
	cdbPath: string,
	cyclistId: number,
	columns: string[],
): Promise<number[]> {
	const SQL = await initSqlJs();
	const db = cdbToSql(await readFile(cdbPath), SQL);
	try {
		const result = db.exec(
			`SELECT ${columns.join(", ")} FROM DYN_cyclist WHERE IDcyclist = ${cyclistId}`,
		);
		return (result[0]?.values?.[0] ?? []).map(Number);
	} finally {
		db.close();
	}
}

describe("updateCyclistRatings", () => {
	let mcp: MockMcpServer;
	let outDir: string;

	beforeEach(async () => {
		mcp = createMockMcpServer();
		registerUpdateCyclistRatings(mcp.server);
		outDir = await mkdtemp(join(tmpdir(), "pcm-ratings-"));
	});

	afterEach(async () => {
		await rm(outDir, { recursive: true, force: true });
	});

	it("registers the pcm_update_cyclist_ratings tool", () => {
		expect(mcp.getTool("pcm_update_cyclist_ratings")).toBeDefined();
		expect(mcp.registerTool).toHaveBeenCalledOnce();
	});

	it.each(
		saveFixtures,
	)("updates ratings and writes the change to a new .cdb for %s", async (_name, path) => {
		const cyclistId = await readFirstCyclistId(path);
		const outputPath = join(outDir, "edited.cdb");

		const result = await mcp.callTool("pcm_update_cyclist_ratings", {
			savePath: path,
			outputPath,
			cyclistId,
			ratings: { sprint: 81, mountain: 42 },
		});

		expect(result.isError).toBeUndefined();
		expect(result.structuredContent).toMatchObject({
			outputPath,
			cyclist: {
				id: cyclistId,
				sprint: 81,
				mountain: 42,
			},
		});
		const { cyclist } = result.structuredContent as {
			cyclist: Record<string, unknown>;
		};
		expect(typeof cyclist.firstName).toBe("string");
		expect(typeof cyclist.lastName).toBe("string");

		// The change must actually persist in the written file.
		expect(
			await readRatings(outputPath, cyclistId, [
				"charac_i_sprint",
				"charac_i_mountain",
			]),
		).toEqual([81, 42]);
	});

	it.each(
		saveFixtures,
	)("only changes the ratings that were passed for %s", async (_name, path) => {
		const cyclistId = await readFirstCyclistId(path);
		const before = await readRatings(path, cyclistId, [
			"charac_i_plain",
			"charac_i_cobble",
		]);
		const outputPath = join(outDir, "edited.cdb");

		await mcp.callTool("pcm_update_cyclist_ratings", {
			savePath: path,
			outputPath,
			cyclistId,
			ratings: { sprint: 81 },
		});

		expect(
			await readRatings(outputPath, cyclistId, [
				"charac_i_plain",
				"charac_i_cobble",
			]),
		).toEqual(before);
	});

	it.each(
		saveFixtures,
	)("leaves the source save untouched for %s", async (_name, path) => {
		const cyclistId = await readFirstCyclistId(path);
		const before = await stat(path);
		const outputPath = join(outDir, "edited.cdb");

		await mcp.callTool("pcm_update_cyclist_ratings", {
			savePath: path,
			outputPath,
			cyclistId,
			ratings: { sprint: 81 },
		});

		const after = await stat(path);
		expect(after.size).toBe(before.size);
		expect(after.mtimeMs).toBe(before.mtimeMs);
	});

	it.each(
		saveFixtures,
	)("refuses to overwrite the source save for %s", async (_name, path) => {
		const cyclistId = await readFirstCyclistId(path);
		const result = await mcp.callTool("pcm_update_cyclist_ratings", {
			savePath: path,
			outputPath: path,
			cyclistId,
			ratings: { sprint: 81 },
		});

		expect(result.isError).toBe(true);
		expect(result.content[0]).toEqual({
			type: "text",
			text: "outputPath must differ from the source save — the input .cdb is never overwritten.",
		});
	});

	it.each(
		saveFixtures,
	)("errors on an unknown cyclist ID for %s", async (_name, path) => {
		const result = await mcp.callTool("pcm_update_cyclist_ratings", {
			savePath: path,
			outputPath: join(outDir, "edited.cdb"),
			cyclistId: 999999999,
			ratings: { sprint: 81 },
		});

		expect(result.isError).toBe(true);
		expect(result.content[0]).toEqual({
			type: "text",
			text: "No cyclist with IDcyclist = 999999999 in this save — use pcm_search_cyclist to find the right ID.",
		});
	});

	it.each(
		saveFixtures,
	)("errors when no rating is provided for %s", async (_name, path) => {
		const cyclistId = await readFirstCyclistId(path);
		const result = await mcp.callTool("pcm_update_cyclist_ratings", {
			savePath: path,
			outputPath: join(outDir, "edited.cdb"),
			cyclistId,
			ratings: {},
		});

		expect(result.isError).toBe(true);
		expect(result.content[0]).toEqual({
			type: "text",
			text: "Provide at least one rating to change in `ratings`.",
		});
	});

	it.each(
		saveFixtures,
	)("handles mediumMountain according to the save's schema for %s", async (_name, path) => {
		const SQL = await initSqlJs();
		const db = cdbToSql(await readFile(path), SQL);
		let hasMediumMountain: boolean;
		try {
			const columnInfo = db.exec(`PRAGMA table_info("DYN_cyclist")`);
			hasMediumMountain = (columnInfo[0]?.values ?? []).some(
				(r) => String(r[1]) === "charac_i_medium_mountain",
			);
		} finally {
			db.close();
		}

		const cyclistId = await readFirstCyclistId(path);
		const outputPath = join(outDir, "edited.cdb");
		const result = await mcp.callTool("pcm_update_cyclist_ratings", {
			savePath: path,
			outputPath,
			cyclistId,
			ratings: { mediumMountain: 77 },
		});

		if (hasMediumMountain) {
			expect(result.isError).toBeUndefined();
			expect(
				await readRatings(outputPath, cyclistId, ["charac_i_medium_mountain"]),
			).toEqual([77]);
		} else {
			expect(result.isError).toBe(true);
			expect(result.content[0]).toEqual({
				type: "text",
				text: "This save pre-dates the charac_i_medium_mountain column — mediumMountain cannot be set on it.",
			});
		}
	});
});
