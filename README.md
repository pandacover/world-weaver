# world-weaver

Interactive auto-generating novel engine (TUI).

You set the premise, cast, player character, and boundaries. The story progresses through a custom Effect agent loop. Talk to characters in chat, act on the environment, and keep long-term per-character memory in Supermemory.

## Stack

- **Bun** runtime
- **OpenTUI** (`@opentui/react`) terminal UI
- **Effect** services + custom agent loop
- **Bun SQLite** for novels / scenes / transcript
- **Supermemory Cloud** for character memory
- **LLM provider adapter** (OpenAI-compatible wire): `openai` | `openrouter` | `openai-compatible`

## Setup

```bash
bun install
cp .env.example .env   # or export vars in your shell
bun run start
```

### Environment

| Variable | Description |
|---|---|
| `LLM_PROVIDER` | `openai` \| `openrouter` \| `openai-compatible` (default `openrouter`) |
| `LLM_API_KEY` | Provider API key |
| `LLM_MODEL` | Model id (OpenRouter example: `openai/gpt-4o-mini`) |
| `LLM_BASE_URL` | Required for `openai-compatible` |
| `OPENROUTER_HTTP_REFERER` | Optional OpenRouter header |
| `OPENROUTER_X_TITLE` | Optional OpenRouter header (default `world-weaver`) |
| `SUPERMEMORY_API_KEY` | Optional; without it, memory seed/recall no-ops |
| `WORLD_WEAVER_HOME` | Data dir (default `~/.world-weaver`) |

OpenRouter example:

```bash
export LLM_PROVIDER=openrouter
export LLM_API_KEY=sk-or-...
export LLM_MODEL=openai/gpt-4o-mini
export SUPERMEMORY_API_KEY=sm_...
bun run start
```

## Play commands

| Input | Effect |
|---|---|
| `@Name hello` | Talk to a named character |
| bare text | Chat with focused NPC (Tab cycles focus) |
| `/act open the door` | Player action; director resolves environment |
| `/look` | Describe the current scene |
| `/continue` | Advance one story beat |
| `/info` | Show chapter / scene / cast |
| `Esc` | Return home |

## Scripts

- `bun run start` — OpenTUI app
- `bun run dev` — watch mode
- `bun run smoke` — SQLite + harness + provider adapter smoke test (no live LLM)
- `bun run typecheck` — TypeScript check

## Architecture (short)

- `src/store` — Bun SQLite story state
- `src/memory` — Supermemory per-character containers
- `src/llm` — provider adapter → Effect `LanguageModel`
- `src/agent` — director/character loop, tools, boundary harnesses
- `src/tui` — OpenTUI screens
