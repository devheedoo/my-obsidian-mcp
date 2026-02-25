# my-obsidian-mcp

Obsidian Vault를 읽어주는 MCP(Model Context Protocol) 서버입니다.
Cursor, Claude Desktop 등 MCP를 지원하는 AI 클라이언트에서 Obsidian 노트를 검색하고 조회할 수 있습니다.

## Tools

| Tool | 설명 |
| --- | --- |
| `list_notes` | Vault 내 마크다운 파일 목록을 반환합니다. glob 패턴으로 필터링할 수 있습니다. |
| `get_note` | 특정 노트의 frontmatter와 본문을 반환합니다. |
| `search_notes` | 키워드로 노트를 검색합니다. ripgrep이 있으면 우선 사용하고, 없으면 JS 스캔으로 폴백합니다. |
| `get_backlinks` | 특정 페이지를 `[[wikilink]]`로 참조하는 노트 목록을 반환합니다. |
| `list_tags` | Vault 전체의 태그(frontmatter + 인라인 `#tag`)를 수집하여 반환합니다. |

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
      "args": ["tsx", "/absolute/path/to/my-obsidian-mcp/src/index.ts", "/path/to/your/ObsidianVault"]
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
      "args": ["tsx", "/absolute/path/to/my-obsidian-mcp/src/index.ts", "/path/to/your/ObsidianVault"]
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
