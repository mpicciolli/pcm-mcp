import { beforeEach, describe, expect, it } from "vitest";
import { registerQuerySave } from "../../src/tools/query-save";
import { saveFixtures } from "../fixtures/save.fixture";
import { createMockMcpServer } from "../mocks/mock-mcp-server";
import type { MockMcpServer } from "../mocks/mock-mcp-server";

describe("querySave", () => {
	let mcp: MockMcpServer;

	beforeEach(() => {
		mcp = createMockMcpServer();
		registerQuerySave(mcp.server);
	});

	it("registers the pcm_query_save tool", () => {
		expect(mcp.getTool("pcm_query_save")).toBeDefined();
		expect(mcp.registerTool).toHaveBeenCalledOnce();
	});

	it.each(saveFixtures)(
		"runs a read-only SELECT against %s",
		async (_name, path) => {
			const result = await mcp.callTool("pcm_query_save", {
				savePath: path,
				query: "SELECT COUNT(*) AS n FROM STA_race",
			});

			expect(result.isError).toBeUndefined();
			expect(result.structuredContent).toMatchObject({ rowCount: 1 });
		},
	);

	// A `WITH … DELETE` CTE slips past the static SELECT/WITH guard, so the write
	// is only stopped by `PRAGMA query_only = ON` in the engine. That surfaces a
	// "readonly database" error, which explainQueryError maps to a friendly
	// message — this covers that branch end-to-end.
	it.each(saveFixtures)(
		"maps a query_only write rejection to a read-only message for %s",
		async (_name, path) => {
			const result = await mcp.callTool("pcm_query_save", {
				savePath: path,
				query: "WITH x AS (SELECT 1) DELETE FROM STA_race",
			});

			expect(result.isError).toBe(true);
			expect(result.content[0].text).toBe(
				"This tool is read-only — the query attempted to modify the save, which is not allowed.",
			);
		},
	);
});
