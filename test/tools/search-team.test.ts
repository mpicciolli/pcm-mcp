import { beforeEach, describe, expect, it } from "vitest";
import { registerSearchTeam } from "../../src/tools/search-team";
import { saveFixtures } from "../fixtures/save.fixture";
import { createMockMcpServer } from "../helpers/mock-mcp-server";
import type { MockMcpServer } from "../helpers/mock-mcp-server";

describe("searchTeam", () => {
	let mcp: MockMcpServer;

	beforeEach(() => {
		mcp = createMockMcpServer();
		registerSearchTeam(mcp.server);
	});

	it("registers the pcm_search_team tool", () => {
		expect(mcp.getTool("pcm_search_team")).toBeDefined();
		expect(mcp.registerTool).toHaveBeenCalledOnce();
	});

	it.each(saveFixtures)("finds teams by name for %s", async (name, path) => {
		const result = await mcp.callTool("pcm_search_team", {
			savePath: path,
			name: "movistar",
		});

		expect(result.structuredContent).toBeDefined();
		expect(result.structuredContent).toMatchSnapshot();
	});

	it("returns an error when the name is empty", async () => {
		const result = await mcp.callTool("pcm_search_team", {
			savePath: saveFixtures[0][1],
			name: "   ",
		});

		expect(result.isError).toBe(true);
	});
});
