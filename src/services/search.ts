import fs from "node:fs/promises";
import { spawn } from "node:child_process";

import { VaultApi } from "../vault.js";

type SearchResult = {
  file: string;
  line: number;
  col: number;
  text: string;
};

async function searchWithRipgrep(
  vaultRoot: string,
  query: string,
  limit: number,
  caseSensitive: boolean,
): Promise<string> {
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

  return new Promise<string>((resolve, reject) => {
    const p = spawn("rg", rgArgs, { cwd: vaultRoot });
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
}

async function searchWithFallback(
  vault: VaultApi,
  query: string,
  limit: number,
  caseSensitive: boolean,
): Promise<SearchResult[]> {
  const files = await vault.listMarkdownFiles();
  const results: SearchResult[] = [];
  const q = caseSensitive ? query : query.toLowerCase();

  for (const f of files) {
    const abs = vault.assertInsideVault(f);
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

  return results;
}

export async function searchNotesText(
  vault: VaultApi,
  query: string,
  limit: number,
  caseSensitive: boolean,
): Promise<string> {
  try {
    const out = await searchWithRipgrep(vault.vaultRoot, query, limit, caseSensitive);
    return out || "";
  } catch {
    const fallbackResults = await searchWithFallback(
      vault,
      query,
      limit,
      caseSensitive,
    );
    return JSON.stringify(fallbackResults, null, 2);
  }
}
