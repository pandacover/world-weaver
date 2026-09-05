# Research: OpenRouter APIs for short film generation

Primary sources consulted:

- https://openrouter.ai/docs/guides/overview/multimodal/video-generation
- https://openrouter.ai/docs/guides/overview/multimodal/image-generation
- Live `GET https://openrouter.ai/api/v1/videos/models`
- Live `GET https://openrouter.ai/api/v1/images/models`
- Live `GET https://openrouter.ai/api/v1/models`

## Findings

### Three APIs we need

1. **Chat Completions** (`POST /api/v1/chat/completions`) — structure a screenplay / shot list as JSON from a user premise. Standard OpenAI-compatible shape; use a text model with JSON mode / structured output.

2. **Images** (`POST /api/v1/images`) — sync generation; response `data[].b64_json` (+ optional `media_type`). Useful for keyframes / storyboard stills and as fallback when video fails. Discovery: `GET /api/v1/images/models`.

3. **Videos** (`POST /api/v1/videos`) — **async**. Submit → `{ id, polling_url, status }` → poll until `completed` → download from `unsigned_urls[0]` or `GET /api/v1/videos/{id}/content`. Discovery: `GET /api/v1/videos/models` (includes `supported_durations`, `supported_resolutions`, `supported_aspect_ratios`, pricing).

### Auth

`Authorization: Bearer <OPENROUTER_API_KEY>` on all calls. Optional `HTTP-Referer` / `X-Title` headers for app attribution.

### Sensible default models (catalog snapshot at research time)

| Role | Default | Notes |
| --- | --- | --- |
| Screenplay LLM | `openai/gpt-5-mini` or `google/gemini-3.8-flash` | Cheap structured JSON |
| Video | `alibaba/wan-3.0` | 2–30s, 480p/720p/1080p, 16:9; ~$0.05/s at 480p |
| Image fallback | `bytedance-seed/seedream-5-0-lite` or `x-ai/grok-imagine-image-2.0` | 16:9 stills |

Cheaper video alternative: `minimax/hailuo-3-max` at 480p (~$0.05/s), durations 5–15s.

### Pipeline implication

A short film is best modeled as: **premise → structured Screenplay (N Scenes) → one media asset per Scene (prefer video, fall back to image) → Film Player sequencing assets with captions**.

Video jobs are slow (tens of seconds to minutes per clip). The UI must stream progress; poll ~5–15s (docs suggest ~30s; shorter is fine for UX if rate-limited carefully).

### Constraints

- Video is not ZDR-eligible.
- Unsupported duration/resolution/aspect returns 400 listing supported values — validate against `/videos/models` for the chosen model.
- Image billing is all-or-nothing; video bills on completed jobs.
