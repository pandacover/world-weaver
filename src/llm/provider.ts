import { Layer } from "effect"
import type { LanguageModel } from "@effect/ai/LanguageModel"
import { openaiLayer } from "./providers/openai.ts"
import { openrouterLayer } from "./providers/openrouter.ts"
import { openaiCompatibleLayer } from "./providers/openai-compatible.ts"

export type ProviderId = "openai" | "openrouter" | "openai-compatible"

export type ProviderConfig = {
  readonly provider: ProviderId
  readonly apiKey: string | undefined
  readonly model: string
  readonly baseUrl: string | undefined
  readonly openRouterHttpReferer: string
  readonly openRouterXTitle: string
}

/**
 * Resolves a named OpenAI-wire provider into a LanguageModel layer.
 * Agent code should depend only on LanguageModel, never vendor clients.
 */
export const resolveProviderLayer = (
  config: ProviderConfig,
): Layer.Layer<LanguageModel, never, never> => {
  switch (config.provider) {
    case "openai":
      return openaiLayer(config)
    case "openrouter":
      return openrouterLayer(config)
    case "openai-compatible":
      return openaiCompatibleLayer(config)
  }
}
