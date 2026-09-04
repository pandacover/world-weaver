import { Effect, Schema } from "effect"
import type {
  Beat,
  BeatKind,
  Boundaries,
  Character,
  Chapter,
  CreateNovelInput,
  Novel,
  NovelSnapshot,
  Scene,
  ScenePatch,
} from "../domain/schema.ts"
import {
  Boundaries as BoundariesSchema,
  Character as CharacterSchema,
  Novel as NovelSchema,
} from "../domain/schema.ts"
import { DatabaseError, Db } from "./db.ts"

const id = () => crypto.randomUUID()
const now = () => Date.now()

const parseJson = <A>(raw: string, schema: Schema.Schema<A>): A =>
  Schema.decodeUnknownSync(schema)(JSON.parse(raw))

export class NovelStore extends Effect.Service<NovelStore>()(
  "world-weaver/NovelStore",
  {
    effect: Effect.gen(function* () {
      const { db } = yield* Db

      const listNovels = (): Effect.Effect<ReadonlyArray<Novel>, DatabaseError> =>
        Effect.try({
          try: () => {
            const rows = db
              .query(
                `SELECT id, title, premise, boundaries_json, current_chapter_id,
                        current_scene_id, created_at, updated_at
                 FROM novels ORDER BY updated_at DESC`,
              )
              .all() as Array<Record<string, unknown>>
            return rows.map(rowToNovel)
          },
          catch: (cause) => new DatabaseError("listNovels failed", cause),
        })

      const getNovel = (
        novelId: string,
      ): Effect.Effect<Novel | null, DatabaseError> =>
        Effect.try({
          try: () => {
            const row = db
              .query(
                `SELECT id, title, premise, boundaries_json, current_chapter_id,
                        current_scene_id, created_at, updated_at
                 FROM novels WHERE id = ?`,
              )
              .get(novelId) as Record<string, unknown> | null
            return row ? rowToNovel(row) : null
          },
          catch: (cause) => new DatabaseError("getNovel failed", cause),
        })

      const getCharacters = (
        novelId: string,
      ): Effect.Effect<ReadonlyArray<Character>, DatabaseError> =>
        Effect.try({
          try: () => {
            const rows = db
              .query(
                `SELECT id, novel_id, name, role, personality_json, physical_json, voice_notes
                 FROM characters WHERE novel_id = ?`,
              )
              .all(novelId) as Array<Record<string, unknown>>
            return rows.map(rowToCharacter)
          },
          catch: (cause) => new DatabaseError("getCharacters failed", cause),
        })

      const getChapters = (
        novelId: string,
      ): Effect.Effect<ReadonlyArray<Chapter>, DatabaseError> =>
        Effect.try({
          try: () => {
            const rows = db
              .query(
                `SELECT id, novel_id, title, ord, synopsis
                 FROM chapters WHERE novel_id = ? ORDER BY ord ASC`,
              )
              .all(novelId) as Array<Record<string, unknown>>
            return rows.map(
              (r): Chapter => ({
                id: String(r.id),
                novelId: String(r.novel_id),
                title: String(r.title),
                ord: Number(r.ord),
                synopsis: r.synopsis == null ? undefined : String(r.synopsis),
              }),
            )
          },
          catch: (cause) => new DatabaseError("getChapters failed", cause),
        })

      const getScenesForNovel = (
        novelId: string,
      ): Effect.Effect<ReadonlyArray<Scene>, DatabaseError> =>
        Effect.try({
          try: () => {
            const rows = db
              .query(
                `SELECT s.id, s.chapter_id, s.location, s.summary
                 FROM scenes s
                 JOIN chapters c ON c.id = s.chapter_id
                 WHERE c.novel_id = ?`,
              )
              .all(novelId) as Array<Record<string, unknown>>
            return rows.map((r) => {
              const sceneId = String(r.id)
              const present = db
                .query(
                  `SELECT character_id FROM scene_characters WHERE scene_id = ?`,
                )
                .all(sceneId) as Array<{ character_id: string }>
              return {
                id: sceneId,
                chapterId: String(r.chapter_id),
                location: String(r.location),
                summary: String(r.summary),
                presentCharacterIds: present.map((p) => p.character_id),
              } satisfies Scene
            })
          },
          catch: (cause) => new DatabaseError("getScenesForNovel failed", cause),
        })

      const getRecentBeats = (
        novelId: string,
        limit = 40,
      ): Effect.Effect<ReadonlyArray<Beat>, DatabaseError> =>
        Effect.try({
          try: () => {
            const rows = db
              .query(
                `SELECT id, novel_id, scene_id, kind, speaker_id, content, created_at
                 FROM beats WHERE novel_id = ?
                 ORDER BY created_at DESC LIMIT ?`,
              )
              .all(novelId, limit) as Array<Record<string, unknown>>
            return rows
              .map(
                (r): Beat => ({
                  id: String(r.id),
                  novelId: String(r.novel_id),
                  sceneId: String(r.scene_id),
                  kind: r.kind as BeatKind,
                  speakerId:
                    r.speaker_id == null ? null : String(r.speaker_id),
                  content: String(r.content),
                  createdAt: Number(r.created_at),
                }),
              )
              .reverse()
          },
          catch: (cause) => new DatabaseError("getRecentBeats failed", cause),
        })

      const getSnapshot = (
        novelId: string,
      ): Effect.Effect<NovelSnapshot | null, DatabaseError> =>
        Effect.gen(function* () {
          const novel = yield* getNovel(novelId)
          if (!novel) return null
          const characters = yield* getCharacters(novelId)
          const chapters = yield* getChapters(novelId)
          const scenes = yield* getScenesForNovel(novelId)
          const recentBeats = yield* getRecentBeats(novelId)
          return { novel, characters, chapters, scenes, recentBeats }
        })

      const createNovel = (
        input: CreateNovelInput,
      ): Effect.Effect<NovelSnapshot, DatabaseError> =>
        Effect.gen(function* () {
          const novelId = id()
          const chapterId = id()
          const sceneId = id()
          const createdAt = now()

          yield* Effect.try({
            try: () => {
              const tx = db.transaction(() => {
                db.query(
                  `INSERT INTO novels
                    (id, title, premise, boundaries_json, current_chapter_id, current_scene_id, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                ).run(
                  novelId,
                  input.title,
                  input.premise,
                  JSON.stringify(input.boundaries),
                  chapterId,
                  sceneId,
                  createdAt,
                  createdAt,
                )

                db.query(
                  `INSERT INTO chapters (id, novel_id, title, ord, synopsis)
                   VALUES (?, ?, ?, ?, ?)`,
                ).run(
                  chapterId,
                  novelId,
                  input.chapterTitle ?? "Chapter 1",
                  1,
                  "The story begins.",
                )

                db.query(
                  `INSERT INTO scenes (id, chapter_id, location, summary)
                   VALUES (?, ?, ?, ?)`,
                ).run(
                  sceneId,
                  chapterId,
                  input.openingLocation,
                  input.openingSummary,
                )

                const castIds: string[] = []
                const playerId = id()
                castIds.push(playerId)
                db.query(
                  `INSERT INTO characters
                    (id, novel_id, name, role, personality_json, physical_json, voice_notes)
                   VALUES (?, ?, ?, 'player', ?, ?, ?)`,
                ).run(
                  playerId,
                  novelId,
                  input.player.name,
                  JSON.stringify(input.player.personalityTraits),
                  JSON.stringify(input.player.physicalTraits),
                  input.player.voiceNotes ?? null,
                )

                for (const npc of input.npcs) {
                  const npcId = id()
                  castIds.push(npcId)
                  db.query(
                    `INSERT INTO characters
                      (id, novel_id, name, role, personality_json, physical_json, voice_notes)
                     VALUES (?, ?, ?, 'npc', ?, ?, ?)`,
                  ).run(
                    npcId,
                    novelId,
                    npc.name,
                    JSON.stringify(npc.personalityTraits),
                    JSON.stringify(npc.physicalTraits),
                    npc.voiceNotes ?? null,
                  )
                }

                for (const characterId of castIds) {
                  db.query(
                    `INSERT INTO scene_characters (scene_id, character_id) VALUES (?, ?)`,
                  ).run(sceneId, characterId)
                }

                db.query(
                  `INSERT INTO beats
                    (id, novel_id, scene_id, kind, speaker_id, content, created_at)
                   VALUES (?, ?, ?, 'narration', NULL, ?, ?)`,
                ).run(id(), novelId, sceneId, input.openingSummary, createdAt)
              })
              tx()
            },
            catch: (cause) => new DatabaseError("createNovel failed", cause),
          })

          const snapshot = yield* getSnapshot(novelId)
          if (!snapshot) {
            return yield* Effect.fail(
              new DatabaseError("createNovel: snapshot missing after insert"),
            )
          }
          return snapshot
        })
      const appendBeat = (input: {
        novelId: string
        sceneId: string
        kind: BeatKind
        speakerId?: string | null
        content: string
      }): Effect.Effect<Beat, DatabaseError> =>
        Effect.try({
          try: () => {
            const beat: Beat = {
              id: id(),
              novelId: input.novelId,
              sceneId: input.sceneId,
              kind: input.kind,
              speakerId: input.speakerId ?? null,
              content: input.content,
              createdAt: now(),
            }
            const tx = db.transaction(() => {
              db.query(
                `INSERT INTO beats
                  (id, novel_id, scene_id, kind, speaker_id, content, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
              ).run(
                beat.id,
                beat.novelId,
                beat.sceneId,
                beat.kind,
                beat.speakerId ?? null,
                beat.content,
                beat.createdAt,
              )
              db.query(`UPDATE novels SET updated_at = ? WHERE id = ?`).run(
                beat.createdAt,
                beat.novelId,
              )
            })
            tx()
            return beat
          },
          catch: (cause) => new DatabaseError("appendBeat failed", cause),
        })

      const patchScene = (
        sceneId: string,
        novelId: string,
        patch: ScenePatch,
        allCharacterIds: ReadonlyArray<string>,
      ): Effect.Effect<Scene, DatabaseError> =>
        Effect.try({
          try: () => {
            const tx = db.transaction(() => {
              if (patch.location !== undefined || patch.summary !== undefined) {
                const current = db
                  .query(`SELECT location, summary FROM scenes WHERE id = ?`)
                  .get(sceneId) as { location: string; summary: string } | null
                if (!current) throw new Error(`Scene ${sceneId} not found`)
                db.query(
                  `UPDATE scenes SET location = ?, summary = ? WHERE id = ?`,
                ).run(
                  patch.location ?? current.location,
                  patch.summary ?? current.summary,
                  sceneId,
                )
              }
              if (patch.presentCharacterIds !== undefined) {
                for (const cid of patch.presentCharacterIds) {
                  if (!allCharacterIds.includes(cid)) {
                    throw new Error(`Unknown character id in scene patch: ${cid}`)
                  }
                }
                db.query(`DELETE FROM scene_characters WHERE scene_id = ?`).run(
                  sceneId,
                )
                for (const cid of patch.presentCharacterIds) {
                  db.query(
                    `INSERT INTO scene_characters (scene_id, character_id) VALUES (?, ?)`,
                  ).run(sceneId, cid)
                }
              }
              db.query(`UPDATE novels SET updated_at = ? WHERE id = ?`).run(
                now(),
                novelId,
              )
            })
            tx()

            const row = db
              .query(
                `SELECT id, chapter_id, location, summary FROM scenes WHERE id = ?`,
              )
              .get(sceneId) as Record<string, unknown>
            const present = db
              .query(
                `SELECT character_id FROM scene_characters WHERE scene_id = ?`,
              )
              .all(sceneId) as Array<{ character_id: string }>
            return {
              id: String(row.id),
              chapterId: String(row.chapter_id),
              location: String(row.location),
              summary: String(row.summary),
              presentCharacterIds: present.map((p) => p.character_id),
            } satisfies Scene
          },
          catch: (cause) => new DatabaseError("patchScene failed", cause),
        })

      const findCharacterByName = (
        novelId: string,
        name: string,
      ): Effect.Effect<Character | null, DatabaseError> =>
        Effect.gen(function* () {
          const characters = yield* getCharacters(novelId)
          const lower = name.toLowerCase()
          return (
            characters.find((c) => c.name.toLowerCase() === lower) ?? null
          )
        })

      return {
        listNovels,
        getNovel,
        getCharacters,
        getChapters,
        getScenesForNovel,
        getRecentBeats,
        getSnapshot,
        createNovel,
        appendBeat,
        patchScene,
        findCharacterByName,
      }
    }),
  },
) {}

const rowToNovel = (r: Record<string, unknown>): Novel => {
  const boundaries = parseJson(String(r.boundaries_json), BoundariesSchema)
  return Schema.decodeUnknownSync(NovelSchema)({
    id: String(r.id),
    title: String(r.title),
    premise: String(r.premise),
    boundaries,
    currentChapterId:
      r.current_chapter_id == null ? null : String(r.current_chapter_id),
    currentSceneId:
      r.current_scene_id == null ? null : String(r.current_scene_id),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  })
}

const rowToCharacter = (r: Record<string, unknown>): Character =>
  Schema.decodeUnknownSync(CharacterSchema)({
    id: String(r.id),
    novelId: String(r.novel_id),
    name: String(r.name),
    role: r.role,
    personalityTraits: JSON.parse(String(r.personality_json)) as string[],
    physicalTraits: JSON.parse(String(r.physical_json)) as string[],
    voiceNotes: r.voice_notes == null ? undefined : String(r.voice_notes),
  })
