# ADR 0005: Stadia Maps tiles and API-key handling

**Status:** Accepted  
**Date:** 2026-07-19  
**Ticket:** 101  
**Deciders:** John Fegan

## Context

Sprint 2 renders a MapLibre map. The stack decision (CLAUDE.md / Ticket 101) names Stadia Maps as the tile provider. API keys must not be committed; public browser tile requests need a deliberate exposure strategy.

## Decision

- **Provider:** Stadia Maps tiles consumed by MapLibre GL JS (implementation in Ticket 201).
- **Secrets:** `STADIA_API_KEY` is read only via `lib/env.ts` / `.env` (see `.env.example`). Never commit real keys.
- **Browser exposure:** Ticket 201 chose **(b) origin proxy**. The browser loads `/api/map/style` and `/api/map/stadia/*` only; `STADIA_API_KEY` is never exposed as `NEXT_PUBLIC_*`.
- Local development may run without a key until 201; map pages must fail clearly if the key is missing in environments that serve tiles.

## Consequences

- 201 owns the final public-vs-proxy choice and CSP `connect-src` / `img-src` entries.
- Cost owner and budget alerts live in `docs/readiness/delivery.md`.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Mapbox | Stack already decided Stadia; revisit only with a new ADR |
| Self-hosted tile server | High ops cost for v1 |
| Unauthenticated OSM raster only | Fine for throwaway demos; not the product tile path |
