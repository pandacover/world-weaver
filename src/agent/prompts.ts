import type { Character, NovelSnapshot } from "../domain/schema.ts"
import { softBoundaryPrompt } from "./harness.ts"

export const buildDirectorSystemPrompt = (
  snapshot: NovelSnapshot,
  intentSummary: string,
): string => {
  const chapter = snapshot.chapters.find(
    (c) => c.id === snapshot.novel.currentChapterId,
  )
  const scene = snapshot.scenes.find(
    (s) => s.id === snapshot.novel.currentSceneId,
  )
  const present =
    scene?.presentCharacterIds
      .map((id) => snapshot.characters.find((c) => c.id === id)?.name ?? id)
      .join(", ") ?? "unknown"

  const transcript = snapshot.recentBeats
    .slice(-20)
    .map((b) => {
      if (b.kind === "dialogue" && b.speakerId) {
        const name =
          snapshot.characters.find((c) => c.id === b.speakerId)?.name ?? "Someone"
        return `${name}: ${b.content}`
      }
      return `[${b.kind}] ${b.content}`
    })
    .join("\n")

  return [
    "You are the Director of an interactive novel.",
    "Narrate environment outcomes, keep continuity, and use tools when needed.",
    "Do not invent new named cast members. Do not control the player character's dialogue.",
    softBoundaryPrompt(snapshot.novel.boundaries),
    "",
    `Title: ${snapshot.novel.title}`,
    `Premise: ${snapshot.novel.premise}`,
    `Chapter: ${chapter?.title ?? "unknown"}`,
    `Scene location: ${scene?.location ?? "unknown"}`,
    `Scene summary: ${scene?.summary ?? ""}`,
    `Present: ${present}`,
    `Cast: ${snapshot.characters.map((c) => `${c.name} (${c.role}, id=${c.id})`).join("; ")}`,
    "",
    "Recent transcript:",
    transcript || "(empty)",
    "",
    `User intent: ${intentSummary}`,
  ].join("\n")
}

export const buildCharacterSystemPrompt = (
  snapshot: NovelSnapshot,
  character: Character,
  memories: ReadonlyArray<string>,
  addressedBy: string,
): string => {
  const scene = snapshot.scenes.find(
    (s) => s.id === snapshot.novel.currentSceneId,
  )
  return [
    `You are ${character.name}, a character in an interactive novel.`,
    "Stay in character. Use the Speak tool for dialogue. Use Remember for lasting facts.",
    softBoundaryPrompt(snapshot.novel.boundaries),
    "",
    `Personality: ${character.personalityTraits.join(", ") || "unspecified"}`,
    `Physical: ${character.physicalTraits.join(", ") || "unspecified"}`,
    character.voiceNotes ? `Voice: ${character.voiceNotes}` : "",
    `Your character id: ${character.id}`,
    `Scene: ${scene?.location ?? "unknown"} — ${scene?.summary ?? ""}`,
    `Addressed by: ${addressedBy}`,
    "",
    "Relevant memories:",
    memories.length > 0 ? memories.map((m) => `- ${m}`).join("\n") : "- (none)",
  ]
    .filter(Boolean)
    .join("\n")
}
