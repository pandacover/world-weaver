import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { createAppRuntime } from "./runtime.ts"
import { App } from "./tui/App.tsx"

const runtime = createAppRuntime()

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  targetFps: 30,
})

createRoot(renderer).render(<App runtime={runtime} />)
