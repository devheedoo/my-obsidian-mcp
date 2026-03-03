import { z } from "zod";

export const summarizeNotePromptArgs = {
  path: z
    .string()
    .describe("Path relative to vault root, e.g. 'daily-notes/2026-02-26-Thu.md'"),
};

export const dailyReviewPromptArgs = {
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Date in YYYY-MM-DD format. Defaults to today."),
};
