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
});
