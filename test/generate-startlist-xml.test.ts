import { describe, expect, it } from "vitest";
import { buildStartlistXml } from "../src/helpers";
import { resolveStartlistFileName } from "../src/tools/generate-startlist-xml";

describe("buildStartlistXml", () => {
	it("builds XML for a single team", () => {
		const xml = buildStartlistXml([{ id: 34, cyclists: [7602, 5996] }]);
		expect(xml).toBe(
			[
				"<startlist>",
				'    <team id="34">',
				'        <cyclist id="7602" />',
				'        <cyclist id="5996" />',
				"    </team>",
				"</startlist>",
				"",
			].join("\n"),
		);
	});

	it("builds XML for multiple teams with variable roster sizes", () => {
		const xml = buildStartlistXml([
			{ id: 34, cyclists: [1, 2, 3, 4, 5, 6, 7] },
			{ id: 81, cyclists: [10, 11, 12, 13, 14, 15] },
		]);
		expect(xml).toBe(
			[
				"<startlist>",
				'    <team id="34">',
				'        <cyclist id="1" />',
				'        <cyclist id="2" />',
				'        <cyclist id="3" />',
				'        <cyclist id="4" />',
				'        <cyclist id="5" />',
				'        <cyclist id="6" />',
				'        <cyclist id="7" />',
				"    </team>",
				'    <team id="81">',
				'        <cyclist id="10" />',
				'        <cyclist id="11" />',
				'        <cyclist id="12" />',
				'        <cyclist id="13" />',
				'        <cyclist id="14" />',
				'        <cyclist id="15" />',
				"    </team>",
				"</startlist>",
				"",
			].join("\n"),
		);
	});

	it("ends the document with a trailing newline", () => {
		const xml = buildStartlistXml([{ id: 1, cyclists: [1] }]);
		expect(xml.endsWith("\n")).toBe(true);
	});

	it("throws when no team is provided", () => {
		expect(() => buildStartlistXml([])).toThrow("Provide at least one team.");
	});

	it("throws when a team has no cyclists", () => {
		expect(() => buildStartlistXml([{ id: 34, cyclists: [] }])).toThrow(
			"Team 34 has no cyclists.",
		);
	});
});

describe("resolveStartlistFileName", () => {
	it("appends .xml to the STA_race base name", () => {
		expect(resolveStartlistFileName("c0_almeria")).toBe("c0_almeria.xml");
	});

	it("does not double-append when .xml is already present", () => {
		expect(resolveStartlistFileName("c0_almeria.xml")).toBe("c0_almeria.xml");
	});
});
