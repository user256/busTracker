# ADR 0004: SQL migration runner (no ORM yet)

**Status:** Accepted  
**Date:** 2026-07-19  
**Ticket:** 101  
**Deciders:** John Fegan

## Context

We need reproducible schema changes shared by web and workers. Heavy ORMs (Prisma, Drizzle) add codegen and abstraction before the GTFS schema is even designed. Ticket 101 only requires a boring, auditable applicator.

## Decision

- Migrations are plain SQL files in `db/migrations/*.sql`, applied in lexical order.
- `npm run db:migrate` (`scripts/db-migrate.ts`) applies each file in a transaction and records the version in `schema_migrations`.
- Re-running is a no-op (exit 0).
- Application queries use `pg` (node-postgres) via `lib/db`. An ORM may be adopted later via a new ADR once query patterns stabilise.

## Consequences

- Reviewers read SQL directly in PRs — good for PostGIS.
- No automatic TypeScript types from the schema; write types beside queries as needed.
- Exit path: introduce Drizzle/Prisma later without rewriting history if SQL migrations remain the source of truth (or migrate tooling carefully).

## Alternatives considered

| Option | Why not (now) |
|--------|----------------|
| Prisma Migrate | Extra layer before we know the GTFS model |
| Drizzle Kit | Reasonable later; still premature for empty skeleton |
| Flyway/Liquibase | JVM ops surface we do not otherwise need |
