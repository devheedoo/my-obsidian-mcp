import fs from "node:fs/promises";
import path from "node:path";

import fg from "fast-glob";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DAILY_DATE_RE, VaultApi } from "../vault.js";
import { ToolResult, errorResult, jsonResult, textResult } from "./response.js";
import { createDailyNoteArgs, listDailyNotesArgs } from "./schemas.js";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const TEMPLATE_PATH = "daily-notes/template.md";

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

  server.tool("create_daily_note", createDailyNoteArgs, async ({ date }): Promise<ToolResult> => {
      const targetDate = date ?? new Date().toISOString().slice(0, 10);
      const dayOfWeek = DAY_NAMES[new Date(targetDate + "T00:00:00").getDay()];
      const fileName = `${targetDate}-${dayOfWeek}.md`;
      const rel = `daily-notes/${fileName}`;

      const existing = await vault.findDailyNotes(targetDate);
      if (existing.length > 0) {
        return errorResult(
          `Error: daily note already exists for ${targetDate}: ${existing.join(", ")}`,
        );
      }

      let templateContent: string;
      try {
        const abs = vault.assertInsideVault(TEMPLATE_PATH);
        templateContent = await fs.readFile(abs, "utf8");
      } catch {
        templateContent = `---\ntype: daily\ndate: {{date}}\n---\n\n---\n## Log\n\n\n---\n## Work\n\n\n---\n## Personal\n\n\n---\n## TIL\n\n\n---\n## Retro\n`;
      }

      const content = templateContent.replace(/\{\{date\}\}/g, targetDate);
      const abs = vault.assertInsideVault(rel);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content, "utf8");

      return textResult(`Created daily note: ${rel}`);
    },
  );
}
