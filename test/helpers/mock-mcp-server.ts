import { vi } from "vitest";
import type {
	McpServer,
	ToolCallback,
} from "@modelcontextprotocol/sdk/server/mcp";

interface RegisteredTool {
	name: string;
	config: any;
	callback: ToolCallback<any>;
}

export interface MockMcpServer {
	/** The object to pass where an `McpServer` is expected. */
	server: McpServer;
	/** Vitest mock fn behind `server.registerTool`, for call assertions. */
	registerTool: ReturnType<typeof vi.fn>;
	/** Every tool registered so far, in registration order. */
	tools: RegisteredTool[];
	/** Look up a registered tool by its name. */
	getTool(name: string): RegisteredTool | undefined;
	/** Invoke a registered tool's callback by name. */
	callTool(
		name: string,
		args: Record<string, unknown>,
	): ReturnType<ToolCallback<any>>;
}

/**
 * Build a fake `McpServer` for unit tests. Only `registerTool` is implemented;
 * it records each registration so tests can inspect the config or invoke the
 * tool callback directly.
 *
 * @example
 * const mcp = createMockMcpServer();
 * registerGetTableSchema(mcp.server);
 * const result = await mcp.callTool("pcm_get_table_schema", { savePath, tableName });
 */
export function createMockMcpServer(): MockMcpServer {
	const tools: RegisteredTool[] = [];

	const registerTool = vi.fn(
		(name: string, config: any, callback: ToolCallback<any>) => {
			tools.push({ name, config, callback });
		},
	);

	const getTool = (name: string) => tools.find((t) => t.name === name);

	const callTool = (name: string, args: Record<string, unknown>) => {
		const tool = getTool(name);
		if (!tool) {
			throw new Error(
				`Tool "${name}" was not registered. Registered: ${
					tools.map((t) => t.name).join(", ") || "(none)"
				}`,
			);
		}
		// The second arg is the RequestHandlerExtra, unused by these tools.
		return tool.callback(args as any, {} as any);
	};

	const server = { registerTool } as unknown as McpServer;

	return { server, registerTool, tools, getTool, callTool };
}
