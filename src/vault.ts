import fs from "node:fs/promises";
import path from "node:path";

import fg from "fast-glob";
import matter from "gray-matter";

export type Frontmatter = Record<string, unknown>;

export type NoteData = {
  path: string;
  frontmatter: Frontmatter;
  content: string;
  raw: string;
};

export const DAILY_DATE_RE = /(\d{4}-\d{2}-\d{2})(?:-[A-Za-z0-9]+)*\.md$/;

export function extractWikiLinks(markdown: string): string[] {
  // [[Page]] or [[Page|Alias]]
  const out: string[] = [];
  const re = /\[\[([^\]\|#]+)(?:\|[^\]]+)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown))) out.push(m[1].trim());
  return out;
}

export function extractInlineTags(markdown: string): string[] {
  // very simple: #tag (avoid # in code fences? keep simple for v1)
  const out = new Set<string>();
  const re = /(^|\s)#([A-Za-z0-9/_-]+)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown))) out.add(m[2]);
  return [...out];
}

export type NoteSection = {
  name: string;
  content: string;
};

/**
 * Split note body (after frontmatter) into sections by `## Heading` lines.
 * Trailing `---` separators at the end of each section are trimmed.
 */
export function parseNoteSections(raw: string): NoteSection[] {
  const parsed = matter(raw);
  const body = parsed.content;
  const lines = body.split("\n");
  const sections: NoteSection[] = [];

  let currentName = "_preamble";
  let currentLines: string[] = [];

  for (const line of lines) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) {
      sections.push({ name: currentName, content: trimSeparator(currentLines) });
      currentName = heading[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  sections.push({ name: currentName, content: trimSeparator(currentLines) });
  return sections;
}

function trimSeparator(lines: string[]): string {
  let end = lines.length;
  while (end > 0 && lines[end - 1].trim() === "") end--;
  if (end > 0 && lines[end - 1].trim() === "---") end--;
  while (end > 0 && lines[end - 1].trim() === "") end--;
  return lines.slice(0, end).join("\n").trim();
}

/**
 * Append content to a specific `## Section` in a note.
 * Works on raw text (preserving frontmatter).
 * Returns the modified raw text.
 */
export function appendToSection(
  raw: string,
  sectionName: string,
  contentToAppend: string,
): string {
  const lines = raw.split("\n");
  const sectionStart = lines.findIndex(
    (l) => /^## (.+)$/.exec(l)?.[1]?.trim() === sectionName,
  );
  if (sectionStart === -1) {
    throw new Error(`Section "## ${sectionName}" not found`);
  }

  let sectionEnd = lines.length;
  for (let i = sectionStart + 1; i < lines.length; i++) {
    if (/^---$/.test(lines[i].trim()) || /^## /.test(lines[i])) {
      sectionEnd = i;
      break;
    }
  }

  const before = lines.slice(0, sectionEnd);
  const after = lines.slice(sectionEnd);

  const lastContentLine = before.length - 1;
  let insertAt = lastContentLine + 1;
  while (insertAt > sectionStart + 1 && before[insertAt - 1].trim() === "") {
    insertAt--;
  }

  const result = [
    ...before.slice(0, insertAt),
    ...(insertAt > sectionStart + 1 ? [""] : [""]),
    ...contentToAppend.split("\n"),
    "",
    ...before.slice(insertAt),
    ...after,
  ];

  return result.join("\n");
}

export type VaultApi = {
  vaultRoot: string;
  assertInsideVault: (p: string) => string;
  listMarkdownFiles: () => Promise<string[]>;
  readNote: (relPath: string) => Promise<NoteData>;
  buildNoteContent: (content: string, frontmatter?: Frontmatter) => string;
  findDailyNote: (date: string) => Promise<string | null>;
  findDailyNotes: (date: string) => Promise<string[]>;
};

export function createVaultApi(vaultRoot: string): VaultApi {
  function assertInsideVault(p: string) {
    const abs = path.resolve(vaultRoot, p);
    if (!abs.startsWith(vaultRoot + path.sep) && abs !== vaultRoot) {
      throw new Error("Path escapes vault");
    }
    return abs;
  }

  async function listMarkdownFiles() {
    return fg(["**/*.md"], { cwd: vaultRoot, dot: true, onlyFiles: true }).then(
      (xs) => xs.sort((a, b) => a.localeCompare(b)),
    );
  }

  async function readNote(relPath: string): Promise<NoteData> {
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

  function buildNoteContent(content: string, frontmatter?: Frontmatter): string {
    if (frontmatter && Object.keys(frontmatter).length > 0) {
      return matter.stringify(content, frontmatter);
    }
    return content;
  }

  async function findDailyNotes(date: string): Promise<string[]> {
    const [yyyy, mm] = date.split("-");
    const patterns = [
      `daily-notes/${date}-*.md`,
      `daily-notes/${yyyy}/${mm}/${date}-*.md`,
    ];
    const files = await fg(patterns, {
      cwd: vaultRoot,
      onlyFiles: true,
    });
    return files.sort();
  }

  async function findDailyNote(date: string): Promise<string | null> {
    const files = await findDailyNotes(date);
    return files[0] ?? null;
  }

  return {
    vaultRoot,
    assertInsideVault,
    listMarkdownFiles,
    readNote,
    buildNoteContent,
    findDailyNote,
    findDailyNotes,
  };
}
