import Supermemory from "supermemory"
import { Effect } from "effect"
import { AppConfig } from "../config.ts"
import type { Character } from "../domain/schema.ts"

export class MemoryError {
  readonly _tag = "MemoryError"
  constructor(readonly message: string, readonly cause?: unknown) {}
}

export const containerTagFor = (novelId: string, characterId: string) =>
  `novel:${novelId}:char:${characterId}`

export class CharacterMemory extends Effect.Service<CharacterMemory>()(
  "world-weaver/CharacterMemory",
  {
    effect: Effect.gen(function* () {
      const config = yield* AppConfig
      const apiKey = config.supermemoryApiKeyValue

      const client = apiKey
        ? new Supermemory({ apiKey })
        : null

      const ensureClient = () => {
        if (!client) {
          return Effect.fail(
            new MemoryError(
              "SUPERMEMORY_API_KEY is not set; character memory is disabled",
            ),
          )
        }
        return Effect.succeed(client)
      }

      const seedCharacter = (
        character: Character,
      ): Effect.Effect<void, MemoryError> =>
        Effect.gen(function* () {
          const sm = yield* ensureClient()
          const tag = containerTagFor(character.novelId, character.id)
          const content = [
            `Character name: ${character.name}`,
            `Role: ${character.role}`,
            `Personality: ${character.personalityTraits.join(", ") || "unspecified"}`,
            `Physical: ${character.physicalTraits.join(", ") || "unspecified"}`,
            character.voiceNotes ? `Voice: ${character.voiceNotes}` : "",
          ]
            .filter(Boolean)
            .join("\n")

          yield* Effect.tryPromise({
            try: () =>
              sm.add({
                content,
                containerTag: tag,
                metadata: {
                  kind: "character_sheet",
                  characterId: character.id,
                  novelId: character.novelId,
                },
              }),
            catch: (cause) =>
              new MemoryError(`Failed to seed memory for ${character.name}`, cause),
          })
        })

      const add = (
        novelId: string,
        characterId: string,
        content: string,
        metadata?: Record<string, string>,
      ): Effect.Effect<void, MemoryError> =>
        Effect.gen(function* () {
          const sm = yield* ensureClient()
          yield* Effect.tryPromise({
            try: () =>
              sm.add({
                content,
                containerTag: containerTagFor(novelId, characterId),
                metadata: {
                  kind: "beat_memory",
                  characterId,
                  novelId,
                  ...metadata,
                },
              }),
            catch: (cause) =>
              new MemoryError("Failed to add character memory", cause),
          })
        })

      const recall = (
        novelId: string,
        characterId: string,
        query: string,
        limit = 8,
      ): Effect.Effect<ReadonlyArray<string>, MemoryError> =>
        Effect.gen(function* () {
          const sm = yield* ensureClient()
          const response = yield* Effect.tryPromise({
            try: () =>
              sm.search({
                q: query,
                containerTag: containerTagFor(novelId, characterId),
                searchMode: "hybrid",
                limit,
              }),
            catch: (cause) =>
              new MemoryError("Failed to search character memory", cause),
          })

          const results = (response as { results?: Array<{ memory?: string; chunk?: string; content?: string }> })
            .results ?? []
          return results
            .map((r) => r.memory ?? r.chunk ?? r.content ?? "")
            .filter((t) => t.length > 0)
        })

      /** Soft-fail recall used in prompts when memory is optional. */
      const recallOptional = (
        novelId: string,
        characterId: string,
        query: string,
      ): Effect.Effect<ReadonlyArray<string>> =>
        recall(novelId, characterId, query).pipe(
          Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<string>)),
        )

      const seedOptional = (
        character: Character,
      ): Effect.Effect<void> =>
        seedCharacter(character).pipe(Effect.catchAll(() => Effect.void))

      const addOptional = (
        novelId: string,
        characterId: string,
        content: string,
      ): Effect.Effect<void> =>
        add(novelId, characterId, content).pipe(Effect.catchAll(() => Effect.void))

      return {
        seedCharacter,
        add,
        recall,
        recallOptional,
        seedOptional,
        addOptional,
        isEnabled: Boolean(client),
      }
    }),
  },
) {}
