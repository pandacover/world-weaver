/**
 * @effect/ai-openai 0.41.0 rejects Responses API `reasoning.effort: "max"`.
 * Patch the generated schema (src + compiled) until upstream allows it.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const pkgRoot = join(import.meta.dir, "..", "node_modules", "@effect", "ai-openai")

const FROM = 'S.Literal("none","minimal","low","medium","high")'
const TO = 'S.Literal("none","minimal","low","medium","high","max")'
const FROM_SRC = 'S.Literal("none", "minimal", "low", "medium", "high")'
const TO_SRC = 'S.Literal("none", "minimal", "low", "medium", "high", "max")'

const patchFile = (path: string, from: string, to: string): boolean => {
  if (!existsSync(path)) return false
  const before = readFileSync(path, "utf8")
  if (!before.includes(from)) {
    // Already patched or different formatting
    return before.includes(to) || before.includes('"max"')
  }
  writeFileSync(path, before.split(from).join(to))
  return true
}

const walk = (dir: string, files: string[] = []): string[] => {
  if (!existsSync(dir)) return files
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walk(p, files)
    else if (entry.name.startsWith("Generated.")) files.push(p)
  }
  return files
}

if (!existsSync(pkgRoot)) {
  console.warn("[patch-effect-ai-openai] package not installed; skip")
  process.exit(0)
}

let patched = 0
for (const file of walk(pkgRoot)) {
  const isSrc = file.includes(`${join("src", "Generated")}`) || file.endsWith(`${join("src", "Generated.ts")}`)
  const ok = isSrc
    ? patchFile(file, FROM_SRC, TO_SRC) || patchFile(file, FROM, TO)
    : patchFile(file, FROM, TO) || patchFile(file, FROM_SRC, TO_SRC)
  if (ok) {
    patched++
    console.log("[patch-effect-ai-openai] patched", file.replace(pkgRoot + "/", ""))
  }
}

if (patched === 0) {
  console.warn(
    "[patch-effect-ai-openai] no Generated files matched; check @effect/ai-openai layout",
  )
  process.exit(0)
}

console.log(`[patch-effect-ai-openai] done (${patched} file(s))`)
