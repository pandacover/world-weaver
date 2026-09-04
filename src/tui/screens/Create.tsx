import { useState } from "react"
import { useKeyboard } from "@opentui/react"
import type { CreateNovelInput } from "../../domain/schema.ts"

export type CreateScreenProps = {
  busy: boolean
  onCancel: () => void
  onSubmit: (input: CreateNovelInput) => void
}

type Field =
  | "title"
  | "premise"
  | "tone"
  | "playerName"
  | "npcName"
  | "location"
  | "summary"

const fields: Field[] = [
  "title",
  "premise",
  "tone",
  "playerName",
  "npcName",
  "location",
  "summary",
]

const labels: Record<Field, string> = {
  title: "Title",
  premise: "Premise / world",
  tone: "Tone boundary",
  playerName: "Player character name",
  npcName: "First NPC name",
  location: "Opening location",
  summary: "Opening scene summary",
}

export function CreateScreen({ busy, onCancel, onSubmit }: CreateScreenProps) {
  const [index, setIndex] = useState(0)
  const [values, setValues] = useState<Record<Field, string>>({
    title: "Ash Harbor",
    premise: "A fog-bound port town where debts are paid in secrets.",
    tone: "noir literary, grounded, no comedy slapstick",
    playerName: "Mara",
    npcName: "Corvin",
    location: "Harbor quay",
    summary:
      "Rain needles the quay. Lanterns smear gold across black water. Corvin waits by a mooring post.",
  })
  const [draft, setDraft] = useState(values[fields[0]!])

  const field = fields[index]!

  useKeyboard((key) => {
    if (busy) return
    if (key.name === "escape") {
      onCancel()
      return
    }
    if (key.name === "tab" || key.name === "down") {
      const nextValues = { ...values, [field]: draft }
      setValues(nextValues)
      const next = Math.min(index + 1, fields.length - 1)
      setIndex(next)
      setDraft(nextValues[fields[next]!])
      return
    }
    if (key.name === "up") {
      const nextValues = { ...values, [field]: draft }
      setValues(nextValues)
      const next = Math.max(index - 1, 0)
      setIndex(next)
      setDraft(nextValues[fields[next]!])
      return
    }
    if (key.name === "return") {
      const finalValues = { ...values, [field]: draft }
      setValues(finalValues)
      if (index < fields.length - 1) {
        const next = index + 1
        setIndex(next)
        setDraft(finalValues[fields[next]!])
        return
      }
      onSubmit({
        title: finalValues.title.trim() || "Untitled",
        premise: finalValues.premise.trim(),
        boundaries: {
          tone: finalValues.tone.trim() || undefined,
          settingRules: ["Stay consistent with established facts"],
          hardRejects: ["Do not break the fourth wall", "No modern anachronisms"],
          allowedLocations: undefined,
        },
        player: {
          name: finalValues.playerName.trim() || "Player",
          personalityTraits: ["curious", "cautious"],
          physicalTraits: ["travel-worn coat"],
        },
        npcs: [
          {
            name: finalValues.npcName.trim() || "Guide",
            personalityTraits: ["wry", "observant"],
            physicalTraits: ["scarred hands", "oilskin cloak"],
            voiceNotes: "Speaks in short, dry sentences.",
          },
        ],
        openingLocation: finalValues.location.trim() || "Somewhere",
        openingSummary:
          finalValues.summary.trim() || "The story begins.",
        chapterTitle: "Chapter 1",
      })
      return
    }
    if (key.name === "backspace") {
      setDraft((d) => d.slice(0, -1))
      return
    }
    if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
      setDraft((d) => d + key.sequence)
    }
  })

  return (
    <box flexGrow={1} flexDirection="column" gap={1}>
      <text fg="#c4a35a">Create novel</text>
      <text fg="#9ca3af">
        Tab/Enter next field · Enter on last field creates · Esc cancel
      </text>

      {fields.map((f, i) => (
        <box key={f} flexDirection="column">
          <text fg={i === index ? "#93c5fd" : "#6b7280"}>
            {i === index ? ">" : " "} {labels[f]}
          </text>
          <text fg={i === index ? "#f3f4f6" : "#9ca3af"}>
            {i === index ? draft : values[f]}
            {i === index ? "█" : ""}
          </text>
        </box>
      ))}

      {busy && <text fg="#c4a35a">Creating…</text>}
    </box>
  )
}
