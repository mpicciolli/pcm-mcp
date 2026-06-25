import { readFile } from "node:fs/promises";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { cdbToSql } from "cdb-converter";
import initSqlJs from "sql.js";
import { errorResponse, validResponse } from "./helpers";
import { type SaveFile, validateSave } from "./saves";

/** An in-memory sql.js database produced from a `.cdb` save by `cdbToSql`. */
type SaveDb = ReturnType<typeof cdbToSql>;

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
