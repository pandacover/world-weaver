import { Effect } from "effect"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import type * as HttpClientError from "@effect/platform/HttpClientError"

/**
 * OpenAI / OpenRouter sometimes return `reasoning.effort: "max"`.
 * `@effect/ai-openai` only decodes none|minimal|low|medium|high, which
 * becomes ParseError on createResponse. Normalize unknown efforts before
 * Effect's schema decode runs.
 */
const KNOWN_EFFORTS = new Set(["none", "minimal", "low", "medium", "high"])

export const sanitizeReasoningEffortJson = (raw: string): string => {
  if (!raw.includes('"effort"')) {
    return raw
  }
  try {
    const data = JSON.parse(raw) as unknown
    return walk(data) ? JSON.stringify(data) : raw
  } catch {
    return raw
  }
}

const walk = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    let changed = false
    for (const item of value) {
      if (walk(item)) changed = true
    }
    return changed
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>
    let changed = false
    if (typeof obj.effort === "string" && !KNOWN_EFFORTS.has(obj.effort)) {
      // Provider-specific values like "max" → closest supported level.
      obj.effort = "high"
      changed = true
    }
    for (const child of Object.values(obj)) {
      if (walk(child)) changed = true
    }
    return changed
  }
  return false
}

export const withReasoningEffortSanitizer = <E, R>(
  client: HttpClient.HttpClient.With<E, R>,
): HttpClient.HttpClient.With<E | HttpClientError.ResponseError, R> =>
  HttpClient.transformResponse(client, (effect) =>
    Effect.flatMap(effect, (response) =>
      Effect.gen(function* () {
        const contentType = response.headers["content-type"] ?? ""
        if (contentType.includes("text/event-stream")) {
          return response
        }
        const body = yield* response.text
        const patched = sanitizeReasoningEffortJson(body)
        return HttpClientResponse.fromWeb(
          response.request,
          new Response(patched, {
            status: response.status,
            headers: response.headers as HeadersInit,
          }),
        )
      }),
    ),
  )
