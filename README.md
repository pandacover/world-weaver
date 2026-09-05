# World Weaver

Short film generator — TypeScript + Bun + OpenRouter.

Turn a **Premise** into a playable **Short Film**: OpenRouter writes a **Screenplay**, renders per-**Scene** **Media** (video clips or stills), and plays it in the **Film Player**.

## Quick start

```bash
bun install
cp .env.example .env   # add OPENROUTER_API_KEY
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). You can also paste an API key in the UI.

## Scripts

| Command | Purpose |
| --- | --- |
| `bun run dev` | Hot-reload server |
| `bun run start` | Production-ish start |
| `bun test` | Unit tests |
| `bun run typecheck` | TypeScript check |

## Agent skills

This repo vendors Matt Pocock engineering skills under `skills/` (wayfinder, grilling, domain-modeling, research, prototype, to-spec, to-tickets, implement, …). Local wayfinder map + spec live in `.scratch/short-film-generator/`. See `AGENTS.md`.
