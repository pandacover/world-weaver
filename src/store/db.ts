import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { Context, Effect, Layer } from "effect"
import schemaSql from "./schema.sql" with { type: "text" }

export class DatabaseError {
  readonly _tag = "DatabaseError"
  constructor(readonly message: string, readonly cause?: unknown) {}
}

export class Db extends Context.Tag("world-weaver/Db")<
  Db,
  {
    readonly db: Database
    readonly path: string
  }
>() {}

export const makeDb = (path: string) =>
  Effect.acquireRelease(
    Effect.try({
      try: () => {
        mkdirSync(dirname(path), { recursive: true })
        const db = new Database(path, { create: true })
        db.exec("PRAGMA foreign_keys = ON;")
        db.exec(schemaSql)
        return { db, path }
      },
      catch: (cause) =>
        new DatabaseError(
          `Failed to open SQLite database at ${path}`,
          cause,
        ),
    }),
    ({ db }) =>
      Effect.sync(() => {
        db.close()
      }),
  )

export const layer = (path: string) =>
  Layer.scoped(Db, makeDb(path))
