# OpenRouter capabilities for short film generation

Type: research
Status: resolved

## Question

What OpenRouter APIs and model classes can we use to turn a text premise into a short film (screenplay structure, stills, and/or motion clips), and what are the concrete request/response shapes?

## Answer

Use three OpenRouter surfaces: chat completions for a structured Screenplay, async `POST /api/v1/videos` (poll + `unsigned_urls`) for Scene clips, and sync `POST /api/v1/images` as stills fallback. Defaults: a cheap chat model for structure, `alibaba/wan-3.0` for video, Seedream/Grok image for fallback. Full notes: [research/openrouter-film-apis.md](../research/openrouter-film-apis.md).
