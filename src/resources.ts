import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

import { VaultApi } from "./vault.js";

export function registerResources(server: McpServer, vault: VaultApi) {
  server.resource(
    "note",
    new ResourceTemplate("obsidian://note/{path}", {
      list: async () => {
        const files = await vault.listMarkdownFiles();
        return {
          resources: files.map((f) => ({
            uri: `obsidian://note/${f}`,
            name: f,
            mimeType: "text/markdown",
          })),
        };
      },
    }),
    { mimeType: "text/markdown" },
    async (uri, variables) => {
      const rel = String(variables.path);
      const note = await vault.readNote(rel);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: note.raw,
          },
        ],
      };
    },
  );
}
