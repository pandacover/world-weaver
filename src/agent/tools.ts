import { Schema } from "effect"
import { Tool, Toolkit } from "@effect/ai"

export const Speak = Tool.make("Speak", {
  description: "Speak in-character dialogue aloud in the scene.",
  parameters: {
    characterId: Schema.String.annotations({
      description: "ID of the speaking character from the cast list",
    }),
    line: Schema.String.annotations({ description: "Dialogue line" }),
  },
  success: Schema.Struct({ ok: Schema.Literal(true) }),
})

export const Remember = Tool.make("Remember", {
  description:
    "Store a lasting memory for a character (promise, discovery, relationship shift).",
  parameters: {
    characterId: Schema.String,
    memory: Schema.String,
  },
  success: Schema.Struct({ ok: Schema.Literal(true) }),
})

export const Observe = Tool.make("Observe", {
  description: "Narrate an environmental observation or sensory detail.",
  parameters: {
    narration: Schema.String,
  },
  success: Schema.Struct({ ok: Schema.Literal(true) }),
})

/** Flat params — nested `patch` objects often break OpenAI-compatible tool decoding. */
export const MutateScene = Tool.make("MutateScene", {
  description:
    "Propose a structured scene update (location, summary, who is present). Omit fields you are not changing.",
  parameters: {
    location: Schema.optional(Schema.String),
    summary: Schema.optional(Schema.String),
    presentCharacterIds: Schema.optional(Schema.Array(Schema.String)),
  },
  success: Schema.Struct({ ok: Schema.Literal(true) }),
})

export const StoryToolkit = Toolkit.make(Speak, Remember, Observe, MutateScene)

export type PendingTurn = {
  dialogues: Array<{ characterId: string; line: string }>
  narrations: Array<string>
  memories: Array<{ characterId: string; memory: string }>
  scenePatch: {
    location?: string
    summary?: string
    presentCharacterIds?: ReadonlyArray<string>
  } | null
}
