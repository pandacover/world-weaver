import { ScreenplaySchema, type Screenplay } from "./types.ts";

export function parseScreenplayJson(raw: string): Screenplay {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < 0) {
    throw new Error("Screenplay response did not contain JSON");
  }
  const parsed: unknown = JSON.parse(candidate.slice(start, end + 1));
  return ScreenplaySchema.parse(parsed);
}

export function buildScreenplaySystemPrompt(sceneCount: number): string {
  return `You are a short-film screenwriter for World Weaver.
Return ONLY valid JSON (no markdown) matching this shape:
{
  "title": string,
  "logline": string,
  "style": string,
  "scenes": [
    {
      "id": "s1",
      "title": string,
      "narration": string,
      "visualPrompt": string,
      "durationSeconds": number
    }
  ]
}
Rules:
- Exactly ${sceneCount} scenes, ids s1..s${sceneCount}
- Each visualPrompt is a self-contained cinematic shot description (camera, lighting, subject, motion) for video/image generation
- Keep continuity of characters/setting across scenes
- narration is spoken/caption text for that scene (1-3 sentences)
- durationSeconds between 4 and 6
- Keep the whole film short and emotionally clear`;
}
