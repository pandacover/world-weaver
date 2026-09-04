import { Config, Effect, Option, Redacted } from "effect"
import type { ProviderId } from "./llm/provider.ts"

const providerIds = ["openai", "openrouter", "openai-compatible"] as const

const parseProvider = (raw: string): ProviderId => {
  if ((providerIds as readonly string[]).includes(raw)) {
    return raw as ProviderId
  }
  throw new Error(
    `Invalid LLM_PROVIDER "${raw}". Expected one of: ${providerIds.join(", ")}`,
  )
}

export class AppConfig extends Effect.Service<AppConfig>()("world-weaver/AppConfig", {
  effect: Effect.gen(function* () {
    const providerRaw = yield* Config.string("LLM_PROVIDER").pipe(
      Config.withDefault("openrouter"),
    )
    const provider = yield* Effect.try({
      try: () => parseProvider(providerRaw),
      catch: (e) =>
        new Error(e instanceof Error ? e.message : String(e)),
    })

    const apiKey = yield* Config.redacted("LLM_API_KEY").pipe(
      Config.option,
      Config.map((opt) => Option.getOrUndefined(opt)),
    )
    const model = yield* Config.string("LLM_MODEL").pipe(
      Config.withDefault(
        provider === "openrouter" ? "openai/gpt-4o-mini" : "gpt-4o-mini",
      ),
    )
    const baseUrl = yield* Config.string("LLM_BASE_URL").pipe(
      Config.option,
      Config.map((opt) => Option.getOrUndefined(opt)),
    )
    const openRouterHttpReferer = yield* Config.string("OPENROUTER_HTTP_REFERER").pipe(
      Config.withDefault("https://github.com/pandacover/world-weaver"),
    )
    const openRouterXTitle = yield* Config.string("OPENROUTER_X_TITLE").pipe(
      Config.withDefault("world-weaver"),
    )
    const supermemoryApiKey = yield* Config.redacted("SUPERMEMORY_API_KEY").pipe(
      Config.option,
      Config.map((opt) => Option.getOrUndefined(opt)),
    )
    const home = yield* Config.string("WORLD_WEAVER_HOME").pipe(
      Config.withDefault(`${process.env.HOME ?? "/tmp"}/.world-weaver`),
    )

    if (provider === "openai-compatible" && !baseUrl) {
      return yield* Effect.fail(
        new Error("LLM_BASE_URL is required when LLM_PROVIDER=openai-compatible"),
      )
    }

    return {
      provider,
      apiKey,
      model,
      baseUrl,
      openRouterHttpReferer,
      openRouterXTitle,
      supermemoryApiKey,
      home,
      apiKeyValue: apiKey ? Redacted.value(apiKey) : undefined,
      supermemoryApiKeyValue: supermemoryApiKey
        ? Redacted.value(supermemoryApiKey)
        : undefined,
    } as const
  }),
}) {}
