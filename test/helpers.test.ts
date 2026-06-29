import { describe, expect, it } from "vitest";
import { ageFromYmd, errorResponse, validResponse } from "../src/helpers";

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

describe("ageFromYmd", () => {
	it("computes age when this year's birthday has already passed", () => {
		// born 2003-05-03, current 2026-06-05 → 23rd birthday already passed
		expect(ageFromYmd(20260605, 20030503)).toBe(23);
	});

	it("subtracts a year when this year's birthday has not occurred yet", () => {
		// born 2003-07-20, current 2026-06-05 → still 22 until July
		expect(ageFromYmd(20260605, 20030720)).toBe(22);
	});

	it("counts the birthday itself as a full year", () => {
		// born 2003-06-05, current 2026-06-05 → exactly 23 on the day
		expect(ageFromYmd(20260605, 20030605)).toBe(23);
	});

	it("treats the day before the birthday as the younger age", () => {
		// born 2003-06-05, current 2026-06-04 → still 22, one day short
		expect(ageFromYmd(20260604, 20030605)).toBe(22);
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
