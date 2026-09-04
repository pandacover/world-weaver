import { Effect, Ref } from "effect"
import type { NovelSnapshot } from "../domain/schema.ts"
import { NovelStore } from "../store/novel-store.ts"
import { CharacterMemory } from "../memory/supermemory.ts"
import { runCharacterTurn } from "./character.ts"
import { runDirectorTurn } from "./director.ts"
import type { PendingTurn } from "./tools.ts"
import { HarnessError } from "./harness.ts"

export type UserIntent =
  | { readonly _tag: "chat"; readonly characterName: string | null; readonly text: string }
  | { readonly _tag: "act"; readonly text: string }
  | { readonly _tag: "look"; readonly focus: string | null }
  | { readonly _tag: "continue" }
  | { readonly _tag: "info" }

export const parseInput = (
  raw: string,
  focusedCharacterName: string | null,
): UserIntent => {
  const line = raw.trim()
  if (!line) return { _tag: "info" }
  if (line === "/look") return { _tag: "look", focus: null }
  if (line.startsWith("/look ")) {
    const focus = line.slice(6).trim()
    return { _tag: "look", focus: focus.length > 0 ? focus : null }
  }
  if (line === "/continue") return { _tag: "continue" }
  if (line === "/info") return { _tag: "info" }
  if (line.startsWith("/act ")) {
    return { _tag: "act", text: line.slice(5).trim() }
  }
  const at = line.match(/^@([^\s]+)\s+([\s\S]+)$/)
  if (at) {
    return { _tag: "chat", characterName: at[1]!, text: at[2]! }
  }
  return { _tag: "chat", characterName: focusedCharacterName, text: line }
}

const emptyPending = (): PendingTurn => ({
  dialogues: [],
  narrations: [],
  memories: [],
  scenePatch: null,
})

export type TurnResult = {
  readonly snapshot: NovelSnapshot
  readonly lines: ReadonlyArray<string>
}

export class AgentLoop extends Effect.Service<AgentLoop>()(
  "world-weaver/AgentLoop",
  {
    effect: Effect.gen(function* () {
      const store = yield* NovelStore
      const memory = yield* CharacterMemory

      const commitPending = (snapshot: NovelSnapshot, pending: PendingTurn) =>
        Effect.gen(function* () {
          const sceneId = snapshot.novel.currentSceneId
          if (!sceneId) {
            return yield* Effect.fail(new HarnessError("Novel has no current scene"))
          }

          const lines: string[] = []

          for (const narration of pending.narrations) {
            yield* store.appendBeat({
              novelId: snapshot.novel.id,
              sceneId,
              kind: "narration",
              content: narration,
            })
            lines.push(narration)
          }

          for (const dialogue of pending.dialogues) {
            const speaker = snapshot.characters.find(
              (c) => c.id === dialogue.characterId,
            )
            yield* store.appendBeat({
              novelId: snapshot.novel.id,
              sceneId,
              kind: "dialogue",
              speakerId: dialogue.characterId,
              content: dialogue.line,
            })
            lines.push(`${speaker?.name ?? "Someone"}: ${dialogue.line}`)
          }

          for (const mem of pending.memories) {
            yield* memory.addOptional(
              snapshot.novel.id,
              mem.characterId,
              mem.memory,
            )
          }

          if (pending.scenePatch) {
            yield* store.patchScene(
              sceneId,
              snapshot.novel.id,
              pending.scenePatch,
              snapshot.characters.map((c) => c.id),
            )
          }

          const next = yield* store.getSnapshot(snapshot.novel.id)
          if (!next) {
            return yield* Effect.fail(new HarnessError("Snapshot lost after turn"))
          }
          return lines
        })

      const runTurn = (novelId: string, intent: UserIntent) =>
        Effect.gen(function* () {
          const snapshot = yield* store.getSnapshot(novelId)
          if (!snapshot) {
            return yield* Effect.fail(new HarnessError(`Novel not found: ${novelId}`))
          }

          if (intent._tag === "info") {
            const chapter = snapshot.chapters.find(
              (c) => c.id === snapshot.novel.currentChapterId,
            )
            const scene = snapshot.scenes.find(
              (s) => s.id === snapshot.novel.currentSceneId,
            )
            const present =
              scene?.presentCharacterIds
                .map(
                  (id) =>
                    snapshot.characters.find((c) => c.id === id)?.name ?? id,
                )
                .join(", ") ?? ""
            return {
              snapshot,
              lines: [
                `Title: ${snapshot.novel.title}`,
                `Chapter: ${chapter?.title ?? "?"}`,
                `Scene: ${scene?.location ?? "?"} — ${scene?.summary ?? ""}`,
                `Present: ${present}`,
                `Cast: ${snapshot.characters.map((c) => `${c.name} (${c.role})`).join(", ")}`,
              ],
            } satisfies TurnResult
          }

          const pending = yield* Ref.make(emptyPending())
          const sceneId = snapshot.novel.currentSceneId
          if (!sceneId) {
            return yield* Effect.fail(new HarnessError("No current scene"))
          }

          if (intent._tag === "chat") {
            const player = snapshot.characters.find((c) => c.role === "player")
            yield* store.appendBeat({
              novelId,
              sceneId,
              kind: "dialogue",
              speakerId: player?.id ?? null,
              content: intent.text,
            })

            const target = intent.characterName
              ? yield* store.findCharacterByName(novelId, intent.characterName)
              : snapshot.characters.find(
                  (c) =>
                    c.role === "npc" &&
                    snapshot.scenes
                      .find((s) => s.id === sceneId)
                      ?.presentCharacterIds.includes(c.id),
                ) ?? null

            if (intent.characterName && !target) {
              return yield* Effect.fail(
                new HarnessError(`No character named "${intent.characterName}"`),
              )
            }

            const afterPlayer = (yield* store.getSnapshot(novelId))!
            if (target && target.role === "npc") {
              yield* runCharacterTurn(
                afterPlayer,
                target,
                intent.text,
                pending,
              )
            } else {
              yield* runDirectorTurn(
                afterPlayer,
                `Player says: ${intent.text}`,
                pending,
              )
            }

            const mid = yield* Ref.get(pending)
            if (mid.narrations.length === 0 && target) {
              yield* runDirectorTurn(
                afterPlayer,
                `Briefly narrate the environment after ${target.name} responds to: ${intent.text}`,
                pending,
              ).pipe(Effect.catchAll(() => Effect.void))
            }
          } else if (intent._tag === "act") {
            const player = snapshot.characters.find((c) => c.role === "player")
            yield* store.appendBeat({
              novelId,
              sceneId,
              kind: "action",
              speakerId: player?.id ?? null,
              content: intent.text,
            })
            const after = (yield* store.getSnapshot(novelId))!
            yield* runDirectorTurn(
              after,
              `Player acts: ${intent.text}`,
              pending,
            )
          } else if (intent._tag === "look") {
            const focusBit = intent.focus
              ? ` Focus attention on "${intent.focus}" if present.`
              : ""
            yield* runDirectorTurn(
              snapshot,
              `Describe what the player sees in the current scene.${focusBit}`,
              pending,
            )
          } else if (intent._tag === "continue") {
            yield* runDirectorTurn(
              snapshot,
              "Advance the story one beat while respecting boundaries. NPCs may act.",
              pending,
            )
          }

          const finalPending = yield* Ref.get(pending)
          const latest = (yield* store.getSnapshot(novelId))!
          const lines = yield* commitPending(latest, finalPending)
          const next = (yield* store.getSnapshot(novelId))!
          return { snapshot: next, lines } satisfies TurnResult
        })

      return { runTurn, parseInput }
    }),
  },
) {}
