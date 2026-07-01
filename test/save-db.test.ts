import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cdbToSql } from "cdb-converter";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type Mock,
	vi,
} from "vitest";
import { withSaveDb } from "../src/save-db";

// withSaveDb reads a real .cdb file but the cdb->SQL conversion needs the real
// binary format, so we stub it out and hand back a fake in-memory database.
vi.mock("cdb-converter", () => ({ cdbToSql: vi.fn() }));
vi.mock("sql.js", () => ({ default: vi.fn(() => ({})) }));

const cdbToSqlMock = cdbToSql as Mock;

let dir: string;
let savePath: string;
/** A fake sql.js database; we only care that it gets closed. */
const fakeDb = { close: vi.fn() };

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "pcm-save-db-"));
	savePath = join(dir, "Career.cdb");
	await writeFile(savePath, "raw cdb bytes");

	cdbToSqlMock.mockReset();
	cdbToSqlMock.mockReturnValue(fakeDb);
	fakeDb.close.mockReset();
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe("withSaveDb", () => {
	it("wraps the callback's output in a valid response", async () => {
		const result = await withSaveDb(savePath, () => ({ riders: 42 }));

		expect(result.isError).toBeUndefined();
		expect(result.structuredContent).toEqual({ riders: 42 });
	});

	it("passes the open database and save metadata to the callback", async () => {
		const fn = vi.fn((_db: unknown, _save: { name: string; path: string }) => ({
			ok: true,
		}));

		await withSaveDb(savePath, fn);

		const [db, save] = fn.mock.calls[0];
		expect(db).toBe(fakeDb);
		expect(save.name).toBe("Career.cdb");
		expect(save.path).toBe(savePath);
	});

	it("supports async callbacks", async () => {
		const result = await withSaveDb(savePath, async () => ({ async: true }));

		expect(result.structuredContent).toEqual({ async: true });
	});

	it("closes the database after a successful call", async () => {
		await withSaveDb(savePath, () => ({}));

		expect(fakeDb.close).toHaveBeenCalledTimes(1);
	});

	it("closes the database even when the callback throws", async () => {
		const result = await withSaveDb(savePath, () => {
			throw new Error("boom");
		});

		expect(result.isError).toBe(true);
		expect((result.content[0] as { text: string }).text).toContain("boom");
		expect(fakeDb.close).toHaveBeenCalledTimes(1);
	});

	it("returns an error response for a non-.cdb path without opening a database", async () => {
		const result = await withSaveDb(join(dir, "notes.txt"), () => ({}));

		expect(result.isError).toBe(true);
		expect(cdbToSqlMock).not.toHaveBeenCalled();
		expect(fakeDb.close).not.toHaveBeenCalled();
	});
});
