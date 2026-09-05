import {
  OpenRouterError,
  openRouterFetch,
  readErrorBody,
  type OpenRouterConfig,
} from "./client.ts";

export type GeneratedImage = {
  bytes: Uint8Array;
  mimeType: string;
};

export async function generateImage(
  config: OpenRouterConfig,
  opts: {
    model: string;
    prompt: string;
    aspectRatio?: string;
  },
): Promise<GeneratedImage> {
  const response = await openRouterFetch(config, "/images", {
    method: "POST",
    body: JSON.stringify({
      model: opts.model,
      prompt: opts.prompt,
      aspect_ratio: opts.aspectRatio ?? "16:9",
      n: 1,
    }),
  });

  if (!response.ok) {
    throw new OpenRouterError(
      `Image generation failed (${response.status})`,
      response.status,
      await readErrorBody(response),
    );
  }

  const data = (await response.json()) as {
    data?: Array<{ b64_json?: string; media_type?: string }>;
  };
  const image = data.data?.[0];
  if (!image?.b64_json) {
    throw new Error("Image generation returned no image data");
  }

  const mimeType = image.media_type ?? "image/png";
  const bytes = Uint8Array.from(atob(image.b64_json), (c) => c.charCodeAt(0));
  return { bytes, mimeType };
}
