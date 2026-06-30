import { beforeEach, describe, expect, it } from "vitest";
import { registerGetSaveSchema } from "../../src/tools/get-save-schema";
import { createMockMcpServer } from "../helpers/mock-mcp-server";
import type { MockMcpServer } from "../helpers/mock-mcp-server";
import { saveFixtures } from "../fixtures/save.fixture";

describe("getSaveSchema", () => {
	let mcp: MockMcpServer;

	beforeEach(() => {
		mcp = createMockMcpServer();
		registerGetSaveSchema(mcp.server);
	});

	it("registers the pcm_get_save_schema tool", () => {
		expect(mcp.getTool("pcm_get_save_schema")).toBeDefined();
		expect(mcp.registerTool).toHaveBeenCalledOnce();
	});

	it.each(saveFixtures)("returns save schema for %s", async (name, path) => {
		const result = await mcp.callTool("pcm_get_save_schema", {
			savePath: path,
		});

		expect(result.structuredContent).toBeDefined();
		expect(result.structuredContent).toMatchSnapshot();
	});
});
