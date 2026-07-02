import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
	},
	format: ["esm"],
	dts: false,
	shims: true,
	clean: true,
	sourcemap: false,
	minify: false,
	banner: {
		js: "#!/usr/bin/env node",
	},
	// Inline DATABASE.md into the bundle as a string (import in src/reference.ts)
	// so the query-save description / pcm://docs/database resource carry the
	// reference without shipping the file alongside dist/.
	loader: {
		".md": "text",
	},
});
