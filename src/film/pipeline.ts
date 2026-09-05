import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chatCompletionJson } from "../openrouter/chat.ts";
import type { OpenRouterConfig } from "../openrouter/client.ts";
import { generateImage } from "../openrouter/images.ts";
import { submitVideoJob, waitForVideo } from "../openrouter/videos.ts";
import {
  buildScreenplaySystemPrompt,
  parseScreenplayJson,
} from "./screenplay.ts";
import type {
  CreateFilmRequest,
  FilmJobEvent,
  SceneMedia,
  ShortFilm,
} from "./types.ts";

export type FilmStore = {
  root: string;
  films: Map<string, ShortFilm>;
  listeners: Map<string, Set<(event: FilmJobEvent) => void>>;
};

export function createFilmStore(root = ".data/films"): FilmStore {
  return {
    root,
    films: new Map(),
    listeners: new Map(),
  };
}

export function subscribe(
  store: FilmStore,
  filmId: string,
  listener: (event: FilmJobEvent) => void,
): () => void {
  const set = store.listeners.get(filmId) ?? new Set();
  set.add(listener);
  store.listeners.set(filmId, set);
  return () => {
    set.delete(listener);
  };
}

function emit(store: FilmStore, filmId: string, event: FilmJobEvent) {
  const set = store.listeners.get(filmId);
  if (!set) return;
  for (const listener of set) listener(event);
}

function extForMime(mime: string, fallback: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
  return fallback;
}

export async function runFilmJob(
  store: FilmStore,
  filmId: string,
  request: CreateFilmRequest,
): Promise<void> {
  const apiKey = request.apiKey?.trim() || process.env.OPENROUTER_API_KEY || "";
  if (!apiKey) {
    const message =
      "Missing OpenRouter API key. Set OPENROUTER_API_KEY or paste a key in the form.";
    const film = store.films.get(filmId);
    if (film) {
      film.status = "failed";
      film.error = message;
    }
    emit(store, filmId, { type: "error", message });
    return;
  }

  const config: OpenRouterConfig = { apiKey };
  const chatModel =
    request.chatModel ||
    process.env.OPENROUTER_CHAT_MODEL ||
    "google/gemini-3.8-flash";
  const videoModel =
    request.videoModel ||
    process.env.OPENROUTER_VIDEO_MODEL ||
    "alibaba/wan-3.0";
  const imageModel =
    request.imageModel ||
    process.env.OPENROUTER_IMAGE_MODEL ||
    "bytedance-seed/seedream-5-0-lite";
  const sceneCount = Math.min(5, Math.max(3, request.sceneCount ?? 4));
  const mediaMode = request.mediaMode ?? "video";
  const styleNote = request.styleNote?.trim() || "cinematic, grounded, intimate";

  const filmDir = join(store.root, filmId);
  await mkdir(filmDir, { recursive: true });

  const film = store.films.get(filmId);
  if (!film) return;

  film.status = "running";
  emit(store, filmId, {
    type: "status",
    status: "running",
    message: "Writing screenplay…",
  });

  try {
    const raw = await chatCompletionJson(config, {
      model: chatModel,
      system: buildScreenplaySystemPrompt(sceneCount),
      user: `Premise: ${request.premise}\nStyle note: ${styleNote}`,
    });
    const screenplay = parseScreenplayJson(raw);
    film.screenplay = screenplay;
    emit(store, filmId, { type: "screenplay", screenplay });
    await writeFile(
      join(filmDir, "screenplay.json"),
      JSON.stringify(screenplay, null, 2),
    );

    const media: SceneMedia[] = [];
    for (const [index, scene] of screenplay.scenes.entries()) {
      emit(store, filmId, {
        type: "scene",
        sceneId: scene.id,
        index: index + 1,
        total: screenplay.scenes.length,
        message: `Rendering scene ${index + 1}/${screenplay.scenes.length}: ${scene.title}`,
      });

      const visual = `${screenplay.style}. ${scene.visualPrompt}. Continuity with film "${screenplay.title}".`;

      try {
        if (mediaMode === "video") {
          const submit = await submitVideoJob(config, {
            model: videoModel,
            prompt: visual,
            duration: scene.durationSeconds,
            resolution: "480p",
            aspectRatio: "16:9",
          });
          const bytes = await waitForVideo(config, submit, {
            intervalMs: 5000,
            timeoutMs: 12 * 60 * 1000,
          });
          const fileName = `${scene.id}.mp4`;
          await writeFile(join(filmDir, fileName), bytes);
          const item: SceneMedia = {
            sceneId: scene.id,
            kind: "video",
            fileName,
            mimeType: "video/mp4",
            caption: scene.narration,
            holdSeconds: scene.durationSeconds,
          };
          media.push(item);
          film.media = [...media];
          emit(store, filmId, { type: "media", media: item });
        } else {
          const image = await generateImage(config, {
            model: imageModel,
            prompt: visual,
            aspectRatio: "16:9",
          });
          const ext = extForMime(image.mimeType, "png");
          const fileName = `${scene.id}.${ext}`;
          await writeFile(join(filmDir, fileName), image.bytes);
          const item: SceneMedia = {
            sceneId: scene.id,
            kind: "image",
            fileName,
            mimeType: image.mimeType,
            caption: scene.narration,
            holdSeconds: scene.durationSeconds,
          };
          media.push(item);
          film.media = [...media];
          emit(store, filmId, { type: "media", media: item });
        }
      } catch (sceneError) {
        // Prefer stills fallback when video path fails for a scene
        if (mediaMode === "video") {
          try {
            emit(store, filmId, {
              type: "scene",
              sceneId: scene.id,
              index: index + 1,
              total: screenplay.scenes.length,
              message: `Video failed for ${scene.title}; generating still…`,
            });
            const image = await generateImage(config, {
              model: imageModel,
              prompt: visual,
              aspectRatio: "16:9",
            });
            const ext = extForMime(image.mimeType, "png");
            const fileName = `${scene.id}.${ext}`;
            await writeFile(join(filmDir, fileName), image.bytes);
            const item: SceneMedia = {
              sceneId: scene.id,
              kind: "image",
              fileName,
              mimeType: image.mimeType,
              caption: scene.narration,
              holdSeconds: scene.durationSeconds,
              error:
                sceneError instanceof Error
                  ? sceneError.message
                  : "Video generation failed",
            };
            media.push(item);
            film.media = [...media];
            emit(store, filmId, { type: "media", media: item });
            continue;
          } catch (fallbackError) {
            const item: SceneMedia = {
              sceneId: scene.id,
              kind: "image",
              fileName: "",
              mimeType: "text/plain",
              caption: scene.narration,
              holdSeconds: scene.durationSeconds,
              error:
                fallbackError instanceof Error
                  ? fallbackError.message
                  : "Scene media failed",
            };
            media.push(item);
            film.media = [...media];
            emit(store, filmId, { type: "media", media: item });
            continue;
          }
        }

        const item: SceneMedia = {
          sceneId: scene.id,
          kind: "image",
          fileName: "",
          mimeType: "text/plain",
          caption: scene.narration,
          holdSeconds: scene.durationSeconds,
          error:
            sceneError instanceof Error
              ? sceneError.message
              : "Scene media failed",
        };
        media.push(item);
        film.media = [...media];
        emit(store, filmId, { type: "media", media: item });
      }
    }

    film.media = media;
    film.status = "completed";
    await writeFile(join(filmDir, "film.json"), JSON.stringify(film, null, 2));
    emit(store, filmId, { type: "done", film });
    emit(store, filmId, {
      type: "status",
      status: "completed",
      message: "Short film ready",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Film job failed";
    film.status = "failed";
    film.error = message;
    emit(store, filmId, { type: "error", message });
  }
}

export function createEmptyFilm(
  id: string,
  request: CreateFilmRequest,
): ShortFilm {
  return {
    id,
    premise: request.premise,
    mediaMode: request.mediaMode ?? "video",
    screenplay: {
      title: "Untitled",
      logline: "",
      style: request.styleNote ?? "",
      scenes: [],
    },
    media: [],
    createdAt: new Date().toISOString(),
    status: "queued",
  };
}
