import { LanguageModel } from "@effect/ai"
import { Effect, Ref } from "effect"
import type { Character, NovelSnapshot } from "../domain/schema.ts"
import { CharacterMemory } from "../memory/supermemory.ts"
import { buildCharacterSystemPrompt } from "./prompts.ts"
import { HarnessError } from "./harness.ts"
import { StoryToolkit, type PendingTurn } from "./tools.ts"

export const runCharacterTurn = (
  snapshot: NovelSnapshot,
  character: Character,
  playerLine: string,
  pending: Ref.Ref<PendingTurn>,
) =>
  Effect.gen(function* () {
    if (character.role === "player") {
      return yield* Effect.fail(
        new HarnessError("Cannot run character agent for the player"),
      )
    }

    const memory = yield* CharacterMemory
    const player =
      snapshot.characters.find((c) => c.role === "player")?.name ?? "Player"
    const memories = yield* memory.recallOptional(
      snapshot.novel.id,
      character.id,
      playerLine,
    )

    const toolkit = yield* StoryToolkit.pipe(
      Effect.provide(
        StoryToolkit.toLayer({
          Speak: ({ characterId, line }) =>
            Effect.gen(function* () {
              if (characterId !== character.id) {
                return { ok: true as const }
              }
              yield* Ref.update(pending, (p) => ({
                ...p,
                dialogues: [...p.dialogues, { characterId, line }],
              }))
              return { ok: true as const }
            }),
          Remember: ({ characterId, memory: mem }) =>
            Effect.gen(function* () {
              if (characterId !== character.id) {
                return { ok: true as const }
              }
              yield* Ref.update(pending, (p) => ({
                ...p,
                memories: [...p.memories, { characterId, memory: mem }],
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
          MutateScene: () => Effect.succeed({ ok: true as const }),
        }),
      ),
    )

    const system = buildCharacterSystemPrompt(
      snapshot,
      character,
      memories,
      player,
    )

    const response = yield* LanguageModel.generateText({
      prompt: [
        { role: "system", content: system },
        { role: "user", content: playerLine },
      ],
      toolkit,
    })

    const pendingNow = yield* Ref.get(pending)
    const spoke = pendingNow.dialogues.some((d) => d.characterId === character.id)
    if (!spoke && response.text.trim().length > 0) {
      yield* Ref.update(pending, (p) => ({
        ...p,
        dialogues: [
          ...p.dialogues,
          { characterId: character.id, line: response.text.trim() },
        ],
      }))
    }

    return response.text
  })
