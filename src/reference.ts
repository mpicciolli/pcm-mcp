import databaseReference from "../DATABASE.md";

/**
 * The `DATABASE.md` save-schema reference, inlined into the bundle at build time
 * (esbuild `text` loader; see `tsup.config.ts`). `DATABASE.md` stays the single
 * source of truth — its contents are embedded as a string, so nothing extra
 * ships alongside `dist/` and there is no runtime file read.
 *
 * Surfaced to the LLM in the `pcm_query_save` description and via the
 * `pcm://docs/database` resource.
 */
export const DATABASE_REFERENCE: string = databaseReference;

/** Canonical MCP resource URI for the save-schema reference. */
export const DATABASE_REFERENCE_URI = "pcm://docs/database";
