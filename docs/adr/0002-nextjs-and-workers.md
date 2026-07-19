# ADR 0002: Next.js App Router and separate ingest workers

**Status:** Accepted  
**Date:** 2026-07-19  
**Ticket:** 101  
**Deciders:** John Fegan

## Context

The product needs both a request/response web surface and continuous GTFS-Realtime polling. Next.js route handlers and serverless-style functions are request-scoped; a poll loop that must outlive a single HTTP request does not belong there. ADR 0001 already selected always-on Docker Compose processes.

## Decision

- **Web:** Next.js App Router on the Node runtime (`next start` / `next dev`), TypeScript, `app/` directory.
- **Ingest:** separate long-lived Node processes under `workers/`, started with `npm run worker:dev` (and a Compose `worker` service in Ticket 108). Workers share `lib/` (env + DB pool) with the web app.
- Route handlers may *trigger* operational actions, but they must not own the realtime poll loop.

## Consequences

- Two process types to supervise and deploy — accepted operational cost.
- Local bring-up needs both `npm run dev` and `npm run worker:dev` once ingest exists (104+).
- Avoids coupling feed lag to HTTP worker recycling.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Poll from a Next.js route on a cron ping | Fragile; misses ticks under load; still not a real supervisor |
| Serverless scheduled functions | Poor fit for sub-minute polling and PostGIS locality (ADR 0001) |
| In-process with the Next server | Couples deploy/restart of UI to ingest; harder to scale independently |
