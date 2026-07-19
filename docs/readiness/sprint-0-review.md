# Sprint 0 Readiness Review — Go / No-Go

**Ticket:** 099  
**Date:** 2026-07-19  
**Decision-maker:** John Fegan  
**Decision:** **Conditional-Go**

Ticket 101 may start. Sprint 1 feature work against fixtures may proceed. Operator feed-quality Go at Ticket 199 remains blocked until conditions below are met.

---

## Evidence checklist

| Criterion | Evidence |
|-----------|----------|
| 001–003 Done with named approvers | Product, integrations, delivery docs approved by John Fegan 2026-07-19 |
| 101 owner + deployment target + PostGIS image | Owner: John Fegan; target: Docker Compose (ADR 0001); image `postgis/postgis:16-3.5` pulled successfully on this host |
| GTFS/GTFS-RT samples private + licence OK for intended use | Synthetic (project-owned) + MBTA open-data fixtures under `data/feeds/` (gitignored). **Operator licence still TBC** — see conditions |
| Public-repo safety | `.env` / `private.md` / `data/` untracked; content scan clean 2026-07-19 (Ticket 002) |
| Risk register | `docs/readiness/integrations.md` §6 |

---

## Risk register (critical / high unresolved)

| ID | Item | Severity | Owner | Due | Blocks |
|----|------|----------|-------|-----|--------|
| R1 | Operator GTFS + GTFS-RT access + licence | Critical | John Fegan / operator data | Before Ticket 199 | 105 quality claims, 199 Go |
| R2 | Stadia Maps API key | High | John Fegan | Before 201 | 201 |
| R3 | Stripe test account | High | John Fegan | Before 502 | 502 |
| R4 | Legal entity + external counsel | Critical for sales | John Fegan | Before Stage E | 500, 805, ticket-sales launch |
| R5 | Email provider sandbox | Medium | John Fegan | Before 502 | 502, 601 |
| R6 | Validator device trial | Medium | Ops TBC | Before Stage E | 504 hardware evidence |

No critical item is treated as an implementation detail.

---

## Enforceable conditions (Conditional-Go)

1. **Ticket 101–104, 106–108** may proceed using synthetic/MBTA fixtures and the Compose delivery model.
2. **Ticket 105** may implement guards against fixtures, but must not assert operator feed fitness.
3. **Ticket 199** may record Go only after R1 is resolved (operator samples in `data/feeds/operator/`, licence permits use, escalation contact named) and feed-quality evidence is attached.
4. **Stage C (public tracker beta)** additionally requires R2 (Stadia).
5. **Stage E (ticket sales)** additionally requires R3, R4, R5.

If R1 cannot be obtained, the honest outcome at 199 is **No-Go** on building a public tracker against unknown feed quality — not a silent proceed.

---

## Decision record

| Field | Value |
|-------|--------|
| Result | Conditional-Go |
| Accountable | John Fegan |
| Date | 2026-07-19 |
| Next ticket | 101 |
