import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import fg from "fast-glob";
import matter from "gray-matter";
import { z } from "zod";

import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

/**
 * Usage:
 *   tsx src/index.ts /abs/path/to/ObsidianVault
 */
const vaultRoot = process.argv[2];
if (!vaultRoot) {
  console.error("Missing vault path. Usage: obsidian-mcp <vaultRoot>");
  process.exit(1);
}
const VAULT = path.resolve(vaultRoot);

const server = new McpServer({ name: "obsidian-mcp", version: "0.1.0" });

function assertInsideVault(p: string) {
  const abs = path.resolve(VAULT, p);
  if (!abs.startsWith(VAULT + path.sep) && abs !== VAULT) {
    throw new Error("Path escapes vault");
  }
  return abs;
}

async function listMarkdownFiles() {
  return fg(["**/*.md"], { cwd: VAULT, dot: true, onlyFiles: true }).then(
    (xs) => xs.sort((a, b) => a.localeCompare(b)),
  );
}

function extractWikiLinks(markdown: string): string[] {
  // [[Page]] or [[Page|Alias]]
  const out: string[] = [];
  const re = /\[\[([^\]\|#]+)(?:\|[^\]]+)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown))) out.push(m[1].trim());
  return out;
}

function extractInlineTags(markdown: string): string[] {
  // very simple: #tag (avoid # in code fences? keep simple for v1)
  const out = new Set<string>();
  const re = /(^|\s)#([A-Za-z0-9/_-]+)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown))) out.add(m[2]);
  return [...out];
}

async function readNote(relPath: string) {
  const abs = assertInsideVault(relPath);
  const text = await fs.readFile(abs, "utf8");
  const parsed = matter(text);
  return {
    path: relPath,
    frontmatter: parsed.data ?? {},
    content: parsed.content ?? "",
    raw: text,
  };
}

/** Tools **/

server.tool(
  "list_notes",
  { glob: z.string().optional().describe("Optional glob like '**/*.md'") },
  async ({ glob }) => {
    const patterns = glob ? [glob] : ["**/*.md"];
    const files = await fg(patterns, {
      cwd: VAULT,
      dot: true,
      onlyFiles: true,
    });
    const md = files.filter((f) => f.toLowerCase().endsWith(".md")).sort();
    return { content: [{ type: "text", text: JSON.stringify(md, null, 2) }] };
  },
);

server.tool(
  "get_note",
  {
    path: z
      .string()
      .describe("Path relative to vault root, e.g. 'Daily/2026-02-26.md'"),
  },
  async ({ path: rel }) => {
    const note = await readNote(rel);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              path: note.path,
              frontmatter: note.frontmatter,
              content: note.content,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  "search_notes",
  {
    query: z.string().min(1),
    limit: z.number().int().positive().max(200).default(50),
    caseSensitive: z.boolean().default(false),
  },
  async ({ query, limit, caseSensitive }) => {
    // Prefer ripgrep if available (fast). Fall back to JS scan.
    const rgArgs = [
      "--no-heading",
      "--with-filename",
      "--line-number",
      "--column",
      "--max-count",
      String(limit),
      ...(caseSensitive ? [] : ["-i"]),
      query,
      ".",
    ];

    try {
      const out = await new Promise<string>((resolve, reject) => {
        const p = spawn("rg", rgArgs, { cwd: VAULT });
        let buf = "";
        let err = "";
        p.stdout.on("data", (d) => (buf += String(d)));
        p.stderr.on("data", (d) => (err += String(d)));
        p.on("close", (code) => {
          // rg returns code 1 when no matches
          if (code === 0 || code === 1) return resolve(buf.trim());
          reject(new Error(err || `rg exited with ${code}`));
        });
      });

      return { content: [{ type: "text", text: out || "" }] };
    } catch {
      // fallback: naive scan (slower)
      const files = await listMarkdownFiles();
      const results: any[] = [];
      const q = caseSensitive ? query : query.toLowerCase();

      for (const f of files) {
        const abs = assertInsideVault(f);
        const text = await fs.readFile(abs, "utf8");
        const hay = caseSensitive ? text : text.toLowerCase();
        if (!hay.includes(q)) continue;

        const lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const lineHay = caseSensitive ? lines[i] : lines[i].toLowerCase();
          const idx = lineHay.indexOf(q);
          if (idx >= 0) {
            results.push({
              file: f,
              line: i + 1,
              col: idx + 1,
              text: lines[i],
            });
            if (results.length >= limit) break;
          }
        }
        if (results.length >= limit) break;
      }

      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }
  },
);

server.tool(
  "get_backlinks",
  {
    target: z
      .string()
      .describe("Target page name, e.g. 'My Note' (matches [[My Note]])"),
  },
  async ({ target }) => {
    const files = await listMarkdownFiles();
    const backlinks: { from: string; matches: string[] }[] = [];

    for (const f of files) {
      const abs = assertInsideVault(f);
      const text = await fs.readFile(abs, "utf8");
      const links = extractWikiLinks(text);
      const hits = links.filter((x) => x === target);
      if (hits.length) backlinks.push({ from: f, matches: hits });
    }

    return {
      content: [{ type: "text", text: JSON.stringify(backlinks, null, 2) }],
    };
  },
);

server.tool("list_tags", {}, async () => {
  const files = await listMarkdownFiles();
  const tags = new Set<string>();

  for (const f of files) {
    const abs = assertInsideVault(f);
    const text = await fs.readFile(abs, "utf8");
    const parsed = matter(text);

    // frontmatter tags: string | string[]
    const fmTags = (parsed.data as any)?.tags;
    if (typeof fmTags === "string") tags.add(fmTags);
    if (Array.isArray(fmTags))
      fmTags.forEach((t) => typeof t === "string" && tags.add(t));

    extractInlineTags(parsed.content).forEach((t) => tags.add(t));
  }

  return {
    content: [
      { type: "text", text: JSON.stringify([...tags].sort(), null, 2) },
    ],
  };
});

function buildNoteContent(
  content: string,
  frontmatter?: Record<string, unknown>,
): string {
  if (frontmatter && Object.keys(frontmatter).length > 0) {
    return matter.stringify(content, frontmatter);
  }
  return content;
}

server.tool(
  "create_note",
  {
    path: z
      .string()
      .describe(
        "Path relative to vault root, e.g. 'Daily/2026-02-26.md'. Must end with .md",
      ),
    content: z.string().describe("Markdown body of the note"),
    frontmatter: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Optional YAML frontmatter as a JSON object"),
  },
  async ({ path: rel, content, frontmatter }) => {
    if (!rel.toLowerCase().endsWith(".md")) {
      return {
        content: [{ type: "text", text: "Error: path must end with .md" }],
        isError: true,
      };
    }

    const abs = assertInsideVault(rel);

    try {
      await fs.access(abs);
      return {
        content: [
          {
            type: "text",
            text: `Error: file already exists at '${rel}'. Use update_note to overwrite.`,
          },
        ],
        isError: true,
      };
    } catch {
      // file doesn't exist — proceed
    }

    await fs.mkdir(path.dirname(abs), { recursive: true });
    const text = buildNoteContent(content, frontmatter);
    await fs.writeFile(abs, text, "utf8");

    return {
      content: [{ type: "text", text: `Created: ${rel}` }],
    };
  },
);

server.tool(
  "update_note",
  {
    path: z
      .string()
      .describe("Path relative to vault root, e.g. 'Daily/2026-02-26.md'"),
    content: z.string().describe("New markdown body of the note"),
    frontmatter: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        "Optional YAML frontmatter as a JSON object. If omitted, existing frontmatter is preserved.",
      ),
  },
  async ({ path: rel, content, frontmatter }) => {
    const abs = assertInsideVault(rel);

    try {
      await fs.access(abs);
    } catch {
      return {
        content: [
          {
            type: "text",
            text: `Error: file not found at '${rel}'. Use create_note to create a new note.`,
          },
        ],
        isError: true,
      };
    }

    let fm = frontmatter;
    if (!fm) {
      const existing = await fs.readFile(abs, "utf8");
      const parsed = matter(existing);
      fm = parsed.data;
    }

    const text = buildNoteContent(content, fm);
    await fs.writeFile(abs, text, "utf8");

    return {
      content: [{ type: "text", text: `Updated: ${rel}` }],
    };
  },
);

server.tool(
  "append_to_note",
  {
    path: z
      .string()
      .describe("Path relative to vault root, e.g. 'Daily/2026-02-26.md'"),
    content: z
      .string()
      .describe("Markdown content to append at the end of the note"),
  },
  async ({ path: rel, content }) => {
    const abs = assertInsideVault(rel);

    try {
      await fs.access(abs);
    } catch {
      return {
        content: [
          {
            type: "text",
            text: `Error: file not found at '${rel}'. Use create_note to create a new note.`,
          },
        ],
        isError: true,
      };
    }

    const existing = await fs.readFile(abs, "utf8");
    const separator = existing.endsWith("\n") ? "" : "\n";
    await fs.writeFile(abs, existing + separator + content, "utf8");

    return {
      content: [{ type: "text", text: `Appended to: ${rel}` }],
    };
  },
);

server.tool(
  "update_frontmatter",
  {
    path: z
      .string()
      .describe("Path relative to vault root, e.g. 'Daily/2026-02-26.md'"),
    updates: z
      .record(z.string(), z.unknown())
      .describe("Key-value pairs to merge into the existing frontmatter"),
    deleteKeys: z
      .array(z.string())
      .optional()
      .describe("Optional list of frontmatter keys to remove"),
  },
  async ({ path: rel, updates, deleteKeys }) => {
    const abs = assertInsideVault(rel);

    try {
      await fs.access(abs);
    } catch {
      return {
        content: [
          {
            type: "text",
            text: `Error: file not found at '${rel}'.`,
          },
        ],
        isError: true,
      };
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

    return {
      content: [
        {
          type: "text",
          text: `Updated frontmatter of: ${rel}\n${JSON.stringify(fm, null, 2)}`,
        },
      ],
    };
  },
);

const DAILY_DATE_RE = /(\d{4}-\d{2}-\d{2})\.md$/;

server.tool(
  "list_daily_notes",
  {
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Start date (inclusive), e.g. '2026-01-01'"),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("End date (inclusive), e.g. '2026-02-28'"),
    limit: z.number().int().positive().max(500).default(30),
  },
  async ({ from, to, limit }) => {
    const files = await fg(["Daily/**/*.md"], {
      cwd: VAULT,
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

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

/** Resources **/

server.resource(
  "note",
  new ResourceTemplate("obsidian://note/{path}", {
    list: async () => {
      const files = await listMarkdownFiles();
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
    const note = await readNote(rel);
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

/** Prompts **/

server.prompt(
  "summarize_note",
  {
    path: z
      .string()
      .describe("Path relative to vault root, e.g. 'Projects/my-project.md'"),
  },
  async ({ path: rel }) => {
    const note = await readNote(rel);
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "resource" as const,
            resource: {
              uri: `obsidian://note/${rel}`,
              mimeType: "text/markdown",
              text: note.raw,
            },
          },
        },
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: "위 노트의 핵심 내용을 간결하게 요약해주세요.",
          },
        },
      ],
    };
  },
);

/** Connect transport **/
const transport = new StdioServerTransport();
await server.connect(transport);
