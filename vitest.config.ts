import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

// Mirror esbuild's `.md` text loader (tsup.config.ts) so `import x from "*.md"`
// resolves to the file contents as a string under vitest.
function markdownAsText(): Plugin {
	return {
		name: "markdown-as-text",
		enforce: "pre",
		load(id) {
			const [file] = id.split("?");
			if (file.endsWith(".md")) {
				return `export default ${JSON.stringify(readFileSync(file, "utf-8"))};`;
			}
		},
	};
}

export default defineConfig({
	plugins: [markdownAsText()],
	test: {
		environment: "node",
		include: ["test/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html", "lcov"],
			include: ["src/**/*.ts"],
		},
	},
});
