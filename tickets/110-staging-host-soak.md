# Ticket 110: Staging Host Soak

**Sprint:** 1 — Tracker Data Foundation (follow-up from 199)
**Status:** Not started
**Owner:** John Fegan
**Estimate:** M

---

## Context

Ticket 108 delivered Compose profiles and runbooks; the 24h supervised soak on a real staging host remains.

## Goal

Staging DNS/TLS host runs `docker compose --profile stack` with web + workers for ≥ 24 hours without manual intervention.

## Acceptance criteria

- [ ] Staging host provisioned per ADR 0001 / delivery.md.
- [ ] Workers restart after kill; `/api/health` stays green for 24h.
- [ ] One successful automatic GTFS static refresh (or documented skip when URL unset).
- [ ] Smoke + rollback steps in `docs/runbooks/deploy.md` executed once.

## Dependencies

- **Blocked by:** 108
- **Blocks:** honest 199 observation start on staging
