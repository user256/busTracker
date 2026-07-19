# ADR 0003: Postgres 16 + PostGIS as the single store

**Status:** Accepted  
**Date:** 2026-07-19  
**Ticket:** 101  
**Deciders:** John Fegan

## Context

GTFS static entities and realtime vehicle positions both need durable storage. Positions are spatial; viewport and route queries dominate the tracker read path (Ticket 106). Introducing a second database (e.g. Redis-only positions, or a document store for static) would split transactions and operational backups early.

## Decision

**Postgres 16 with PostGIS** is the single system of record for:

- GTFS static tables (Ticket 102+)
- Vehicle positions and related realtime state (Ticket 103+)
- Later domain tables (tickets, accounts, alerts) unless a future ADR explicitly splits them

Local and Compose images use `postgis/postgis:16-*`.

## Consequences

- Spatial indexes (`GIST`) and SQL are first-class for the tracker API.
- Backups and migrations are one pipeline (`db/migrations`, `npm run db:migrate`).
- Hot caches (Redis) may appear later for rate limits / CDN origin shielding without replacing the source of truth.

## Alternatives considered

| Option | Why not (now) |
|--------|----------------|
| Separate Redis as position store | Extra consistency story; PostGIS already fits viewport queries |
| SQLite + spatialite | Weak multi-writer story for web + workers |
| Managed-only proprietary store | Conflicts with self-hosted Compose decision (ADR 0001) |
