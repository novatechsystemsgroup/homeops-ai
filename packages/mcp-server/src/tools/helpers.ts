import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** Tool failures return a short, human-readable message. Never a stack trace. */
export async function withToolErrors<T>(run: () => Promise<T>, options: { fallback: string }): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${options.fallback}: ${message.slice(0, 200)}`);
  }
}

export function textResult(text: string, structuredContent?: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text }],
    ...(structuredContent ? { structuredContent } : {})
  } as CallToolResult;
}

export function errorResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true } as CallToolResult;
}
