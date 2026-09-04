/**
 * Smoke test: SQLite create/list + provider layer construction (no live LLM call).
 */
import { Effect, Layer, ManagedRuntime, Schema } from "effect"
import { Reasoning } from "@effect/ai-openai/Generated"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AppConfig } from "./config.ts"
import { layer as dbLayer } from "./store/db.ts"
import { NovelStore } from "./store/novel-store.ts"
import { resolveProviderLayer } from "./llm/provider.ts"
import { sanitizeReasoningEffortJson } from "./llm/sanitize-response.ts"
import { parseInput } from "./agent/loop.ts"
import { softBoundaryPrompt, validateScenePatch } from "./agent/harness.ts"
import type { NovelSnapshot } from "./domain/schema.ts"

const home = mkdtempSync(join(tmpdir(), "world-weaver-smoke-"))

const fakeConfig = {
  provider: "openrouter" as const,
  apiKey: undefined,
  apiKeyValue: undefined,
  model: "openai/gpt-4o-mini",
  baseUrl: undefined,
  openRouterHttpReferer: "https://example.com",
  openRouterXTitle: "world-weaver-smoke",
  supermemoryApiKey: undefined,
  supermemoryApiKeyValue: undefined,
  home,
}

const layer = NovelStore.Default.pipe(
  Layer.provide(dbLayer(join(home, "world-weaver.sqlite"))),
  Layer.provideMerge(Layer.succeed(AppConfig, fakeConfig as never)),
)

const runtime = ManagedRuntime.make(layer)

const program = Effect.gen(function* () {
  const store = yield* NovelStore
  const created = yield* store.createNovel({
    title: "Smoke Harbor",
    premise: "A test premise",
    boundaries: {
      tone: "grounded",
      settingRules: ["Keep continuity"],
      hardRejects: ["No anachronisms"],
    },
    player: {
      name: "Mara",
      personalityTraits: ["curious"],
      physicalTraits: ["coat"],
    },
    npcs: [
      {
        name: "Corvin",
        personalityTraits: ["wry"],
        physicalTraits: ["cloak"],
      },
    ],
    openingLocation: "Quay",
    openingSummary: "Rain on the quay.",
  })

  console.log("created novel:", created.novel.id, created.novel.title)
  console.log("characters:", created.characters.map((c) => c.name).join(", "))
  console.log("scenes:", created.scenes.length)
  console.log("beats:", created.recentBeats.length)

  const listed = yield* store.listNovels()
  console.log("listed novels:", listed.length)

  yield* store.appendBeat({
    novelId: created.novel.id,
    sceneId: created.novel.currentSceneId!,
    kind: "dialogue",
    speakerId: created.characters.find((c) => c.role === "player")!.id,
    content: "Hello, Corvin.",
  })

  const snap = (yield* store.getSnapshot(created.novel.id))!
  console.log("beats after append:", snap.recentBeats.length)

  // Harness
  const prompt = softBoundaryPrompt(snap.novel.boundaries)
  console.log("boundary prompt lines:", prompt.split("\n").length)

  const okPatch = yield* validateScenePatch(snap, {
    summary: "The rain thickens.",
  })
  console.log("validated patch summary:", okPatch.summary)

  // Intent parsing
  console.log("parse @Corvin:", parseInput("@Corvin What do you want?", null))
  console.log("parse /look:", parseInput("/look", "Corvin"))
  console.log("parse /look character:", parseInput("/look character", null))
  console.log("parse /continue:", parseInput("/continue", null))

  // Provider adapter constructs without throwing
  const providerLayer = resolveProviderLayer({
    provider: "openrouter",
    apiKey: "sk-test",
    model: "openai/gpt-4o-mini",
    baseUrl: undefined,
    openRouterHttpReferer: "https://example.com",
    openRouterXTitle: "smoke",
  })
  console.log("openrouter layer ok:", Boolean(providerLayer))

  const openaiLayer = resolveProviderLayer({
    provider: "openai",
    apiKey: "sk-test",
    model: "gpt-4o-mini",
    baseUrl: undefined,
    openRouterHttpReferer: "",
    openRouterXTitle: "",
  })
  console.log("openai layer ok:", Boolean(openaiLayer))

  const compatLayer = resolveProviderLayer({
    provider: "openai-compatible",
    apiKey: "sk-test",
    model: "local-model",
    baseUrl: "http://127.0.0.1:11434/v1",
    openRouterHttpReferer: "",
    openRouterXTitle: "",
  })
  console.log("openai-compatible layer ok:", Boolean(compatLayer))

  const before = JSON.stringify({
    id: "resp",
    reasoning: { effort: "max", summary: null },
  })
  const after = sanitizeReasoningEffortJson(before)
  const parsed = JSON.parse(after) as { reasoning: { effort: string } }
  if (parsed.reasoning.effort !== "high") {
    return yield* Effect.fail(
      new Error(`expected effort high, got ${parsed.reasoning.effort}`),
    )
  }
  console.log("reasoning effort sanitize ok:", parsed.reasoning.effort)

  // Patched @effect/ai-openai schema must accept effort "max" directly
  const decoded = Schema.decodeUnknownSync(Reasoning)({
    effort: "max",
    summary: null,
  })
  console.log("schema accepts effort max ok:", decoded.effort)

  // unused typed snapshot reference for compile confidence
  const _s: NovelSnapshot = snap
  void _s

  console.log("SMOKE_OK")
})

await runtime.runPromise(program)
await runtime.dispose()
