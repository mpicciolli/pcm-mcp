import { fileURLToPath } from "node:url";

export const saveFixtures = [
	[
		"Pro cycling manager 2018",
		fileURLToPath(
			new URL("../fixtures/OfficialRelease-2018.cdb", import.meta.url),
		),
	],
	[
		"Pro cycling manager 2019",
		fileURLToPath(
			new URL("../fixtures/OfficialRelease-2019.cdb", import.meta.url),
		),
	],
	[
		"Pro cycling manager 2021",
		fileURLToPath(
			new URL("../fixtures/OfficialRelease-2021.cdb", import.meta.url),
		),
	],
	[
		"Pro cycling manager 2025",
		fileURLToPath(
			new URL("../fixtures/OfficialRelease-2025.cdb", import.meta.url),
		),
	],
];
