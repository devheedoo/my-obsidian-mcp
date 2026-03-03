import { z } from "zod";

export const notePathSchema = z
  .string()
  .describe("Path relative to vault root, e.g. 'Daily/2026-02-26.md'");

export const createNotePathSchema = z
  .string()
  .describe(
    "Path relative to vault root, e.g. 'Daily/2026-02-26.md'. Must end with .md",
  );

export const dailyDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const frontmatterSchema = z
  .record(z.string(), z.unknown())
  .describe("Optional YAML frontmatter as a JSON object");

export const listNotesArgs = {
  glob: z.string().optional().describe("Optional glob like '**/*.md'"),
};

export const getNoteArgs = {
  path: notePathSchema,
};

export const searchNotesArgs = {
  query: z.string().min(1),
  limit: z.number().int().positive().max(200).default(50),
  caseSensitive: z.boolean().default(false),
};

export const getBacklinksArgs = {
  target: z
    .string()
    .describe("Target page name, e.g. 'My Note' (matches [[My Note]])"),
};

export const createNoteArgs = {
  path: createNotePathSchema,
  content: z.string().describe("Markdown body of the note"),
  frontmatter: frontmatterSchema.optional(),
};

export const updateNoteArgs = {
  path: notePathSchema,
  content: z.string().describe("New markdown body of the note"),
  frontmatter: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Optional YAML frontmatter as a JSON object. If omitted, existing frontmatter is preserved.",
    ),
};

export const appendToNoteArgs = {
  path: notePathSchema,
  content: z
    .string()
    .describe("Markdown content to append at the end of the note"),
};

export const updateFrontmatterArgs = {
  path: notePathSchema,
  updates: z
    .record(z.string(), z.unknown())
    .describe("Key-value pairs to merge into the existing frontmatter"),
  deleteKeys: z
    .array(z.string())
    .optional()
    .describe("Optional list of frontmatter keys to remove"),
};

export const listDailyNotesArgs = {
  from: dailyDateSchema
    .optional()
    .describe("Start date (inclusive), e.g. '2026-01-01'"),
  to: dailyDateSchema
    .optional()
    .describe("End date (inclusive), e.g. '2026-02-28'"),
  limit: z.number().int().positive().max(500).default(30),
};

export const createDailyNoteArgs = {
  date: dailyDateSchema
    .optional()
    .describe("Date in YYYY-MM-DD format. Defaults to today."),
};

export const sectionNameSchema = z
  .string()
  .describe("Section heading name, e.g. 'Work', 'TIL', 'Log', 'Personal', 'Retro'");

export const getSectionArgs = {
  path: notePathSchema,
  section: sectionNameSchema,
};

export const appendToSectionArgs = {
  path: notePathSchema,
  section: sectionNameSchema,
  content: z.string().describe("Markdown content to append to the section"),
};

export const listTodosArgs = {
  from: dailyDateSchema
    .optional()
    .describe("Start date (inclusive), e.g. '2026-01-01'"),
  to: dailyDateSchema
    .optional()
    .describe("End date (inclusive), e.g. '2026-02-28'"),
  status: z
    .enum(["all", "pending", "done"])
    .default("all")
    .describe("Filter by todo status: 'all', 'pending' (unchecked), or 'done' (checked)"),
};
