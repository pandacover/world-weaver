# App architecture and credentials

Type: grilling
Status: resolved
Blocked by: 01

## Question

How should the Bun/TypeScript app be shaped (server vs static), how is the OpenRouter API key supplied, and which default models are used for screenplay / images / video?

## Answer

Single Bun TypeScript process serves static UI + JSON/SSE API. OpenRouter key from `OPENROUTER_API_KEY` env, overridable per-request from the UI (never logged; not written to disk). Defaults: chat `google/gemini-3.8-flash`, video `alibaba/wan-3.0` @ 480p / 16:9 / 5s, image `bytedance-seed/seedream-5-0-lite` @ 16:9. Generated Film JSON + media cached under `.data/films/<id>/` for the session.
