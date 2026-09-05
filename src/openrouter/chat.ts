import {
  OpenRouterError,
  openRouterFetch,
  readErrorBody,
  type OpenRouterConfig,
} from "./client.ts";

export async function chatCompletionJson(
  config: OpenRouterConfig,
  opts: {
    model: string;
    system: string;
    user: string;
    temperature?: number;
  },
): Promise<string> {
  const response = await openRouterFetch(config, "/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: opts.model,
      temperature: opts.temperature ?? 0.7,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new OpenRouterError(
      `Chat completion failed (${response.status})`,
      response.status,
      await readErrorBody(response),
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Chat completion returned empty content");
  }
  return content;
}
