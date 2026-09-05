# Spec: Short Film Generator (World Weaver)

Status: ready-for-agent

## Problem Statement

Someone with a film idea has no fast way to see it as a short cinematic piece. They want to type a Premise and watch a Short Film without learning video tools or stitching provider APIs by hand.

## Solution

World Weaver is a Bun + TypeScript webapp that turns a Premise into a playable Short Film via OpenRouter: generate a Screenplay, render Media per Scene (video preferred, stills fallback), and play it in a Film Player with live Film Job progress.

## User Stories

1. As a creator, I want to enter a Premise, so that generation starts from my idea.
2. As a creator, I want an optional style note, so that the Short Film matches a mood.
3. As a creator, I want to choose scene count (3–5), so that runtime matches my patience/budget.
4. As a creator, I want to choose Video or Stills Media mode, so that I can trade cost/latency for motion.
5. As a creator, I want to supply an OpenRouter API key (or use a server env key), so that generation is authorized.
6. As a creator, I want to see Film Job stages progress live, so that long video renders feel trustworthy.
7. As a creator, I want a titled Screenplay with ordered Scenes, so that the story is coherent.
8. As a creator, I want each Scene to have narration/dialogue captions, so that I can follow the story while watching.
9. As a creator, I want video clips when available, so that the Short Film feels cinematic.
10. As a creator, I want stills when video fails or Stills mode is chosen, so that I still get a film.
11. As a creator, I want a Film Player that auto-plays Scenes in order, so that I experience the Short Film continuously.
12. As a creator, I want to scrub or jump by Scene, so that I can revisit moments.
13. As a creator, I want errors surfaced per Scene without killing the whole Film Job when possible, so that partial films are still watchable.
14. As a developer, I want `bun install && bun run dev` to start the app, so that setup is minimal.
15. As a developer, I want defaults documented in `.env.example`, so that models/keys are clear.

## Implementation Decisions

- Brand name: **World Weaver** (repo name).
- Bun HTTP server serves `public/` and API under `/api/*`.
- `POST /api/films` starts a Film Job; `GET /api/films/:id/events` is SSE progress; `GET /api/films/:id` returns the Short Film JSON; Media files under `/api/films/:id/media/:sceneId`.
- OpenRouter client wraps chat, images, and videos (submit + poll).
- Screenplay via chat with JSON schema enforced in the system prompt + parse validation.
- Video: 5s, 480p, 16:9 by default; poll every 5s with timeout.
- Stills: 16:9 image; Film Player holds ~5s with CSS ken-burns.
- Persist Film Job state + media under `.data/films/<id>/`.
- Frontend: single page, expressive typography, full-bleed cinema aesthetic, SSE-driven stages, Film Player.

## Testing Decisions

- Unit-test Screenplay JSON parsing / validation (pure functions).
- Smoke-test OpenRouter client URL building with mocked fetch where practical.
- Manual: UI loads; demo/mock path without key shows clear error; with key, full pipeline works.

## Out of Scope

- Accounts, multi-user libraries, non-OpenRouter providers, music scoring, native apps.

## Further Notes

Derived from cleared wayfinder map `.scratch/short-film-generator/map.md`.
