import { readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { cdbToSql, sqlToCdb } from "cdb-converter";
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
 * `withSaveDb` itself never writes to `savePath`: the on-disk source save is
 * only ever read. A write-capable tool can pass `{ queryOnly: false }`, mutate
 * the in-memory database in `fn`, and serialize the result to a *separate*
 * output file via {@link writeSaveDb} — the source is never overwritten.
 *
 * @param savePath - Absolute path to the `.cdb` save file.
 * @param fn - Receives the open database and the validated save metadata, and
 *   returns the tool's structured output.
 */
export async function withSaveDb<T extends Record<string, unknown>>(
	savePath: string,
	fn: (db: SaveDb, save: SaveFile) => T | Promise<T>,
	config: {
		queryOnly?: boolean;
	} = {},
): Promise<CallToolResult> {
	let db: SaveDb | undefined;
	try {
		const save = await validateSave(savePath);

		const SQL = await initSqlJs();
		const cdbBuffer = await readFile(save.path);
		db = cdbToSql(cdbBuffer, SQL);

		if (config.queryOnly ?? true) {
			db.run("PRAGMA query_only = ON;");
		}

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

/**
 * Serialize an edited in-memory save back to a `.cdb` file at `outputPath`.
 *
 * Writes only ever go to a new file: this refuses to overwrite the source save
 * (`sourcePath`), so the input `.cdb` is never modified. `sqlToCdb` re-encodes
 * the sql.js database into PCM's compressed `.cdb` binary format.
 *
 * @param db - The (edited) in-memory database to serialize.
 * @param outputPath - Absolute path of the `.cdb` file to write.
 * @param sourcePath - Absolute path of the source save, used only to guard
 *   against overwriting it.
 * @returns The absolute path written.
 * @throws if `outputPath` isn't a `.cdb` file, resolves to `sourcePath`, points
 *   into a missing directory, or would overwrite an existing file.
 */
export async function writeSaveDb(
	db: SaveDb,
	outputPath: string,
	sourcePath: string,
): Promise<string> {
	if (!outputPath.toLowerCase().endsWith(".cdb")) {
		throw new Error(`Output must be a .cdb file: ${outputPath}`);
	}

	const resolvedOutput = resolve(outputPath);
	if (resolvedOutput === resolve(sourcePath)) {
		throw new Error(
			"outputPath must differ from the source save — the input .cdb is never overwritten.",
		);
	}

	// Never clobber an existing file: writes only ever create a new `.cdb`.
	if (await pathExists(resolvedOutput)) {
		throw new Error(
			`outputPath already exists: ${resolvedOutput} — choose a new file name so no existing file is overwritten.`,
		);
	}

	// Fail early with an actionable message rather than a raw ENOENT from writeFile.
	const parent = dirname(resolvedOutput);
	if (!(await isDirectory(parent))) {
		throw new Error(
			`Output directory does not exist: ${parent} — create it first or point outputPath at an existing directory.`,
		);
	}

	const cdb = sqlToCdb(db);
	await writeFile(resolvedOutput, Buffer.from(cdb));
	return resolvedOutput;
}

/** True if `path` exists (file or directory). */
async function pathExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return false;
		}
		throw error;
	}
}

/** True if `path` exists and is a directory. */
async function isDirectory(path: string): Promise<boolean> {
	try {
		return (await stat(path)).isDirectory();
	} catch {
		return false;
	}
}
