import {
  OpenRouterError,
  openRouterFetch,
  readErrorBody,
  type OpenRouterConfig,
} from "./client.ts";

export type VideoJobSubmit = {
  id: string;
  polling_url: string;
  status: string;
};

export type VideoJobStatus = {
  id: string;
  status: "pending" | "in_progress" | "completed" | "failed" | string;
  polling_url?: string;
  unsigned_urls?: string[];
  error?: string;
};

export async function submitVideoJob(
  config: OpenRouterConfig,
  opts: {
    model: string;
    prompt: string;
    duration?: number;
    resolution?: string;
    aspectRatio?: string;
    generateAudio?: boolean;
  },
): Promise<VideoJobSubmit> {
  const response = await openRouterFetch(config, "/videos", {
    method: "POST",
    body: JSON.stringify({
      model: opts.model,
      prompt: opts.prompt,
      duration: opts.duration ?? 5,
      resolution: opts.resolution ?? "480p",
      aspect_ratio: opts.aspectRatio ?? "16:9",
      generate_audio: opts.generateAudio ?? true,
    }),
  });

  if (!response.ok) {
    throw new OpenRouterError(
      `Video submit failed (${response.status})`,
      response.status,
      await readErrorBody(response),
    );
  }

  return (await response.json()) as VideoJobSubmit;
}

export async function pollVideoJob(
  config: OpenRouterConfig,
  pollingUrl: string,
): Promise<VideoJobStatus> {
  const response = await openRouterFetch(config, pollingUrl, { method: "GET" });
  if (!response.ok) {
    throw new OpenRouterError(
      `Video poll failed (${response.status})`,
      response.status,
      await readErrorBody(response),
    );
  }
  return (await response.json()) as VideoJobStatus;
}

export async function waitForVideo(
  config: OpenRouterConfig,
  submit: VideoJobSubmit,
  opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<Uint8Array> {
  const intervalMs = opts?.intervalMs ?? 5000;
  const timeoutMs = opts?.timeoutMs ?? 10 * 60 * 1000;
  const started = Date.now();
  let pollingUrl = submit.polling_url;

  while (Date.now() - started < timeoutMs) {
    const status = await pollVideoJob(config, pollingUrl);
    if (status.polling_url) pollingUrl = status.polling_url;

    if (status.status === "completed") {
      const url = status.unsigned_urls?.[0];
      if (!url) {
        throw new Error("Video completed but no unsigned_urls returned");
      }
      const videoResponse = await openRouterFetch(config, url, {
        method: "GET",
      });
      if (!videoResponse.ok) {
        throw new OpenRouterError(
          `Video download failed (${videoResponse.status})`,
          videoResponse.status,
          await readErrorBody(videoResponse),
        );
      }
      return new Uint8Array(await videoResponse.arrayBuffer());
    }

    if (status.status === "failed") {
      throw new Error(status.error ?? "Video generation failed");
    }

    await Bun.sleep(intervalMs);
  }

  throw new Error("Timed out waiting for video generation");
}
