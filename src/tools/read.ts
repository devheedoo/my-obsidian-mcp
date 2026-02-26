import fs from "node:fs/promises";

import fg from "fast-glob";
import matter from "gray-matter";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchNotesText } from "../services/search.js";
import { VaultApi, extractInlineTags, extractWikiLinks } from "../vault.js";
import {
  getBacklinksArgs,
  getNoteArgs,
  listNotesArgs,
  searchNotesArgs,
} from "./schemas.js";
import { ToolResult, jsonResult, textResult } from "./response.js";

export function registerReadTools(server: McpServer, vault: VaultApi) {
  server.tool(
    "list_notes",
    listNotesArgs,
    async ({ glob }): Promise<ToolResult> => {
      const patterns = glob ? [glob] : ["**/*.md"];
      const files = await fg(patterns, {
        cwd: vault.vaultRoot,
        dot: true,
        onlyFiles: true,
      });
      const md = files.filter((f) => f.toLowerCase().endsWith(".md")).sort();
      return jsonResult(md);
    },
  );

  server.tool("get_note", getNoteArgs, async ({ path: rel }): Promise<ToolResult> => {
      const note = await vault.readNote(rel);
      return jsonResult({
        path: note.path,
        frontmatter: note.frontmatter,
        content: note.content,
      });
    },
  );

  server.tool(
    "search_notes",
    searchNotesArgs,
    async ({ query, limit, caseSensitive }): Promise<ToolResult> => {
      const out = await searchNotesText(vault, query, limit, caseSensitive);
      return textResult(out);
    },
  );

  server.tool("get_backlinks", getBacklinksArgs, async ({ target }): Promise<ToolResult> => {
      const files = await vault.listMarkdownFiles();
      const backlinks: { from: string; matches: string[] }[] = [];

      for (const f of files) {
        const abs = vault.assertInsideVault(f);
        const text = await fs.readFile(abs, "utf8");
        const links = extractWikiLinks(text);
        const hits = links.filter((x) => x === target);
        if (hits.length) backlinks.push({ from: f, matches: hits });
      }

      return jsonResult(backlinks);
    },
  );

  server.tool("list_tags", {}, async (): Promise<ToolResult> => {
    const files = await vault.listMarkdownFiles();
    const tags = new Set<string>();

    for (const f of files) {
      const abs = vault.assertInsideVault(f);
      const text = await fs.readFile(abs, "utf8");
      const parsed = matter(text);

      // frontmatter tags: string | string[]
      const fmTags = (parsed.data as { tags?: unknown })?.tags;
      if (typeof fmTags === "string") tags.add(fmTags);
      if (Array.isArray(fmTags))
        fmTags.forEach((t) => typeof t === "string" && tags.add(t));

      extractInlineTags(parsed.content).forEach((t) => tags.add(t));
    }

    return jsonResult([...tags].sort());
  });
}
