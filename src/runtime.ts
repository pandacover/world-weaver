import { Effect, Layer, ManagedRuntime } from "effect"
import type { LanguageModel } from "@effect/ai/LanguageModel"
import { AppConfig } from "./config.ts"
import { layer as dbLayer } from "./store/db.ts"
import { NovelStore } from "./store/novel-store.ts"
import { CharacterMemory } from "./memory/supermemory.ts"
import { AgentLoop } from "./agent/loop.ts"
import { resolveProviderLayer } from "./llm/provider.ts"

const buildLiveLayer = (config: {
  readonly provider: import("./llm/provider.ts").ProviderId
  readonly apiKeyValue: string | undefined
  readonly model: string
  readonly baseUrl: string | undefined
  readonly openRouterHttpReferer: string
  readonly openRouterXTitle: string
  readonly home: string
  readonly supermemoryApiKeyValue: string | undefined
}) => {
  const db = dbLayer(`${config.home}/world-weaver.sqlite`)
  const provider = resolveProviderLayer({
    provider: config.provider,
    apiKey: config.apiKeyValue,
    model: config.model,
    baseUrl: config.baseUrl,
    openRouterHttpReferer: config.openRouterHttpReferer,
    openRouterXTitle: config.openRouterXTitle,
  })
  const configLayer = Layer.succeed(AppConfig, config as never)
  const storeLayer = NovelStore.Default.pipe(Layer.provide(db))
  const memoryLayer = CharacterMemory.Default.pipe(Layer.provide(configLayer))
  const agentLayer = AgentLoop.Default.pipe(
    Layer.provide(storeLayer),
    Layer.provide(memoryLayer),
    Layer.provide(provider),
  )
  return Layer.mergeAll(
    configLayer,
    storeLayer,
    memoryLayer,
    agentLayer,
    provider,
  )
}

export const LiveLayer = Layer.unwrapEffect(
  Effect.gen(function* () {
    const config = yield* AppConfig
    return buildLiveLayer(config)
  }),
).pipe(Layer.provide(AppConfig.Default))

export type AppRuntime = ManagedRuntime.ManagedRuntime<
  AppConfig | NovelStore | CharacterMemory | AgentLoop | LanguageModel,
  unknown
>

export const createAppRuntime = (): AppRuntime =>
  ManagedRuntime.make(LiveLayer) as AppRuntime
