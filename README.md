# my-obsidian-mcp

Obsidian Vault를 읽고 쓸 수 있는 MCP(Model Context Protocol) 서버입니다.
Cursor, Claude Desktop 등 MCP를 지원하는 AI 클라이언트에서 Obsidian 노트를 검색, 조회, 생성, 수정할 수 있습니다.

## Tools

### 읽기

| Tool               | 인자                                    | 설명                                                                                                        |
| ------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `list_notes`       | `glob?`                                 | Vault 내 마크다운 파일 목록을 반환합니다. glob 패턴으로 필터링할 수 있습니다.                               |
| `get_note`         | `path`                                  | 특정 노트의 frontmatter와 본문을 반환합니다.                                                                |
| `get_section`      | `path`, `section`                       | 특정 노트의 `## Section` 하나만 추출하여 반환합니다. 섹션명은 대소문자를 구분하지 않습니다.                 |
| `search_notes`     | `query`, `limit?`, `caseSensitive?`     | 키워드로 노트를 검색합니다. ripgrep이 있으면 우선 사용하고, 없으면 JS 스캔으로 폴백합니다.                  |
| `get_backlinks`    | `target`                                | 특정 페이지를 `[[wikilink]]`로 참조하는 노트 목록을 반환합니다.                                             |
| `list_tags`        | —                                       | Vault 전체의 태그(frontmatter + 인라인 `#tag`)를 수집하여 반환합니다.                                       |
| `list_daily_notes` | `from?`, `to?`, `limit?`                | Daily Note 목록을 조회합니다. `daily-notes/YYYY-MM-DD-Day.md`, `daily-notes/YYYY/MM/YYYY-MM-DD-Day.md` 패턴을 지원하며, `from`/`to` 날짜 범위로 필터링할 수 있습니다. |
| `list_todos`       | `from?`, `to?`, `status?`               | Daily Note에서 `- [ ]`/`- [x]` 항목을 파싱하여 반환합니다. `status`는 `all`(기본값)·`pending`·`done`을 지원합니다. 각 항목에 출처 파일, 날짜, 섹션명이 포함됩니다. |

### 쓰기

| Tool                  | 인자                                      | 설명                                                                                                                             |
| --------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `create_note`         | `path`, `content`, `frontmatter?`         | 새 노트를 생성합니다. 이미 존재하는 파일이면 에러를 반환합니다. 중간 디렉토리는 자동 생성됩니다.                                 |
| `update_note`         | `path`, `content`, `frontmatter?`         | 기존 노트를 덮어씁니다. frontmatter를 생략하면 기존 frontmatter가 유지됩니다.                                                    |
| `append_to_note`      | `path`, `content`                         | 기존 노트 끝에 내용을 추가합니다.                                                                                                |
| `append_to_section`   | `path`, `section`, `content`              | 특정 `## Section` 끝에 내용을 삽입합니다. 섹션이 존재하지 않으면 에러를 반환합니다.                                             |
| `update_frontmatter`  | `path`, `updates`, `deleteKeys?`          | 기존 노트의 frontmatter를 부분적으로 수정합니다. `updates`로 key-value를 merge하고, `deleteKeys`로 특정 키를 제거할 수 있습니다. |

### Daily Note

| Tool                | 인자    | 설명                                                                                                                                        |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_daily_note` | `date?` | `daily-notes/template.md`를 기반으로 새 Daily Note를 생성합니다. 날짜를 생략하면 오늘 날짜를 사용합니다. 파일명에 요일 접미사(`-Thu`)가 자동으로 추가되며, `{{date}}` 플레이스홀더가 실제 날짜로 치환됩니다. |

## Resources

| URI 패턴                 | 설명                                                                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `obsidian://note/{path}` | Resource 목록은 `daily-notes` 폴더 바로 아래의 `.md` 파일(`daily-notes/*.md`)만 노출합니다. 일반 노트 조회는 Tool(`get_note`, `search_notes`) 사용을 권장합니다. |

## Prompts

| Prompt           | 설명                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `summarize_note` | 노트 경로를 받아 해당 노트의 요약을 요청하는 프롬프트 템플릿입니다.                                                                      |
| `daily_review`   | 특정 날짜(기본: 오늘)의 Daily Note를 읽어 회고를 도와주는 프롬프트 템플릿입니다. 완료 사항, 진행 중 작업, 내일 할 일, 회고를 정리합니다. |

## 활용 사례 (Use Cases)

### 1) 주간 회고 자동 생성 + 메타데이터 정리

- **상황**: 주간 Daily Note를 기반으로 회고 문서를 만들고, 태그/상태를 일관되게 정리하고 싶을 때
- **미니 플레이북**:
  1. `list_daily_notes(from, to)`로 주간 대상 수집
  2. 핵심 노트를 `get_section(path, "TIL")`로 학습 내용만 추출
  3. `create_note`로 `Weekly/YYYY-Www.md` 생성
  4. `update_frontmatter`로 `tags`, `status`, `sourceNotes` 보강

### 2) 프로젝트 상태보드 반자동 갱신

- **상황**: 프로젝트 진행상황이 여러 노트에 흩어져 있어 한 곳에서 보기 어렵고, 주기적으로 상태보드가 필요할 때
- **미니 플레이북**:
  1. `search_notes`로 상태 관련 키워드 수집 (`status`, `blocked`, `next` 등)
  2. 관련 노트들을 `get_note`로 집계
  3. 보드 노트를 `update_note`로 전체 재생성 (표/섹션)
  4. 필요 시 `update_frontmatter`로 `updatedAt`, `owner` 반영

### 3) 백링크 기반 지식 그래프 정비

- **상황**: 핵심 노트가 고립되어 있고, 관련 문서 연결을 강화하고 싶을 때
- **미니 플레이북**:
  1. `get_backlinks(target)`로 연결 빈약 노트 식별
  2. `search_notes`로 연관 후보 문서 찾기
  3. 추천 링크 문장을 생성해서 `append_to_section(path, "Related")`로 섹션에 보강

### 4) 장애/운영 기록 포스트모템 문서화

- **상황**: Daily Note와 운영 로그에 흩어진 사건 기록을 정형화된 포스트모템으로 남기고 싶을 때
- **미니 플레이북**:
  1. `search_notes`로 사건 키워드/에러코드 검색
  2. 관련 일자 노트를 `get_note`로 수집
  3. 타임라인/원인/재발방지 템플릿 문서를 `create_note`로 생성
  4. `update_frontmatter`로 severity, owner, followUpDue 추가

### 5) 태그 기반 월간 큐레이션 노트 작성

- **상황**: 월간 학습/업무 노트 중 특정 태그 주제만 뽑아 digest 형태로 공유하고 싶을 때
- **미니 플레이북**:
  1. `list_tags`로 태그 후보 탐색
  2. `search_notes("#태그")`로 후보 노트 수집
  3. 요약/선정 이유를 포함한 digest를 `create_note`로 작성
  4. 다음 달엔 `update_note`로 누적판 갱신

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
- **vitest** — 단위/통합 테스트 (`npm test`)
