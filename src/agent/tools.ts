import { Schema } from "effect"
import { Tool, Toolkit } from "@effect/ai"
import { ScenePatch } from "../domain/schema.ts"

export const Speak = Tool.make("Speak", {
  description: "Speak in-character dialogue aloud in the scene.",
  parameters: {
    characterId: Schema.String,
    line: Schema.String,
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

export const MutateScene = Tool.make("MutateScene", {
  description:
    "Propose a structured scene update (location, summary, who is present).",
  parameters: {
    patch: ScenePatch,
  },
  success: Schema.Struct({ ok: Schema.Literal(true) }),
})

export const StoryToolkit = Toolkit.make(Speak, Remember, Observe, MutateScene)

export type PendingTurn = {
  dialogues: Array<{ characterId: string; line: string }>
  narrations: Array<string>
  memories: Array<{ characterId: string; memory: string }>
  scenePatch: Schema.Schema.Type<typeof ScenePatch> | null
}
