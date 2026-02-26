import path from "node:path";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerPrompts } from "./prompts.js";
import { registerResources } from "./resources.js";
import { registerTools } from "./tools/index.js";
import { createVaultApi } from "./vault.js";

/**
 * Usage:
 *   tsx src/index.ts /abs/path/to/ObsidianVault
 */
const vaultRootArg = process.argv[2];
if (!vaultRootArg) {
  console.error("Missing vault path. Usage: obsidian-mcp <vaultRoot>");
  process.exit(1);
}

const vault = createVaultApi(path.resolve(vaultRootArg));
const server = new McpServer({ name: "obsidian-mcp", version: "0.1.0" });

registerTools(server, vault);
registerResources(server, vault);
registerPrompts(server, vault);

/** Connect transport **/
const transport = new StdioServerTransport();
await server.connect(transport);
