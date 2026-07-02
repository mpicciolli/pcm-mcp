import { readFile } from "node:fs/promises";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { cdbToSql } from "cdb-converter";
import initSqlJs from "sql.js";
import { errorResponse, validResponse } from "./helpers";
import { type SaveFile, validateSave } from "./saves";

/** An in-memory sql.js database produced from a `.cdb` save by `cdbToSql`. */
export type SaveDb = ReturnType<typeof cdbToSql>;

/** Smallest plausible `YYYYMMDD` value (year 1000), used to reject sentinels. */
const MIN_YMD = 10000000;

/**
 * Read the current in-game date from a save as a `YYYYMMDD` integer
 * (e.g. `20260605`), or `null` when it can't be found or isn't a real date.
 *
 * PCM stores the career's current date in `GAM_config.gene_i_date`. It is the
 * reference point for any age- or season-relative computation, since the
 * on-disk save advances as the career is played. Fresh official releases that
 * haven't started a career store `0` here; that sentinel is treated as "unknown"
 * (returns `null`) so callers don't derive nonsensical ages from it.
 */
export function getGameDate(db: SaveDb): number | null {
	try {
		const result = db.exec("SELECT gene_i_date FROM GAM_config LIMIT 1");
		const raw = result[0]?.values?.[0]?.[0];
		if (raw == null) {
			return null;
		}
		const value = Number(raw);
		return Number.isFinite(value) && value >= MIN_YMD ? value : null;
	} catch {
		return null;
	}
}

/**
 * Open a Pro Cycling Manager `.cdb` save as an in-memory SQL database, run
 * `fn`, and wrap the result in an MCP tool response.
 *
 * Centralises the boilerplate every save-reading tool needs:
 *  - validates that `savePath` points to an existing `.cdb` file
 *    (via {@link validateSave}),
 *  - re-reads and converts the save on every call with `cdbToSql`, so the data
 *    is never stale — the on-disk save is the single source of truth,
 *  - guarantees the database is closed afterwards, even on error,
 *  - turns thrown errors into an {@link errorResponse} and the returned value
 *    into a {@link validResponse}.
 *
 * The save is loaded into memory only; changes are never written back to disk.
 *
 * @param savePath - Absolute path to the `.cdb` save file.
 * @param fn - Receives the open database and the validated save metadata, and
 *   returns the tool's structured output.
 */
export async function withSaveDb<T extends Record<string, unknown>>(
	savePath: string,
	fn: (db: SaveDb, save: SaveFile) => T | Promise<T>,
): Promise<CallToolResult> {
	let db: SaveDb | undefined;
	try {
		const save = await validateSave(savePath);

		const SQL = await initSqlJs();
		const cdbBuffer = await readFile(save.path);
		db = cdbToSql(cdbBuffer, SQL);

		db.run("PRAGMA query_only = ON;");

		const output = await fn(db, save);

		return validResponse(output);
	} catch (error) {
		return errorResponse(
			error instanceof Error ? error.message : String(error),
		);
	} finally {
		db?.close();
	}
}
