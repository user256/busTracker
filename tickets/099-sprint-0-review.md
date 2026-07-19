# Ticket 099: Sprint 0 Readiness Review and Go/No-Go

**Sprint:** 0 — Readiness and Cross-Cutting Foundations
**Status:** Not started
**Owner:** unassigned
**Estimate:** S

---

## Context

The earlier roadmap began implementation while every ticket remained unassigned and every external dependency remained unresolved. This gate prevents the project skeleton from becoming the place where product, legal, vendor, and hosting decisions are made accidentally in code.

## Goal

The team records whether the programme is ready to begin Ticket 101 with its critical assumptions, owners, access, and delivery model resolved.

## Acceptance criteria

- [ ] Tickets 001–003 are Done and their decision documents have named approvers.
- [ ] Ticket 101 has an owner, an agreed deployment target, an available PostGIS image, and no unresolved decision that changes its repository or runtime shape.
- [ ] The GTFS/GTFS-RT samples needed for Sprint 1 are accessible privately and their licence permits the intended use.
- [ ] A public-repository safety check confirms ignored/private files and credentials will not be committed.
- [ ] A risk register lists each unresolved dependency with severity, owner, due date, and the first ticket it blocks; no critical unresolved item is relabelled as an implementation detail.
- [ ] A Go / Conditional-Go / No-Go decision is recorded with the accountable decision-maker and date. Conditional-Go names enforceable conditions; No-Go keeps 101 blocked.

## Out of scope

- Implementing Ticket 101 or resolving findings inside this review.

## Dependencies

- **Blocks:** 101
- **Blocked by:** 001, 002, 003
- **External:** the accountable programme decision-maker and the owners named in Ticket 001.

## Notes / decisions log

- 2026-07-19 — Added as the programme's true first gate after the queue audit.

---

## Definition of done

This ticket is closeable only when the decision and evidence are recorded and the roadmap reflects the result.
