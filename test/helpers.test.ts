import { describe, expect, it } from "vitest";
import { errorResponse, validResponse } from "../src/helpers";

describe("validResponse", () => {
	it("wraps structured content as pretty-printed JSON text", () => {
		const result = validResponse({ name: "Tadej", wins: 3 });

		expect(result.structuredContent).toEqual({ name: "Tadej", wins: 3 });
		expect(result.content).toEqual([
			{
				type: "text",
				text: JSON.stringify({ name: "Tadej", wins: 3 }, null, 2),
			},
		]);
		expect(result.isError).toBeUndefined();
	});

	it("returns empty text when there is no structured content", () => {
		const result = validResponse(undefined);

		expect(result.structuredContent).toBeUndefined();
		expect(result.content).toEqual([{ type: "text", text: "" }]);
	});
});

describe("errorResponse", () => {
	it("flags the response as an error and echoes the message", () => {
		const result = errorResponse("Save file not found");

		expect(result.isError).toBe(true);
		expect(result.content).toEqual([
			{ type: "text", text: "Save file not found" },
		]);
	});
});
