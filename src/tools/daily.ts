import fg from "fast-glob";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DAILY_DATE_RE, VaultApi } from "../vault.js";
import { ToolResult, jsonResult } from "./response.js";
import { listDailyNotesArgs } from "./schemas.js";

export function registerDailyTools(server: McpServer, vault: VaultApi) {
  server.tool("list_daily_notes", listDailyNotesArgs, async ({ from, to, limit }): Promise<ToolResult> => {
      const files = await fg(["daily-notes/**/*.md"], {
        cwd: vault.vaultRoot,
        dot: true,
        onlyFiles: true,
      });

      const notes: { path: string; date: string }[] = [];

      for (const f of files) {
        const m = DAILY_DATE_RE.exec(f);
        if (!m) continue;
        const date = m[1];
        if (from && date < from) continue;
        if (to && date > to) continue;
        notes.push({ path: f, date });
      }

      notes.sort((a, b) => b.date.localeCompare(a.date));
      const result = notes.slice(0, limit);

      return jsonResult(result);
    },
  );
}
