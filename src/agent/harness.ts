import { Effect } from "effect"
import type { Boundaries, Character, NovelSnapshot, ScenePatch } from "../domain/schema.ts"

export class HarnessError {
  readonly _tag = "HarnessError"
  constructor(readonly message: string) {}
}

export const softBoundaryPrompt = (boundaries: Boundaries): string => {
  const lines = [
    "STORY BOUNDARIES (must obey):",
    boundaries.tone ? `- Tone: ${boundaries.tone}` : null,
    ...boundaries.settingRules.map((r) => `- Setting rule: ${r}`),
    ...boundaries.hardRejects.map((r) => `- Hard reject: ${r}`),
    boundaries.allowedLocations && boundaries.allowedLocations.length > 0
      ? `- Allowed locations only: ${boundaries.allowedLocations.join(", ")}`
      : null,
  ].filter(Boolean)
  return lines.join("\n")
}

export const validateScenePatch = (
  snapshot: NovelSnapshot,
  patch: ScenePatch,
): Effect.Effect<ScenePatch, HarnessError> =>
  Effect.gen(function* () {
    const castIds = new Set(snapshot.characters.map((c) => c.id))
    if (patch.presentCharacterIds) {
      for (const id of patch.presentCharacterIds) {
        if (!castIds.has(id)) {
          return yield* Effect.fail(
            new HarnessError(`Unknown character id in scene patch: ${id}`),
          )
        }
      }
    }

    const allowed = snapshot.novel.boundaries.allowedLocations
    if (
      patch.location &&
      allowed &&
      allowed.length > 0 &&
      !allowed.map((l) => l.toLowerCase()).includes(patch.location.toLowerCase())
    ) {
      return yield* Effect.fail(
        new HarnessError(
          `Location "${patch.location}" is outside allowed locations`,
        ),
      )
    }

    if (patch.summary !== undefined && patch.summary.trim().length === 0) {
      return yield* Effect.fail(new HarnessError("Scene summary cannot be empty"))
    }
    if (patch.summary !== undefined && patch.summary.length > 4000) {
      return yield* Effect.fail(new HarnessError("Scene summary is too long"))
    }

    return patch
  })

export const assertNotPlayerHijack = (
  characters: ReadonlyArray<Character>,
  characterId: string,
  controllingAsNpc: boolean,
): Effect.Effect<void, HarnessError> => {
  const character = characters.find((c) => c.id === characterId)
  if (!character) {
    return Effect.fail(new HarnessError(`Unknown character: ${characterId}`))
  }
  if (character.role === "player" && !controllingAsNpc) {
    return Effect.fail(
      new HarnessError(
        "NPCs cannot speak or act as the player character",
      ),
    )
  }
  return Effect.void
}
