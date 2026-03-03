import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import fg from "fast-glob";

import {
  DAILY_DATE_RE,
  createVaultApi,
  parseNoteSections,
  type VaultApi,
} from "../vault.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, "fixtures");

// ---------------------------------------------------------------------------
// create_daily_note logic
// ---------------------------------------------------------------------------
describe("create_daily_note logic", () => {
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const TEMPLATE_PATH = "daily-notes/template.md";

  let tmpDir: string;
  let vault: VaultApi;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-test-"));
    await fs.cp(FIXTURES, tmpDir, { recursive: true });
    vault = createVaultApi(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates a daily note with correct filename and day suffix", async () => {
    const targetDate = "2026-03-01";
    const dayOfWeek = DAY_NAMES[new Date(targetDate + "T00:00:00").getDay()];
    expect(dayOfWeek).toBe("Sun");

    const fileName = `${targetDate}-${dayOfWeek}.md`;
    const rel = `daily-notes/${fileName}`;
    const abs = vault.assertInsideVault(rel);

    const templateAbs = vault.assertInsideVault(TEMPLATE_PATH);
    const templateContent = await fs.readFile(templateAbs, "utf8");
    const content = templateContent.replace(/\{\{date\}\}/g, targetDate);

    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, "utf8");

    const written = await fs.readFile(abs, "utf8");
    expect(written).toContain("date: 2026-03-01");
    expect(written).not.toContain("{{date}}");
    expect(written).toContain("## Log");
    expect(written).toContain("## Retro");
  });

  it("detects existing daily note and prevents duplicate", async () => {
    const existing = await vault.findDailyNotes("2026-02-26");
    expect(existing.length).toBeGreaterThan(0);
  });

  it("returns empty for non-existent date (safe to create)", async () => {
    const existing = await vault.findDailyNotes("2026-03-01");
    expect(existing).toEqual([]);
  });

  it("generates correct day-of-week for various dates", () => {
    const cases: [string, string][] = [
      ["2026-02-26", "Thu"],
      ["2026-02-27", "Fri"],
      ["2026-03-01", "Sun"],
      ["2026-01-05", "Mon"],
    ];
    for (const [date, expected] of cases) {
      const day = DAY_NAMES[new Date(date + "T00:00:00").getDay()];
      expect(day).toBe(expected);
    }
  });
});

// ---------------------------------------------------------------------------
// list_todos logic
// ---------------------------------------------------------------------------
describe("list_todos logic", () => {
  const vault = createVaultApi(FIXTURES);

  async function collectTodos(
    from?: string,
    to?: string,
    status: "all" | "pending" | "done" = "all",
  ) {
    const files = await fg(["daily-notes/**/*.md"], {
      cwd: vault.vaultRoot,
      dot: true,
      onlyFiles: true,
    });

    const TODO_RE = /^(\s*)- \[([ xX])\] (.+)$/;
    const todos: {
      file: string;
      date: string;
      section: string;
      text: string;
      done: boolean;
    }[] = [];

    for (const f of files) {
      const m = DAILY_DATE_RE.exec(f);
      if (!m) continue;
      const date = m[1];
      if (from && date < from) continue;
      if (to && date > to) continue;

      const abs = vault.assertInsideVault(f);
      const raw = await fs.readFile(abs, "utf8");
      const sections = parseNoteSections(raw);

      for (const sec of sections) {
        for (const line of sec.content.split("\n")) {
          const tm = TODO_RE.exec(line);
          if (!tm) continue;
          const done = tm[2] !== " ";
          if (status === "pending" && done) continue;
          if (status === "done" && !done) continue;
          todos.push({ file: f, date, section: sec.name, text: tm[3], done });
        }
      }
    }

    todos.sort((a, b) => b.date.localeCompare(a.date));
    return todos;
  }

  it("collects all todos from fixtures", async () => {
    const todos = await collectTodos();
    expect(todos.length).toBeGreaterThan(0);

    const texts = todos.map((t) => t.text);
    expect(texts).toContain("테스트 자동화 문서 작성");
    expect(texts).toContain("PR 리뷰 완료");
  });

  it("filters pending todos only", async () => {
    const todos = await collectTodos(undefined, undefined, "pending");
    expect(todos.every((t) => !t.done)).toBe(true);
    expect(todos.length).toBeGreaterThan(0);
  });

  it("filters done todos only", async () => {
    const todos = await collectTodos(undefined, undefined, "done");
    expect(todos.every((t) => t.done)).toBe(true);
    expect(todos.length).toBeGreaterThan(0);
  });

  it("filters by date range", async () => {
    const todos = await collectTodos("2026-02-26", "2026-02-26");
    expect(todos.every((t) => t.date === "2026-02-26")).toBe(true);
  });

  it("includes section name for each todo", async () => {
    const todos = await collectTodos();
    const workTodos = todos.filter((t) => t.section === "Work");
    expect(workTodos.length).toBeGreaterThan(0);
  });

  it("returns sorted by date descending", async () => {
    const todos = await collectTodos();
    for (let i = 1; i < todos.length; i++) {
      expect(todos[i - 1].date >= todos[i].date).toBe(true);
    }
  });

  it("skips template.md (no date match)", async () => {
    const todos = await collectTodos();
    expect(todos.every((t) => !t.file.includes("template"))).toBe(true);
  });
});
