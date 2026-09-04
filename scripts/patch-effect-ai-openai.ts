/**
 * @effect/ai-openai 0.41.0 rejects Responses API `reasoning.effort: "max"`.
 * Patch generated schema (src, compiled JS, and .d.ts) until upstream allows it.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const pkgRoot = join(import.meta.dir, "..", "node_modules", "@effect", "ai-openai")

const replacements: Array<[string, string]> = [
  // Compiled / minified-ish
  [
    'S.Literal("none","minimal","low","medium","high")',
    'S.Literal("none","minimal","low","medium","high","max")',
  ],
  // Source
  [
    'S.Literal("none", "minimal", "low", "medium", "high")',
    'S.Literal("none", "minimal", "low", "medium", "high", "max")',
  ],
  // .d.ts Literal generics
  [
    'S.Literal<["none", "minimal", "low", "medium", "high"]>',
    'S.Literal<["none", "minimal", "low", "medium", "high", "max"]>',
  ],
  // .d.ts union members
  [
    '"none" | "minimal" | "low" | "medium" | "high"',
    '"none" | "minimal" | "low" | "medium" | "high" | "max"',
  ],
]

const walk = (dir: string, files: string[] = []): string[] => {
  if (!existsSync(dir)) return files
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walk(p, files)
    else if (
      entry.name.startsWith("Generated.") &&
      (entry.name.endsWith(".ts") ||
        entry.name.endsWith(".js") ||
        entry.name.endsWith(".d.ts") ||
        entry.name.endsWith(".mjs") ||
        entry.name.endsWith(".cjs"))
    ) {
      files.push(p)
    }
  }
  return files
}

if (!existsSync(pkgRoot)) {
  console.warn("[patch-effect-ai-openai] package not installed; skip")
  process.exit(0)
}

let patchedFiles = 0
for (const file of walk(pkgRoot)) {
  let text = readFileSync(file, "utf8")
  let changed = false
  for (const [from, to] of replacements) {
    if (text.includes(from)) {
      text = text.split(from).join(to)
      changed = true
    }
  }
  if (changed) {
    writeFileSync(file, text)
    patchedFiles++
    console.log("[patch-effect-ai-openai] patched", file.slice(pkgRoot.length + 1))
  }
}

console.log(`[patch-effect-ai-openai] done (${patchedFiles} file(s))`)
