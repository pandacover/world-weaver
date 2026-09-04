import { useState } from "react"
import { useKeyboard } from "@opentui/react"
import type { NovelSnapshot } from "../../domain/schema.ts"

export type PlayScreenProps = {
  snapshot: NovelSnapshot
  log: ReadonlyArray<string>
  focusedCharacter: string | null
  busy: boolean
  onFocusChange: (name: string | null) => void
  onSubmit: (line: string) => void
}

export function PlayScreen({
  snapshot,
  log,
  focusedCharacter,
  busy,
  onFocusChange,
  onSubmit,
}: PlayScreenProps) {
  const [draft, setDraft] = useState("")
  const chapter = snapshot.chapters.find(
    (c) => c.id === snapshot.novel.currentChapterId,
  )
  const scene = snapshot.scenes.find(
    (s) => s.id === snapshot.novel.currentSceneId,
  )
  const present =
    scene?.presentCharacterIds
      .map((id) => snapshot.characters.find((c) => c.id === id)?.name ?? id)
      .join(", ") ?? ""

  useKeyboard((key) => {
    if (busy) return
    if (key.name === "return") {
      const line = draft.trim()
      if (!line) return
      setDraft("")
      onSubmit(line)
      return
    }
    if (key.name === "backspace") {
      setDraft((d) => d.slice(0, -1))
      return
    }
    if (key.name === "tab") {
      const npcs = snapshot.characters.filter((c) => c.role === "npc")
      if (npcs.length === 0) return
      const idx = npcs.findIndex((c) => c.name === focusedCharacter)
      const next = npcs[(idx + 1) % npcs.length]
      onFocusChange(next?.name ?? null)
      return
    }
    if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
      setDraft((d) => d + key.sequence)
    }
  })

  const visibleLog = log.slice(-30)

  return (
    <box flexGrow={1} flexDirection="row" gap={1}>
      <box flexGrow={3} flexDirection="column" border={true} borderColor="#374151" padding={1}>
        <text fg="#c4a35a">Narrative</text>
        <scrollbox flexGrow={1} stickyScroll={true}>
          {visibleLog.map((line, i) => (
            <text key={`${i}-${line.slice(0, 12)}`} fg="#e5e7eb">
              {line}
            </text>
          ))}
        </scrollbox>
        <box marginTop={1} flexDirection="column">
          <text fg="#6b7280">
            @Name chat · /act · /look · /continue · /info · Tab focus NPC · Esc
            home
          </text>
          <text fg={busy ? "#6b7280" : "#93c5fd"}>
            {busy ? "…generating…" : `> ${draft}█`}
          </text>
        </box>
      </box>

      <box
        width={36}
        flexDirection="column"
        border={true}
        borderColor="#374151"
        padding={1}
        gap={1}
      >
        <text fg="#c4a35a">Info</text>
        <text fg="#f3f4f6">{snapshot.novel.title}</text>
        <text fg="#9ca3af">Chapter: {chapter?.title ?? "?"}</text>
        <text fg="#9ca3af">Scene: {scene?.location ?? "?"}</text>
        <text fg="#6b7280">{scene?.summary ?? ""}</text>
        <text fg="#9ca3af">Present: {present}</text>
        <text fg="#c4a35a">Cast</text>
        {snapshot.characters.map((c) => (
          <text
            key={c.id}
            fg={
              c.name === focusedCharacter
                ? "#93c5fd"
                : c.role === "player"
                  ? "#fbbf24"
                  : "#e5e7eb"
            }
          >
            {c.name === focusedCharacter ? "› " : "  "}
            {c.name} ({c.role})
          </text>
        ))}
        <text fg="#6b7280">
          Focus: {focusedCharacter ?? "(none)"} — bare chat goes to focus
        </text>
      </box>
    </box>
  )
}
