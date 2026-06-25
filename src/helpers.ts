import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function validResponse(
	structured:
		| {
				[x: string]: unknown;
		  }
		| undefined,
): CallToolResult {
	return {
		content: [
			{
				type: "text",
				text: structured ? JSON.stringify(structured, null, 2) : "",
			},
		],
		structuredContent: structured,
	};
}

export function errorResponse(error: string): CallToolResult {
	return {
		content: [
			{
				type: "text",
				text: error,
			},
		],
		isError: true,
	};
}
