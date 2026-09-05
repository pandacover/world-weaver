import { z } from "zod";

export const MediaKindSchema = z.enum(["video", "image"]);
export type MediaKind = z.infer<typeof MediaKindSchema>;

export const SceneSchema = z.object({
  id: z.string(),
  title: z.string(),
  narration: z.string(),
  visualPrompt: z.string(),
  durationSeconds: z.number().int().min(2).max(12).default(5),
});
export type Scene = z.infer<typeof SceneSchema>;

export const ScreenplaySchema = z.object({
  title: z.string(),
  logline: z.string(),
  style: z.string(),
  scenes: z.array(SceneSchema).min(1).max(8),
});
export type Screenplay = z.infer<typeof ScreenplaySchema>;

export const SceneMediaSchema = z.object({
  sceneId: z.string(),
  kind: MediaKindSchema,
  fileName: z.string(),
  mimeType: z.string(),
  caption: z.string(),
  holdSeconds: z.number().positive(),
  error: z.string().optional(),
});
export type SceneMedia = z.infer<typeof SceneMediaSchema>;

export const ShortFilmSchema = z.object({
  id: z.string(),
  premise: z.string(),
  mediaMode: z.enum(["video", "stills"]),
  screenplay: ScreenplaySchema,
  media: z.array(SceneMediaSchema),
  createdAt: z.string(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  error: z.string().optional(),
});
export type ShortFilm = z.infer<typeof ShortFilmSchema>;

export type FilmJobEvent =
  | { type: "status"; status: ShortFilm["status"]; message: string }
  | { type: "screenplay"; screenplay: Screenplay }
  | {
      type: "scene";
      sceneId: string;
      index: number;
      total: number;
      message: string;
    }
  | { type: "media"; media: SceneMedia }
  | { type: "done"; film: ShortFilm }
  | { type: "error"; message: string };

export type CreateFilmRequest = {
  premise: string;
  styleNote?: string;
  sceneCount?: number;
  mediaMode?: "video" | "stills";
  apiKey?: string;
  chatModel?: string;
  videoModel?: string;
  imageModel?: string;
};
