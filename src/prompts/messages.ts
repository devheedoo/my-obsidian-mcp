import type {
  EmbeddedResource,
  GetPromptResult,
  PromptMessage,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";

export type PromptResult = GetPromptResult;

export function userTextMessage(text: string): PromptMessage {
  const content = {
    type: "text",
    text,
  } satisfies TextContent;

  const message = {
    role: "user",
    content,
  } satisfies PromptMessage;

  return message;
}

export function userResourceMessage(
  uri: string,
  mimeType: string,
  text: string,
): PromptMessage {
  const content = {
    type: "resource",
    resource: {
      uri,
      mimeType,
      text,
    },
  } satisfies EmbeddedResource;

  const message = {
    role: "user",
    content,
  } satisfies PromptMessage;

  return message;
}
