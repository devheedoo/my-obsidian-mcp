import { z } from "zod";

export const summarizeNotePromptArgs = {
  path: z
    .string()
    .describe("Path relative to vault root, e.g. 'Projects/my-project.md'"),
};

export const dailyReviewPromptArgs = {
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Date in YYYY-MM-DD format. Defaults to today."),
};
