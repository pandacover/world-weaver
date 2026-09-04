import { LanguageModel } from "@effect/ai"
import { Effect, Ref } from "effect"
import type { NovelSnapshot } from "../domain/schema.ts"
import { buildDirectorSystemPrompt } from "./prompts.ts"
import { validateScenePatch } from "./harness.ts"
import { StoryToolkit, type PendingTurn } from "./tools.ts"

const formatAiError = (e: unknown): string => {
  if (e && typeof e === "object") {
    const err = e as {
      _tag?: string
      description?: string
      message?: string
    }
    const tag = err._tag ? `[${err._tag}] ` : ""
    return `${tag}${err.description ?? err.message ?? String(e)}`
  }
  return e instanceof Error ? e.message : String(e)
}

export const runDirectorTurn = (
  snapshot: NovelSnapshot,
  intentSummary: string,
  pending: Ref.Ref<PendingTurn>,
) =>
  Effect.gen(function* () {
    const toolkit = yield* StoryToolkit.pipe(
      Effect.provide(
        StoryToolkit.toLayer({
          Speak: ({ characterId, line }) =>
            Effect.gen(function* () {
              const character = snapshot.characters.find((c) => c.id === characterId)
              if (!character) {
                yield* Ref.update(pending, (p) => ({
                  ...p,
                  narrations: [
                    ...p.narrations,
                    `(Rejected speak: unknown character ${characterId})`,
                  ],
                }))
                return { ok: true as const }
              }
              if (character.role === "player") {
                yield* Ref.update(pending, (p) => ({
                  ...p,
                  narrations: [
                    ...p.narrations,
                    "(Rejected speak: cannot control the player character)",
                  ],
                }))
                return { ok: true as const }
              }
              yield* Ref.update(pending, (p) => ({
                ...p,
                dialogues: [...p.dialogues, { characterId, line }],
              }))
              return { ok: true as const }
            }),
          Remember: ({ characterId, memory }) =>
            Effect.gen(function* () {
              if (!snapshot.characters.some((c) => c.id === characterId)) {
                return { ok: true as const }
              }
              yield* Ref.update(pending, (p) => ({
                ...p,
                memories: [...p.memories, { characterId, memory }],
              }))
              return { ok: true as const }
            }),
          Observe: ({ narration }) =>
            Effect.gen(function* () {
              yield* Ref.update(pending, (p) => ({
                ...p,
                narrations: [...p.narrations, narration],
              }))
              return { ok: true as const }
            }),
          MutateScene: (params) =>
            Effect.gen(function* () {
              const patch = {
                location: params.location,
                summary: params.summary,
                presentCharacterIds: params.presentCharacterIds,
              }
              const validated = yield* validateScenePatch(snapshot, patch).pipe(
                Effect.either,
              )
              if (validated._tag === "Left") {
                yield* Ref.update(pending, (p) => ({
                  ...p,
                  narrations: [
                    ...p.narrations,
                    `(Rejected scene change: ${validated.left.message})`,
                  ],
                }))
                return { ok: true as const }
              }
              yield* Ref.update(pending, (p) => ({
                ...p,
                scenePatch: validated.right,
              }))
              return { ok: true as const }
            }),
        }),
      ),
    )

    const system = buildDirectorSystemPrompt(snapshot, intentSummary)
    const userContent =
      "Resolve the user intent. Narrate briefly via the Observe tool (or plain text). " +
      "Use Speak/Remember/MutateScene only when needed. Prefer Observe for /look."

    const prompts = [
      { role: "system" as const, content: system },
      { role: "user" as const, content: userContent },
    ]

    const withTools = LanguageModel.generateText({
      prompt: prompts,
      toolkit,
    })

    // Some OpenAI-compatible providers return tool args that fail nested schema decode.
    // Fall back to plain narration so the turn still completes.
    const response = yield* withTools.pipe(
      Effect.catchIf(
        (e) =>
          Boolean(
            e &&
              typeof e === "object" &&
              "_tag" in e &&
              (e._tag === "MalformedOutput" || e._tag === "MalformedInput"),
          ),
        (e) =>
          Effect.gen(function* () {
            const fallback = yield* LanguageModel.generateText({
              prompt: [
                { role: "system", content: system },
                {
                  role: "user",
                  content:
                    `${userContent}\n\n(Tool calling failed: ${formatAiError(e)}. ` +
                    "Reply with plain narrative prose only, no tools.)",
                },
              ],
            })
            return fallback
          }),
      ),
    )

    if (response.text.trim().length > 0) {
      const text = response.text.trim()
      yield* Ref.update(pending, (p) => {
        if (p.narrations.includes(text) || p.dialogues.some((d) => d.line === text)) {
          return p
        }
        if (p.narrations.length === 0 && p.dialogues.length === 0) {
          return { ...p, narrations: [...p.narrations, text] }
        }
        // Still append free text if tools produced dialogue but no narration
        if (p.narrations.length === 0) {
          return { ...p, narrations: [...p.narrations, text] }
        }
        return p
      })
    }

    return response.text
  })
