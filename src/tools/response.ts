import type { CallToolResult, TextContent } from "@modelcontextprotocol/sdk/types.js";

export type ToolResult = CallToolResult;
export type ToolErrorResult = CallToolResult & { isError: true };

export function textResult(text: string): ToolResult {
  const content = [{ type: "text", text }] satisfies TextContent[];
  const result = { content } satisfies CallToolResult;
  return result;
}

export function jsonResult(value: unknown): ToolResult {
  return textResult(JSON.stringify(value, null, 2));
}

export function errorResult(message: string): ToolErrorResult {
  const result = { ...textResult(message), isError: true } satisfies ToolErrorResult;
  return result;
}
