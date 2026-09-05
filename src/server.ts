import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  createEmptyFilm,
  createFilmStore,
  runFilmJob,
  subscribe,
} from "./film/pipeline.ts";
import type { CreateFilmRequest, FilmJobEvent } from "./film/types.ts";

const store = createFilmStore();
const publicDir = join(import.meta.dir, "..", "public");
const port = Number(process.env.PORT || 3000);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sseEncode(event: FilmJobEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

async function handleCreateFilm(req: Request): Promise<Response> {
  const body = (await req.json()) as CreateFilmRequest;
  const premise = body.premise?.trim();
  if (!premise) {
    return json({ error: "Premise is required" }, 400);
  }

  const id = crypto.randomUUID();
  const film = createEmptyFilm(id, { ...body, premise });
  store.films.set(id, film);

  // Fire and forget
  void runFilmJob(store, id, { ...body, premise });

  return json({ id, status: film.status }, 201);
}

function handleFilmEvents(filmId: string): Response {
  const film = store.films.get(filmId);
  if (!film) return json({ error: "Film not found" }, 404);

  let cleanup: (() => void) | undefined;
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: FilmJobEvent) => {
        controller.enqueue(encoder.encode(sseEncode(event)));
      };

      send({
        type: "status",
        status: film.status,
        message: `Connected (${film.status})`,
      });
      if (film.screenplay.scenes.length) {
        send({ type: "screenplay", screenplay: film.screenplay });
      }
      for (const media of film.media) {
        send({ type: "media", media });
      }
      if (film.status === "completed") {
        send({ type: "done", film });
      }
      if (film.status === "failed" && film.error) {
        send({ type: "error", message: film.error });
      }

      cleanup = subscribe(store, filmId, send);
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function handleMedia(filmId: string, fileName: string): Response {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "");
  const path = join(store.root, filmId, safe);
  if (!existsSync(path)) return json({ error: "Media not found" }, 404);
  const file = Bun.file(path);
  return new Response(file);
}

function contentTypeFor(path: string): string | undefined {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return undefined;
}

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/api/health") {
      return json({
        ok: true,
        hasServerKey: Boolean(process.env.OPENROUTER_API_KEY),
      });
    }

    if (req.method === "POST" && url.pathname === "/api/films") {
      return handleCreateFilm(req);
    }

    const eventsMatch = url.pathname.match(/^\/api\/films\/([^/]+)\/events$/);
    if (req.method === "GET" && eventsMatch) {
      return handleFilmEvents(eventsMatch[1]!);
    }

    const filmMatch = url.pathname.match(/^\/api\/films\/([^/]+)$/);
    if (req.method === "GET" && filmMatch) {
      const film = store.films.get(filmMatch[1]!);
      if (!film) return json({ error: "Film not found" }, 404);
      return json(film);
    }

    const mediaMatch = url.pathname.match(
      /^\/api\/films\/([^/]+)\/media\/([^/]+)$/,
    );
    if (req.method === "GET" && mediaMatch) {
      return handleMedia(mediaMatch[1]!, mediaMatch[2]!);
    }

    let path = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = join(publicDir, path);
    if (existsSync(filePath) && Bun.file(filePath).size >= 0) {
      const file = Bun.file(filePath);
      const type = contentTypeFor(path);
      return new Response(file, {
        headers: type ? { "Content-Type": type } : undefined,
      });
    }

    return json({ error: "Not found" }, 404);
  },
});

console.log(`World Weaver running at http://localhost:${port}`);
