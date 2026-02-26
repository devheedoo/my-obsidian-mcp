import fs from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { VaultApi } from "../vault.js";
import {
  appendToNoteArgs,
  createNoteArgs,
  updateFrontmatterArgs,
  updateNoteArgs,
} from "./schemas.js";
import { ToolResult, errorResult, textResult } from "./response.js";

export function registerWriteTools(server: McpServer, vault: VaultApi) {
  server.tool(
    "create_note",
    createNoteArgs,
    async ({ path: rel, content, frontmatter }): Promise<ToolResult> => {
      if (!rel.toLowerCase().endsWith(".md")) {
        return errorResult("Error: path must end with .md");
      }

      const abs = vault.assertInsideVault(rel);

      try {
        await fs.access(abs);
        return errorResult(
          `Error: file already exists at '${rel}'. Use update_note to overwrite.`,
        );
      } catch {
        // file doesn't exist - proceed
      }

      await fs.mkdir(path.dirname(abs), { recursive: true });
      const text = vault.buildNoteContent(content, frontmatter);
      await fs.writeFile(abs, text, "utf8");

      return textResult(`Created: ${rel}`);
    },
  );

  server.tool(
    "update_note",
    updateNoteArgs,
    async ({ path: rel, content, frontmatter }): Promise<ToolResult> => {
      const abs = vault.assertInsideVault(rel);

      try {
        await fs.access(abs);
      } catch {
        return errorResult(
          `Error: file not found at '${rel}'. Use create_note to create a new note.`,
        );
      }

      let fm = frontmatter;
      if (!fm) {
        const existing = await fs.readFile(abs, "utf8");
        const parsed = matter(existing);
        fm = parsed.data;
      }

      const text = vault.buildNoteContent(content, fm);
      await fs.writeFile(abs, text, "utf8");

      return textResult(`Updated: ${rel}`);
    },
  );

  server.tool(
    "append_to_note",
    appendToNoteArgs,
    async ({ path: rel, content }): Promise<ToolResult> => {
      const abs = vault.assertInsideVault(rel);

      try {
        await fs.access(abs);
      } catch {
        return errorResult(
          `Error: file not found at '${rel}'. Use create_note to create a new note.`,
        );
      }

      const existing = await fs.readFile(abs, "utf8");
      const separator = existing.endsWith("\n") ? "" : "\n";
      await fs.writeFile(abs, existing + separator + content, "utf8");

      return textResult(`Appended to: ${rel}`);
    },
  );

  server.tool(
    "update_frontmatter",
    updateFrontmatterArgs,
    async ({ path: rel, updates, deleteKeys }): Promise<ToolResult> => {
      const abs = vault.assertInsideVault(rel);

      try {
        await fs.access(abs);
      } catch {
        return errorResult(`Error: file not found at '${rel}'.`);
      }

      const existing = await fs.readFile(abs, "utf8");
      const parsed = matter(existing);
      const fm: Record<string, unknown> = { ...parsed.data, ...updates };

      if (deleteKeys) {
        for (const key of deleteKeys) {
          delete fm[key];
        }
      }

      const text = matter.stringify(parsed.content, fm);
      await fs.writeFile(abs, text, "utf8");

      return textResult(
        `Updated frontmatter of: ${rel}\n${JSON.stringify(fm, null, 2)}`,
      );
    },
  );
}
