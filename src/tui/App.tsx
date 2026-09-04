import { useState, useCallback, useEffect } from "react"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import { Effect } from "effect"
import type { AppRuntime } from "../runtime.ts"
import { NovelStore } from "../store/novel-store.ts"
import { AgentLoop, parseInput } from "../agent/loop.ts"
import { CharacterMemory } from "../memory/supermemory.ts"
import type { CreateNovelInput, Novel, NovelSnapshot } from "../domain/schema.ts"
import { HomeScreen } from "./screens/Home.tsx"
import { CreateScreen } from "./screens/Create.tsx"
import { PlayScreen } from "./screens/Play.tsx"

type Screen = "home" | "create" | "play"

export type AppProps = {
  runtime: AppRuntime
}

export function App({ runtime }: AppProps) {
  const { width, height } = useTerminalDimensions()
  const [screen, setScreen] = useState<Screen>("home")
  const [novels, setNovels] = useState<ReadonlyArray<Novel>>([])
  const [snapshot, setSnapshot] = useState<NovelSnapshot | null>(null)
  const [focusedCharacter, setFocusedCharacter] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [status, setStatus] = useState("Ready")
  const [busy, setBusy] = useState(false)

  const refreshList = useCallback(async () => {
    const list = await runtime.runPromise(
      Effect.gen(function* () {
        const store = yield* NovelStore
        return yield* store.listNovels()
      }),
    )
    setNovels(list)
  }, [runtime])

  useEffect(() => {
    void refreshList()
  }, [refreshList])

  const openNovel = useCallback(
    async (novelId: string) => {
      const snap = await runtime.runPromise(
        Effect.gen(function* () {
          const store = yield* NovelStore
          return yield* store.getSnapshot(novelId)
        }),
      )
      if (!snap) {
        setStatus("Novel not found")
        return
      }
      setSnapshot(snap)
      const firstNpc = snap.characters.find((c) => c.role === "npc")
      setFocusedCharacter(firstNpc?.name ?? null)
      setLog(
        snap.recentBeats.map((b) => {
          if (b.kind === "dialogue" && b.speakerId) {
            const name =
              snap.characters.find((c) => c.id === b.speakerId)?.name ?? "Someone"
            return `${name}: ${b.content}`
          }
          return b.content
        }),
      )
      setScreen("play")
      setStatus(`Playing: ${snap.novel.title}`)
    },
    [runtime],
  )

  const createNovel = useCallback(
    async (input: CreateNovelInput) => {
      setBusy(true)
      setStatus("Creating novel…")
      try {
        const snap = await runtime.runPromise(
          Effect.gen(function* () {
            const store = yield* NovelStore
            const memory = yield* CharacterMemory
            const created = yield* store.createNovel(input)
            for (const character of created.characters) {
              yield* memory.seedOptional(character)
            }
            return created
          }),
        )
        setSnapshot(snap)
        setFocusedCharacter(
          snap.characters.find((c) => c.role === "npc")?.name ?? null,
        )
        setLog(snap.recentBeats.map((b) => b.content))
        setScreen("play")
        setStatus(`Created: ${snap.novel.title}`)
        await refreshList()
      } catch (e) {
        setStatus(`Create failed: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        setBusy(false)
      }
    },
    [runtime, refreshList],
  )

  const submitLine = useCallback(
    async (raw: string) => {
      if (!snapshot || busy) return
      const intent = parseInput(raw, focusedCharacter)
      setBusy(true)
      setStatus("Thinking…")
      setLog((prev) => [...prev, `> ${raw}`])
      try {
        const result = await runtime.runPromise(
          Effect.gen(function* () {
            const loop = yield* AgentLoop
            return yield* loop.runTurn(snapshot.novel.id, intent)
          }),
        )
        setSnapshot(result.snapshot)
        if (result.lines.length > 0) {
          setLog((prev) => [...prev, ...result.lines])
        }
        setStatus("Ready")
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setLog((prev) => [...prev, `! ${msg}`])
        setStatus(`Error: ${msg}`)
      } finally {
        setBusy(false)
      }
    },
    [snapshot, busy, focusedCharacter, runtime],
  )

  useKeyboard((key) => {
    if (key.name === "escape") {
      setScreen("home")
      void refreshList()
    }
  })

  return (
    <box
      width={width}
      height={height}
      flexDirection="column"
      padding={1}
      backgroundColor="#0f1419"
    >
      <box height={1} marginBottom={1} flexDirection="row" gap={2}>
        <text fg="#c4a35a">WORLD WEAVER</text>
        <text fg="#6b7280">{status}</text>
      </box>

      {screen === "home" && (
        <HomeScreen
          novels={novels}
          onCreate={() => setScreen("create")}
          onOpen={(id) => void openNovel(id)}
        />
      )}
      {screen === "create" && (
        <CreateScreen
          busy={busy}
          onCancel={() => setScreen("home")}
          onSubmit={(input) => void createNovel(input)}
        />
      )}
      {screen === "play" && snapshot && (
        <PlayScreen
          snapshot={snapshot}
          log={log}
          focusedCharacter={focusedCharacter}
          busy={busy}
          onFocusChange={setFocusedCharacter}
          onSubmit={(line) => void submitLine(line)}
        />
      )}
    </box>
  )
}
