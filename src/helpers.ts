import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** A successful tool result carrying a single text block. */
export function textResult(text: string): CallToolResult {
	return { content: [{ type: "text", text }] };
}

/** Serialise `value` as pretty JSON inside a text result. */
export function jsonResult(value: unknown): CallToolResult {
	return textResult(JSON.stringify(value, null, 2));
}

/** An error tool result built from a thrown value. */
export function errorResult(error: unknown): CallToolResult {
	return {
		content: [
			{
				type: "text",
				text: error instanceof Error ? error.message : String(error),
			},
		],
		isError: true,
	};
}
