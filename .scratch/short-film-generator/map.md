## Destination

A working TypeScript + Bun webapp that turns a user's idea into a playable short film by orchestrating OpenRouter chat, image, and video APIs end-to-end.

## Notes

- Domain: short-film generation via OpenRouter. Skills every session should consult: `wayfinder`, `grilling`, `domain-modeling`, `research`, `prototype`, then `to-spec` / `implement` once the map clears.
- Tracker: local markdown (`.scratch/short-film-generator/`).
- Stack constraints from the requester: TypeScript, Bun, OpenRouter.
- **Cloud-agent AFK mode**: HITL grilling is unavailable in this background session. Tickets that would normally be HITL are resolved with the recommended answers implied by the requester's constraints, recorded as decisions.
- **This map carries execution**: after decisions clear, produce the working webapp in-repo (requester asked to build, not only plan).

## Decisions so far

- [OpenRouter capabilities for short film generation](./issues/01-openrouter-film-apis.md): chat + async videos + sync images; see research notes
- [What counts as a short film in v1?](./issues/02-short-film-shape.md): 3–5 scenes, prefer short 16:9 video clips with captions, stills fallback
- [App architecture and credentials](./issues/03-architecture-and-keys.md): Bun server+UI, env/UI key, Wan 3.0 / Seedream / Gemini defaults
- [Generation pipeline UX fidelity](./issues/04-pipeline-ux.md): single-page premise → SSE progress → Film Player

## Not yet specified

- Whether later versions should add voiceover / music scoring beyond model-native video audio
- Multi-user accounts and persisted film libraries across sessions
- Fine-grained style presets beyond a free-text style note

## Out of scope

- Native desktop/mobile apps
- Non-OpenRouter providers
- Collaborative real-time editing of screenplays
- Full VFX / color-grading pipeline
