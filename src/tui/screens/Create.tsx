import { useRef, useState } from "react"
import { useKeyboard } from "@opentui/react"
import type { InputRenderable, TextareaRenderable } from "@opentui/core"
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

const multiline = new Set<Field>(["premise", "tone", "summary"])

const labels: Record<Field, string> = {
  title: "Title",
  premise: "Premise / world",
  tone: "Tone boundary",
  playerName: "Player character name",
  npcName: "First NPC name",
  location: "Opening location",
  summary: "Opening scene summary",
}

const defaults: Record<Field, string> = {
  title: "Ash Harbor",
  premise: "A fog-bound port town where debts are paid in secrets.",
  tone: "noir literary, grounded, no comedy slapstick",
  playerName: "Mara",
  npcName: "Corvin",
  location: "Harbor quay",
  summary:
    "Rain needles the quay. Lanterns smear gold across black water. Corvin waits by a mooring post.",
}

export function CreateScreen({ busy, onCancel, onSubmit }: CreateScreenProps) {
  const [index, setIndex] = useState(0)
  const [values, setValues] = useState<Record<Field, string>>(defaults)
  const inputRefs = useRef<Partial<Record<Field, InputRenderable | null>>>({})
  const textareaRefs = useRef<Partial<Record<Field, TextareaRenderable | null>>>({})

  const field = fields[index]!

  const readField = (f: Field): string => {
    if (multiline.has(f)) {
      return textareaRefs.current[f]?.plainText ?? values[f]
    }
    return inputRefs.current[f]?.value ?? values[f]
  }

  const syncCurrent = (): Record<Field, string> => {
    const next = { ...values, [field]: readField(field) }
    setValues(next)
    return next
  }

  const goTo = (nextIndex: number) => {
    const synced = syncCurrent()
    const clamped = Math.max(0, Math.min(nextIndex, fields.length - 1))
    setIndex(clamped)
    // keep values in state for unfocused display
    setValues(synced)
  }

  const submit = () => {
    const finalValues = syncCurrent()
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
      openingSummary: finalValues.summary.trim() || "The story begins.",
      chapterTitle: "Chapter 1",
    })
  }

  useKeyboard((key) => {
    if (busy) return
    if (key.name === "escape") {
      onCancel()
      return
    }
    if (key.name === "tab" && !key.shift) {
      key.preventDefault()
      if (index >= fields.length - 1) submit()
      else goTo(index + 1)
      return
    }
    if (key.name === "tab" && key.shift) {
      key.preventDefault()
      goTo(index - 1)
      return
    }
    // Ctrl+Enter submits from any field / advances
    if (key.name === "return" && key.ctrl) {
      key.preventDefault()
      if (index >= fields.length - 1) submit()
      else goTo(index + 1)
    }
  })

  return (
    <box flexGrow={1} flexDirection="column" gap={1}>
      <box flexDirection="column" gap={0}>
        <text fg="#c4a35a">Create novel</text>
        <text fg="#9ca3af">
          Tab next · Shift+Tab back · Enter advances single-line · newlines OK in
          multi-line · Ctrl+Enter next/create · Esc cancel
        </text>
      </box>

      <scrollbox flexGrow={1} stickyScroll={false} focused={false}>
        <box flexDirection="column" gap={1} paddingRight={1}>
          {fields.map((f, i) => {
            const active = i === index
            const isMulti = multiline.has(f)
            return (
              <box
                key={f}
                flexDirection="column"
                border
                borderColor={active ? "#60a5fa" : "#374151"}
                padding={1}
                backgroundColor={active ? "#111827" : "#0f1419"}
              >
                <text fg={active ? "#93c5fd" : "#9ca3af"}>
                  {active ? "› " : "  "}
                  {labels[f]}
                  {isMulti ? " (multi-line)" : ""}
                </text>
                {isMulti ? (
                  <textarea
                    ref={(node) => {
                      textareaRefs.current[f] = node
                    }}
                    initialValue={values[f]}
                    focused={active && !busy}
                    height={4}
                    wrapMode="word"
                    onContentChange={() => {
                      const node = textareaRefs.current[f]
                      if (node) {
                        setValues((prev) => ({ ...prev, [f]: node.plainText }))
                      }
                    }}
                  />
                ) : (
                  <input
                    ref={(node) => {
                      inputRefs.current[f] = node
                    }}
                    value={values[f]}
                    focused={active && !busy}
                    placeholder={labels[f]}
                    onChange={(value) =>
                      setValues((prev) => ({ ...prev, [f]: value }))
                    }
                    onSubmit={() => {
                      if (index >= fields.length - 1) submit()
                      else goTo(index + 1)
                    }}
                  />
                )}
              </box>
            )
          })}
        </box>
      </scrollbox>

      {busy ? (
        <text fg="#c4a35a">Creating…</text>
      ) : (
        <text fg="#6b7280">
          Field {index + 1}/{fields.length}
          {index === fields.length - 1 ? " — Tab or Ctrl+Enter to create" : ""}
        </text>
      )}
    </box>
  )
}
