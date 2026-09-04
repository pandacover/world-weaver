import { Effect, Layer } from "effect"
import * as HttpClient from "@effect/platform/HttpClient"
import { FetchHttpClient } from "@effect/platform"
import { withReasoningEffortSanitizer } from "./sanitize-response.ts"

/**
 * Fetch HttpClient with reasoning.effort sanitization applied at the
 * transport layer (not only via OpenAiClient.transformClient).
 */
export const SanitizedFetchHttpClientLive = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const base = yield* HttpClient.HttpClient
    return withReasoningEffortSanitizer(base)
  }),
).pipe(Layer.provide(FetchHttpClient.layer))
