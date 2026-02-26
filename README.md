# my-obsidian-mcp

Obsidian Vault를 읽고 쓸 수 있는 MCP(Model Context Protocol) 서버입니다.
Cursor, Claude Desktop 등 MCP를 지원하는 AI 클라이언트에서 Obsidian 노트를 검색, 조회, 생성, 수정할 수 있습니다.

## Tools

### 읽기

| Tool               | 설명                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `list_notes`       | Vault 내 마크다운 파일 목록을 반환합니다. glob 패턴으로 필터링할 수 있습니다.                                                                          |
| `get_note`         | 특정 노트의 frontmatter와 본문을 반환합니다.                                                                                                           |
| `search_notes`     | 키워드로 노트를 검색합니다. ripgrep이 있으면 우선 사용하고, 없으면 JS 스캔으로 폴백합니다.                                                             |
| `get_backlinks`    | 특정 페이지를 `[[wikilink]]`로 참조하는 노트 목록을 반환합니다.                                                                                        |
| `list_tags`        | Vault 전체의 태그(frontmatter + 인라인 `#tag`)를 수집하여 반환합니다.                                                                                  |
| `list_daily_notes` | Daily Note 목록을 조회합니다. `Daily/YYYY-MM-DD.md`, `Daily/YYYY/MM/YYYY-MM-DD.md` 패턴을 모두 지원하며, `from`/`to` 날짜 범위로 필터링할 수 있습니다. |

### 쓰기

| Tool                 | 설명                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `create_note`        | 새 노트를 생성합니다. 이미 존재하는 파일이면 에러를 반환합니다. 중간 디렉토리는 자동 생성됩니다.                                 |
| `update_note`        | 기존 노트를 덮어씁니다. frontmatter를 생략하면 기존 frontmatter가 유지됩니다.                                                    |
| `append_to_note`     | 기존 노트 끝에 내용을 추가합니다.                                                                                                |
| `update_frontmatter` | 기존 노트의 frontmatter를 부분적으로 수정합니다. `updates`로 key-value를 merge하고, `deleteKeys`로 특정 키를 제거할 수 있습니다. |

## Resources

| URI 패턴                 | 설명                                                                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `obsidian://note/{path}` | Resource 노출 대상을 제한합니다. `daily-notes/YYYY-MM-DD-요일.md` 패턴의 문서만 노출됩니다. 일반 노트 조회는 Tool(`get_note`, `search_notes`) 사용을 권장합니다. |

## Prompts

| Prompt           | 설명                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `summarize_note` | 노트 경로를 받아 해당 노트의 요약을 요청하는 프롬프트 템플릿입니다.                                                                      |
| `daily_review`   | 특정 날짜(기본: 오늘)의 Daily Note를 읽어 회고를 도와주는 프롬프트 템플릿입니다. 완료 사항, 진행 중 작업, 내일 할 일, 회고를 정리합니다. |

## 설치

```bash
npm install
```

### 선택 사항

`search_notes`의 빠른 검색을 위해 [ripgrep](https://github.com/BurntSushi/ripgrep)을 설치하는 것을 권장합니다.

```bash
# macOS
brew install ripgrep
```

## 실행

```bash
# 개발 (tsx)
npm run dev -- /path/to/your/ObsidianVault

# 빌드 후 실행
npm run build
npm start -- /path/to/your/ObsidianVault
```

## MCP 클라이언트 설정

### Cursor

`~/.cursor/mcp.json` (또는 프로젝트 `.cursor/mcp.json`)에 아래와 같이 추가합니다.

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": [
        "tsx",
        "/absolute/path/to/my-obsidian-mcp/src/index.ts",
        "/path/to/your/ObsidianVault"
      ]
    }
  }
}
```

### Claude Desktop

`claude_desktop_config.json`에 추가합니다.

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": [
        "tsx",
        "/absolute/path/to/my-obsidian-mcp/src/index.ts",
        "/path/to/your/ObsidianVault"
      ]
    }
  }
}
```

## 기술 스택

- **TypeScript** — ES2022, NodeNext 모듈
- **@modelcontextprotocol/sdk** — MCP 서버 구현 (stdio transport)
- **fast-glob** — 파일 탐색
- **gray-matter** — frontmatter 파싱
- **zod** — 입력 스키마 검증
