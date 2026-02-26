import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { VaultApi } from "../vault.js";
import { registerDailyTools } from "./daily.js";
import { registerReadTools } from "./read.js";
import { registerWriteTools } from "./write.js";

export function registerTools(server: McpServer, vault: VaultApi) {
  registerReadTools(server, vault);
  registerWriteTools(server, vault);
  registerDailyTools(server, vault);
}
