import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai"
import type { LanguageModel } from "@effect/ai/LanguageModel"
import { Layer, Redacted } from "effect"
import type { ProviderConfig } from "../provider.ts"
import { SanitizedFetchHttpClientLive } from "../http-client.ts"
import { withReasoningEffortSanitizer } from "../sanitize-response.ts"

export const openaiLayer = (
  config: ProviderConfig,
): Layer.Layer<LanguageModel, never, never> => {
  const client = OpenAiClient.layer({
    apiKey: config.apiKey ? Redacted.make(config.apiKey) : undefined,
    apiUrl: config.baseUrl ?? "https://api.openai.com/v1",
    transformClient: withReasoningEffortSanitizer,
  }).pipe(Layer.provide(SanitizedFetchHttpClientLive))

  return OpenAiLanguageModel.layer({ model: config.model }).pipe(
    Layer.provide(client),
  )
}
