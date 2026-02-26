import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  PromptResult,
  userResourceMessage,
  userTextMessage,
} from "./prompts/messages.js";
import {
  dailyReviewPromptArgs,
  summarizeNotePromptArgs,
} from "./prompts/schemas.js";
import { VaultApi } from "./vault.js";

export function registerPrompts(server: McpServer, vault: VaultApi) {
  server.prompt("summarize_note", summarizeNotePromptArgs, async ({ path: rel }): Promise<PromptResult> => {
      const note = await vault.readNote(rel);
      return {
        messages: [
          userResourceMessage(`obsidian://note/${rel}`, "text/markdown", note.raw),
          userTextMessage("위 노트의 핵심 내용을 간결하게 요약해주세요."),
        ],
      };
    },
  );

  server.prompt("daily_review", dailyReviewPromptArgs, async ({ date }): Promise<PromptResult> => {
      const targetDate = date ?? new Date().toISOString().slice(0, 10);
      const rel = await vault.findDailyNote(targetDate);

      if (!rel) {
        return {
          messages: [userTextMessage(`${targetDate}에 해당하는 Daily Note를 찾을 수 없습니다.`)],
        };
      }

      const note = await vault.readNote(rel);
      return {
        messages: [
          userResourceMessage(`obsidian://note/${rel}`, "text/markdown", note.raw),
          userTextMessage(
            `위는 ${targetDate}의 Daily Note입니다. 오늘 하루를 돌아보며 다음을 정리해주세요:\n1. 주요 완료 사항\n2. 진행 중인 작업\n3. 내일 할 일 제안\n4. 간단한 회고 한 줄`,
          ),
        ],
      };
    },
  );
}
