import { LanguageModel } from "@effect/ai"
import { Effect, Ref } from "effect"
import type { NovelSnapshot } from "../domain/schema.ts"
import { buildDirectorSystemPrompt } from "./prompts.ts"
import { validateScenePatch } from "./harness.ts"
import { StoryToolkit, type PendingTurn } from "./tools.ts"

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
          MutateScene: ({ patch }) =>
            Effect.gen(function* () {
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
    const response = yield* LanguageModel.generateText({
      prompt: [
        { role: "system", content: system },
        {
          role: "user",
          content:
            "Resolve the user intent. Narrate briefly. Use tools for dialogue, memories, observations, and scene changes.",
        },
      ],
      toolkit,
    })

    if (response.text.trim().length > 0) {
      const text = response.text.trim()
      yield* Ref.update(pending, (p) => {
        if (p.narrations.includes(text) || p.dialogues.some((d) => d.line === text)) {
          return p
        }
        if (p.narrations.length === 0 && p.dialogues.length === 0) {
          return { ...p, narrations: [...p.narrations, text] }
        }
        return p
      })
    }

    return response.text
  })
