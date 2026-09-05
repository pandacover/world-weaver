# ADR-0001: OpenRouter as sole generative backend

## Status

Accepted

## Context

The product must generate screenplays, stills, and video clips. The requester fixed OpenRouter as the provider. Alternatives (direct provider SDKs, local models) would fragment auth and billing.

## Decision

All generative calls go through OpenRouter: chat completions for Screenplays, `/api/v1/videos` for Scene video Media, `/api/v1/images` for still Media. No other providers in v1.

## Consequences

- One API key and billing surface
- Model slugs are OpenRouter slugs and may change; defaults are configurable
- Video latency and ZDR limits are inherited from OpenRouter
