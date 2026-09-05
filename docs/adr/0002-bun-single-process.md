# ADR-0002: Bun single-process server for UI and API

## Status

Accepted

## Context

We need a TypeScript webapp with server-side secret handling for OpenRouter and SSE progress while Film Jobs run.

## Decision

Ship one Bun process that serves static frontend files and HTTP/SSE API routes. No separate Node server or bundler requirement for v1 (`bun run` is enough).

## Consequences

- Simple local DX and deployment story
- API key stays off the client except when the user intentionally pastes it for a request
- Frontend is vanilla TS/CSS served as static files (Bun can transpile TS on the fly for server modules)
