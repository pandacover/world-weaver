import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai"
import { FetchHttpClient, HttpClient, HttpClientRequest } from "@effect/platform"
import type { LanguageModel } from "@effect/ai/LanguageModel"
import { Layer, Redacted } from "effect"
import type { ProviderConfig } from "../provider.ts"
import { withReasoningEffortSanitizer } from "../sanitize-response.ts"

export const openrouterLayer = (
  config: ProviderConfig,
): Layer.Layer<LanguageModel, never, never> => {
  const referer = config.openRouterHttpReferer
  const title = config.openRouterXTitle

  const client = OpenAiClient.layer({
    apiKey: config.apiKey ? Redacted.make(config.apiKey) : undefined,
    apiUrl: "https://openrouter.ai/api/v1",
    transformClient: (httpClient) =>
      withReasoningEffortSanitizer(
        HttpClient.mapRequest(httpClient, (request) =>
          request.pipe(
            HttpClientRequest.setHeader("HTTP-Referer", referer),
            HttpClientRequest.setHeader("X-Title", title),
          ),
        ),
      ),
  }).pipe(Layer.provide(FetchHttpClient.layer))

  return OpenAiLanguageModel.layer({ model: config.model }).pipe(
    Layer.provide(client),
  )
}
