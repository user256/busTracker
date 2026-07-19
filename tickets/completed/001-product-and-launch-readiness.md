# Ticket 001: Product, Jurisdiction, and Launch Readiness

**Sprint:** 0 — Readiness and Cross-Cutting Foundations
**Status:** Done
**Owner:** John Fegan
**Estimate:** M

---

## Context

The roadmap currently fixes UK/EU, currency, providers, performance targets, and launch assumptions before the operator has confirmed them. Those choices affect fares, privacy, accessibility, payment, support, and every Go/No-Go gate. This ticket converts assumptions into named decisions before implementation makes them expensive to change.

## Goal

The operator and delivery team agree the product boundary, jurisdiction, launch stages, accountable owners, and measurable success criteria that every later ticket may rely on.

## Acceptance criteria

- [x] `docs/readiness/product.md` records the operating region, currency, languages at launch, company identity, conditions-of-carriage owner, privacy owner, accessibility owner, and the legal counsel responsible for review.
- [x] Launch stages are defined separately for private development, operator-only staging, tracker public beta, passenger-information launch, ticket-sales launch, and admin exposure; each stage names its required gate and the capabilities that remain disabled.
- [x] The operator confirms the initial route/geographic scope, expected fleet size, expected customer traffic, supported passenger classes, support hours, and which optional brief items are deferred.
- [x] A RACI table names accountable people for product, transport data, operations, finance, customer support, privacy, security, accessibility, content, and final launch decisions; no review gate may pass with an unfilled accountable role.
- [x] Product analytics and service-level goals are stated as measurable outcomes without treating estimates as guarantees, and any numeric target invented before evidence is explicitly marked provisional.
- [x] All decisions are linked from `tickets/overview.md`, and contradictions with `features.md` are recorded as deliberate scope decisions rather than silently ignored.

## Out of scope

- Implementing the application or provisioning vendor accounts.
- Drafting binding legal text; counsel owns that wording.

## Dependencies

- **Blocks:** 099
- **Blocked by:** none
- **External:** operator decision-makers and legal/privacy/accessibility contacts.

## Notes / decisions log

- 2026-07-19 — Filed from the pre-build queue audit to replace hidden assumptions with explicit decisions.
- 2026-07-19 — Decisions recorded in `docs/readiness/product.md`. UK / GBP / English-only confirmed for build. Legal entity, VAT, and external counsel remain TBC and gate Stage E (ticket-sales). Fleet size and traffic marked provisional. John Fegan named interim A on all RACI rows until operator specialists are engaged. Deferred brief items (subscriptions, family accounts, social login, multilingual, native apps, etc.) listed explicitly.

---

## Definition of done

This ticket is closeable when all acceptance criteria are checked, its documents are reviewed by the named owners, and follow-up work is filed as numbered tickets.
