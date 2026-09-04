import { useKeyboard } from "@opentui/react"
import type { Novel } from "../../domain/schema.ts"

export type HomeScreenProps = {
  novels: ReadonlyArray<Novel>
  onCreate: () => void
  onOpen: (id: string) => void
}

export function HomeScreen({ novels, onCreate, onOpen }: HomeScreenProps) {
  useKeyboard((key) => {
    if (key.name === "c") onCreate()
    if (key.name === "return" && novels[0]) onOpen(novels[0].id)
    const digit = Number(key.name)
    if (digit >= 1 && digit <= novels.length) {
      const novel = novels[digit - 1]
      if (novel) onOpen(novel.id)
    }
  })

  return (
    <box flexGrow={1} flexDirection="column" gap={1}>
      <text fg="#e5e7eb">Interactive novel engine</text>
      <text fg="#9ca3af">
        Select a novel, or create one. Esc returns home from play.
      </text>

      <box marginTop={1} flexDirection="column" gap={1}>
        <text fg="#c4a35a">Novels</text>
        {novels.length === 0 ? (
          <text fg="#6b7280">(none yet)</text>
        ) : (
          novels.map((novel, index) => (
            <box
              key={novel.id}
              onMouseDown={() => onOpen(novel.id)}
              flexDirection="row"
              gap={1}
            >
              <text fg="#60a5fa">[{index + 1}]</text>
              <text fg="#f3f4f6">{novel.title}</text>
              <text fg="#6b7280">— {novel.premise.slice(0, 60)}</text>
            </box>
          ))
        )}
      </box>

      <box marginTop={2} gap={2} flexDirection="row">
        <box
          onMouseDown={onCreate}
          paddingLeft={1}
          paddingRight={1}
          backgroundColor="#1f2937"
        >
          <text fg="#c4a35a">[c] Create novel</text>
        </box>
        {novels[0] && (
          <box
            onMouseDown={() => onOpen(novels[0]!.id)}
            paddingLeft={1}
            paddingRight={1}
            backgroundColor="#1f2937"
          >
            <text fg="#93c5fd">[Enter] Open latest</text>
          </box>
        )}
      </box>
    </box>
  )
}
