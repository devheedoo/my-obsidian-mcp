import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  DAILY_DATE_RE,
  appendToSection,
  createVaultApi,
  extractInlineTags,
  extractWikiLinks,
  parseNoteSections,
} from "../vault.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, "fixtures");

// ---------------------------------------------------------------------------
// DAILY_DATE_RE
// ---------------------------------------------------------------------------
describe("DAILY_DATE_RE", () => {
  it("matches YYYY-MM-DD-Day.md and captures date", () => {
    const m = DAILY_DATE_RE.exec("daily-notes/2026-02-26-Thu.md");
    expect(m).not.toBeNull();
    expect(m![1]).toBe("2026-02-26");
  });

  it("matches fe-weekly variant", () => {
    const m = DAILY_DATE_RE.exec("daily-notes/2026-01-09-fe-weekly.md");
    expect(m).not.toBeNull();
    expect(m![1]).toBe("2026-01-09");
  });

  it("matches multi-suffix like Mon-1y", () => {
    const m = DAILY_DATE_RE.exec("daily-notes/2026-01-26-Mon-1y.md");
    expect(m).not.toBeNull();
    expect(m![1]).toBe("2026-01-26");
  });

  it("does not match template.md", () => {
    expect(DAILY_DATE_RE.exec("daily-notes/template.md")).toBeNull();
  });

  it("does not match non-md files", () => {
    expect(DAILY_DATE_RE.exec("2026-02-26-Thu.txt")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractWikiLinks
// ---------------------------------------------------------------------------
describe("extractWikiLinks", () => {
  it("extracts simple wiki links", () => {
    expect(extractWikiLinks("See [[Page A]] and [[Page B]]")).toEqual([
      "Page A",
      "Page B",
    ]);
  });

  it("extracts aliased wiki links (captures target, not alias)", () => {
    expect(extractWikiLinks("[[Target|Display Name]]")).toEqual(["Target"]);
  });

  it("returns empty array for no links", () => {
    expect(extractWikiLinks("No links here")).toEqual([]);
  });

  it("handles multiple links in same line", () => {
    expect(extractWikiLinks("[[A]] text [[B]] more [[C]]")).toEqual([
      "A",
      "B",
      "C",
    ]);
  });
});

// ---------------------------------------------------------------------------
// extractInlineTags
// ---------------------------------------------------------------------------
describe("extractInlineTags", () => {
  it("extracts inline tags", () => {
    const tags = extractInlineTags("#daily #log some text #til");
    expect(tags).toContain("daily");
    expect(tags).toContain("log");
    expect(tags).toContain("til");
  });

  it("extracts nested tags with slash", () => {
    expect(extractInlineTags("see #project/mcp")).toContain("project/mcp");
  });

  it("deduplicates tags", () => {
    const tags = extractInlineTags("#daily #daily #daily");
    expect(tags.filter((t) => t === "daily")).toHaveLength(1);
  });

  it("does not treat markdown headings as tags", () => {
    const tags = extractInlineTags("## Heading\n#tag");
    expect(tags).not.toContain("");
    expect(tags).toContain("tag");
  });
});

// ---------------------------------------------------------------------------
// parseNoteSections
// ---------------------------------------------------------------------------
describe("parseNoteSections", () => {
  it("parses daily note with multiple sections", () => {
    const raw = ` #daily #log

- Heedo

---
## Log

07:35- morning

---
## Work

task list

---
## TIL

learned something
`;
    const sections = parseNoteSections(raw);
    const names = sections.map((s) => s.name);

    expect(names).toContain("_preamble");
    expect(names).toContain("Log");
    expect(names).toContain("Work");
    expect(names).toContain("TIL");
  });

  it("trims trailing --- separators from section content", () => {
    const raw = `## Log

some content

---
## Work

work stuff
`;
    const sections = parseNoteSections(raw);
    const log = sections.find((s) => s.name === "Log");
    expect(log?.content).not.toContain("---");
    expect(log?.content).toBe("some content");
  });

  it("handles note with frontmatter", () => {
    const raw = `---
title: Test
tags: [a, b]
---

preamble

## Section

content
`;
    const sections = parseNoteSections(raw);
    expect(sections[0].name).toBe("_preamble");
    expect(sections[1].name).toBe("Section");
    expect(sections[1].content).toBe("content");
  });

  it("handles empty sections", () => {
    const raw = `## Empty

---
## HasContent

hello
`;
    const sections = parseNoteSections(raw);
    const empty = sections.find((s) => s.name === "Empty");
    expect(empty?.content).toBe("");
  });
});

// ---------------------------------------------------------------------------
// appendToSection
// ---------------------------------------------------------------------------
describe("appendToSection", () => {
  const baseNote = `## Log

existing log

---
## Work

existing work

---
## TIL

`;

  it("appends to a section with existing content", () => {
    const result = appendToSection(baseNote, "Work", "new task");
    expect(result).toContain("existing work");
    expect(result).toContain("new task");
    const workIdx = result.indexOf("existing work");
    const newIdx = result.indexOf("new task");
    expect(newIdx).toBeGreaterThan(workIdx);
  });

  it("appends to an empty section", () => {
    const result = appendToSection(baseNote, "TIL", "learned vitest");
    expect(result).toContain("learned vitest");
  });

  it("throws for non-existent section", () => {
    expect(() => appendToSection(baseNote, "NonExistent", "content")).toThrow(
      'Section "## NonExistent" not found',
    );
  });

  it("preserves sections before and after target", () => {
    const result = appendToSection(baseNote, "Work", "new line");
    expect(result).toContain("## Log");
    expect(result).toContain("existing log");
    expect(result).toContain("## TIL");
  });
});

// ---------------------------------------------------------------------------
// createVaultApi
// ---------------------------------------------------------------------------
describe("createVaultApi", () => {
  const vault = createVaultApi(FIXTURES);

  describe("assertInsideVault", () => {
    it("resolves valid relative path", () => {
      const abs = vault.assertInsideVault("daily-notes/2026-02-26-Thu.md");
      expect(abs).toBe(
        path.resolve(FIXTURES, "daily-notes/2026-02-26-Thu.md"),
      );
    });

    it("throws on path traversal", () => {
      expect(() => vault.assertInsideVault("../../etc/passwd")).toThrow(
        "Path escapes vault",
      );
    });
  });

  describe("readNote", () => {
    it("reads a note without frontmatter", async () => {
      const note = await vault.readNote("daily-notes/2026-02-26-Thu.md");
      expect(note.path).toBe("daily-notes/2026-02-26-Thu.md");
      expect(note.content).toContain("#daily");
      expect(note.raw).toContain("## Work");
    });

    it("reads a note with frontmatter", async () => {
      const note = await vault.readNote("projects/sample-project.md");
      expect(note.frontmatter.title).toBe("My Obsidian MCP");
      expect(note.frontmatter.status).toBe("active");
      expect(note.content).toContain("# My Obsidian MCP");
    });
  });

  describe("buildNoteContent", () => {
    it("builds content with frontmatter", () => {
      const result = vault.buildNoteContent("body", { title: "Test" });
      expect(result).toContain("---");
      expect(result).toContain("title: Test");
      expect(result).toContain("body");
    });

    it("returns plain content when no frontmatter", () => {
      const result = vault.buildNoteContent("just body");
      expect(result).toBe("just body");
    });

    it("returns plain content for empty frontmatter", () => {
      const result = vault.buildNoteContent("body", {});
      expect(result).toBe("body");
    });
  });

  describe("listMarkdownFiles", () => {
    it("lists all markdown files sorted", async () => {
      const files = await vault.listMarkdownFiles();
      expect(files.length).toBeGreaterThanOrEqual(5);
      expect(files).toContain("daily-notes/2026-02-26-Thu.md");
      expect(files).toContain("projects/sample-project.md");

      const sorted = [...files].sort((a, b) => a.localeCompare(b));
      expect(files).toEqual(sorted);
    });
  });

  describe("findDailyNote / findDailyNotes", () => {
    it("finds daily note by date", async () => {
      const note = await vault.findDailyNote("2026-02-25");
      expect(note).toBe("daily-notes/2026-02-25-Wed.md");
    });

    it("finds multiple notes for same date", async () => {
      const notes = await vault.findDailyNotes("2026-02-26");
      expect(notes.length).toBe(2);
      expect(notes).toContain("daily-notes/2026-02-26-Thu.md");
      expect(notes).toContain("daily-notes/2026-02-26-fe-weekly.md");
    });

    it("returns null for non-existent date", async () => {
      const note = await vault.findDailyNote("2099-01-01");
      expect(note).toBeNull();
    });

    it("returns empty array for non-existent date (findDailyNotes)", async () => {
      const notes = await vault.findDailyNotes("2099-01-01");
      expect(notes).toEqual([]);
    });
  });
});
