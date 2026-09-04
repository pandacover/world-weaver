import { Schema } from "effect"

export const CharacterRole = Schema.Literal("npc", "player")
export type CharacterRole = typeof CharacterRole.Type

export const Boundaries = Schema.Struct({
  tone: Schema.optional(Schema.String),
  settingRules: Schema.Array(Schema.String),
  hardRejects: Schema.Array(Schema.String),
  allowedLocations: Schema.optional(Schema.Array(Schema.String)),
})
export type Boundaries = typeof Boundaries.Type

export const Character = Schema.Struct({
  id: Schema.String,
  novelId: Schema.String,
  name: Schema.String,
  role: CharacterRole,
  personalityTraits: Schema.Array(Schema.String),
  physicalTraits: Schema.Array(Schema.String),
  voiceNotes: Schema.optional(Schema.String),
})
export type Character = typeof Character.Type

export const Chapter = Schema.Struct({
  id: Schema.String,
  novelId: Schema.String,
  title: Schema.String,
  ord: Schema.Number,
  synopsis: Schema.optional(Schema.String),
})
export type Chapter = typeof Chapter.Type

export const Scene = Schema.Struct({
  id: Schema.String,
  chapterId: Schema.String,
  location: Schema.String,
  summary: Schema.String,
  presentCharacterIds: Schema.Array(Schema.String),
})
export type Scene = typeof Scene.Type

export const BeatKind = Schema.Literal(
  "narration",
  "dialogue",
  "action",
  "system",
)
export type BeatKind = typeof BeatKind.Type

export const Beat = Schema.Struct({
  id: Schema.String,
  novelId: Schema.String,
  sceneId: Schema.String,
  kind: BeatKind,
  speakerId: Schema.optional(Schema.NullOr(Schema.String)),
  content: Schema.String,
  createdAt: Schema.Number,
})
export type Beat = typeof Beat.Type

export const Novel = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  premise: Schema.String,
  boundaries: Boundaries,
  currentChapterId: Schema.optional(Schema.NullOr(Schema.String)),
  currentSceneId: Schema.optional(Schema.NullOr(Schema.String)),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})
export type Novel = typeof Novel.Type

export const NovelSnapshot = Schema.Struct({
  novel: Novel,
  characters: Schema.Array(Character),
  chapters: Schema.Array(Chapter),
  scenes: Schema.Array(Scene),
  recentBeats: Schema.Array(Beat),
})
export type NovelSnapshot = typeof NovelSnapshot.Type

export const ScenePatch = Schema.Struct({
  location: Schema.optional(Schema.String),
  summary: Schema.optional(Schema.String),
  presentCharacterIds: Schema.optional(Schema.Array(Schema.String)),
})
export type ScenePatch = typeof ScenePatch.Type

export const CreateNovelInput = Schema.Struct({
  title: Schema.String,
  premise: Schema.String,
  boundaries: Boundaries,
  player: Schema.Struct({
    name: Schema.String,
    personalityTraits: Schema.Array(Schema.String),
    physicalTraits: Schema.Array(Schema.String),
    voiceNotes: Schema.optional(Schema.String),
  }),
  npcs: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      personalityTraits: Schema.Array(Schema.String),
      physicalTraits: Schema.Array(Schema.String),
      voiceNotes: Schema.optional(Schema.String),
    }),
  ),
  openingLocation: Schema.String,
  openingSummary: Schema.String,
  chapterTitle: Schema.optional(Schema.String),
})
export type CreateNovelInput = typeof CreateNovelInput.Type
