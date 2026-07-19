# Product, Jurisdiction, and Launch Readiness

**Ticket:** [001](../../tickets/001-product-and-launch-readiness.md)
**Status:** Decided (programme owner sign-off)
**Decided:** 2026-07-19
**Accountable decision-maker:** John Fegan (`johnwilliamfegan@gmail.com`)

This document converts roadmap assumptions into named decisions. Later tickets may rely on it. Where a fact still needs an external specialist (counsel, DPO), the field names the interim owner and the launch stage that may not open until the specialist is engaged.

---

## 1. Operating identity and jurisdiction

| Field | Decision | Confidence |
|-------|----------|------------|
| Operating region | United Kingdom (Great Britain focus for the first network) | Confirmed for build; refine to exact franchised/local authority area when the operator names the network |
| Applicable regimes | UK GDPR + Data Protection Act 2018; UK Equality Act 2010 / WCAG 2.2 AA as accessibility bar; UK consumer / passenger-transport rules for ticketing and complaints | Confirmed for build |
| Currency | GBP (`GBP`), amounts in minor units (pence) | Confirmed |
| Languages at launch | English only | Confirmed |
| Timezone | Europe/London (BST/GMT) | Confirmed |
| Payment provider | Stripe (SCA/3DS where required); we never store PAN/CVC | Confirmed (stack ADR / Ticket 101) |
| Map tiles | Stadia Maps via MapLibre GL JS | Confirmed (stack ADR / Ticket 101) |

### Company identity (legal entity)

| Field | Value |
|-------|--------|
| Trading / product name | busTracker (working product name until operator brand is supplied) |
| Legal entity name | **TBC — operator to supply** before ticket-sales launch |
| Company number / registered address | **TBC — operator to supply** before ticket-sales launch |
| VAT registration | **TBC — finance to supply** before ticket-sales launch |
| Public contact email / phone | **TBC — operator to supply** before passenger-information launch |

Until legal-entity fields are filled, ticket sales and published legal pages remain disabled (see launch stages). Tracker development and staging may proceed under the working product name.

### Named review owners

| Responsibility | Owner | Notes |
|----------------|-------|-------|
| Conditions of carriage | John Fegan (interim) | Binding text owned by counsel before ticket-sales launch |
| Privacy / UK GDPR | John Fegan (interim privacy owner) | External counsel / DPO review required before passenger-information launch if personal data is processed beyond feed ops |
| Accessibility | John Fegan (interim) | WCAG 2.2 AA target; specialist audit before public tracker beta exit |
| Legal counsel (review) | **External counsel — TBC** | Must be named before ticket-sales launch; blocks Ticket 805 binding copy |

---

## 2. Launch stages

Each stage has a required gate and a list of capabilities that stay **disabled** until the stage opens.

### Stage A — Private development

- **Gate:** Tickets 001–003 Done; Ticket 099 Go or Conditional-Go; Ticket 101 skeleton exists.
- **Enabled:** local app + workers, synthetic/private feed fixtures, CI on PRs, docs.
- **Disabled:** public DNS, real passenger traffic, live payments, staff admin on the internet, real PII beyond developer accounts.

### Stage B — Operator-only staging

- **Gate:** Sprint 1 exit (Ticket 199) Go or Conditional-Go; staging environment from Ticket 003/108; private feed access from Ticket 002.
- **Enabled:** staging URL (auth-walled or IP-restricted), real or representative feeds, operator staff review accounts.
- **Disabled:** public indexing, ticket sales, public alert subscriptions that send to real passengers, production Stripe live mode.

### Stage C — Tracker public beta

- **Gate:** Sprint 2 exit (Ticket 299) Go; freshness/degraded UI proven; accessibility smoke pass (Ticket 208); no silent-stale-as-live behaviour.
- **Enabled:** public map tracker, shareable tracking links, clear live / delayed / timetable-only labelling.
- **Disabled:** ticket checkout, account registration (unless needed for beta testers under invite), staff tools on public URLs, SMS/email alert fan-out at scale.

### Stage D — Passenger-information launch

- **Gate:** Sprint 3 + Sprint 4 exits (399, 499) Go; privacy notice draft reviewed for the data actually collected; support contact published.
- **Enabled:** route/stop/timetable pages, journey planner, service alerts display, help/contact forms.
- **Disabled:** paid checkout and mobile tickets until Stage E; admin CMS until Stage F.

### Stage E — Ticket-sales launch

- **Gate:** Sprint 5 exit (599) Go; Stripe live account + SCA proven; legal entity + VAT + conditions of carriage + refund policy published; counsel named and has reviewed binding copy.
- **Enabled:** guest checkout, mobile tickets, refunds/webhooks, fare catalogue surfaces.
- **Disabled:** authenticated account checkout until Sprint 6; subscriptions/auto-renewal (deferred).

### Stage F — Admin exposure

- **Gate:** Sprint 7 exit (799) Go; Ticket 400 staff identity/MFA/RBAC/audit in place; staff access only on separate admin host or equivalent isolation.
- **Enabled:** ops dashboard, fare admin, CMS, CS tools — MFA + RBAC + audit mandatory.
- **Disabled:** anything that bypasses MFA or audit; public access to admin routes.

---

## 3. Initial scope

### In scope for the first public passenger-information + tracker releases

Aligned with `features.md` “Initial release”, sequenced by the roadmap:

- Journey planner, route/stop/timetable pages
- Live map tracking and live departures
- Service alerts
- Basic online ticket sales (from Stage E)
- Customer accounts (Sprint 6; account checkout after 601/602)
- Payment processing (Stripe)
- Content and ticket administration (Stage F)
- Customer support forms

### Operator network assumptions (provisional until operator confirms)

| Assumption | Provisional value | Evidence needed |
|------------|-------------------|-----------------|
| Geographic scope | Single UK local/regional bus network (not multi-operator national) | Operator map / GTFS `agency` |
| Fleet size | **Unknown — treat as ≤ 200 vehicles for early capacity planning** | Operator confirmation |
| Expected customer traffic | **Unknown — provisional: 10 req/s steady, 50 req/s disruption spike for tracker API** | Staging load evidence before Stage C exit |
| Passenger classes at ticket launch | Adult, child, student, senior, concession | Operator fare table |
| Support hours | **Provisional: Mon–Fri 09:00–17:00 Europe/London; out-of-hours = web form only** | Operator confirmation before Stage D |

### Deliberately deferred (contradictions with full `features.md` brief)

These appear in `features.md` but are **out of programme scope** until a later roadmap revision. Recorded so they are not silently ignored:

| Brief item | Disposition |
|------------|-------------|
| Ticket subscriptions and auto-renewal | Deferred (features.md “Later enhancements”) |
| Linked family / dependent accounts | Deferred |
| Social or passwordless login | Deferred (email/password first in 601) |
| Occupancy information | Deferred until feed provides it |
| Loyalty schemes | Deferred |
| Multi-operator ticketing | Deferred |
| Corporate / school ticket portals | Deferred |
| Multilingual content | Deferred (English-only at launch) |
| Native mobile applications | Deferred (responsive web first) |
| Live chat staffing | Deferred (`features.md` optional; forms first) |
| Offline / native-offline aspects | Explicitly out of brief for now |

Zone-based and route-based pricing, group/family tickets, and promo codes remain in Sprint 5 scope unless the operator’s fare table shows they do not apply.

---

## 4. RACI (accountable people)

Legend: **A** = accountable (one per row), **R** = responsible, **C** = consulted, **I** = informed.

Until the operator names specialists, John Fegan is the interim **A** for every row. Ticket 099 and every later review gate **must not pass** a stage that requires a specialist if that specialist cell is still interim-only where marked below.

| Area | A | R | C | I | Specialist required before |
|------|---|---|---|---|----------------------------|
| Product / roadmap | John Fegan | Delivery agents | Operator | — | — |
| Transport data (GTFS/GTFS-RT) | John Fegan | Delivery | Operator data team | Ops | Stage B (named feed contact) |
| Operations (service day) | John Fegan (interim) | Operator controllers | Delivery | CS | Stage F |
| Finance / fares / VAT | John Fegan (interim) | Delivery (implementation) | Operator finance | — | Stage E |
| Customer support | John Fegan (interim) | CS staff (when hired) | Delivery | — | Stage D |
| Privacy / UK GDPR | John Fegan (interim) | Delivery | **Counsel/DPO TBC** | — | Stage D if PII; Stage E always |
| Security | John Fegan (interim) | Delivery | — | Operator | Stage F (staff access) |
| Accessibility | John Fegan (interim) | Delivery | Specialist auditor TBC | — | Stage C exit |
| Content / brand | John Fegan (interim) | Marketing (when named) | Operator | — | Stage D |
| Final launch decisions | John Fegan | — | All A’s above | Operator stakeholders | Each stage gate |

**Rule:** no review gate (`099`, `199`, …) may record Go for a stage whose “Specialist required before” cell is unmet.

---

## 5. Success criteria and service goals

Estimates are not guarantees. Numeric targets invented before production evidence are marked **provisional**.

### Product outcomes (measurable)

| Outcome | Measure | Target |
|---------|---------|--------|
| Passengers can trust the tracker | % of map sessions where freshness state is correctly labelled (live / delayed / timetable-only); zero known incidents of stale-as-live | 100% correct labelling; stale-as-live = Sev-1 |
| Tracker usefulness | Operator sign-off that feed coverage is “good enough” at Ticket 199 | Qualitative Go at 199 |
| Passenger information | Route and stop pages return 200 for all stops/routes in the loaded GTFS | 100% of in-feed entities |
| Ticketing | Checkout success rate excluding user-abandoned SCA | **Provisional ≥ 95%** after Stage E soak |
| Support | Every contact form submission receives a case reference | 100% |

### Service-level goals (provisional)

| Service | Availability goal | Latency goal | Notes |
|---------|-------------------|--------------|-------|
| Tracker positions read API | **Provisional 99.5%** monthly | **Provisional p95 ≤ 200 ms** in-region | Revise after Ticket 106 + staging evidence |
| Journey planner | **Provisional 99.9%** | **Provisional p95 ≤ 1 s** | Highest priority with tickets + alerts (`features.md`) |
| Active ticket retrieval | **Provisional 99.9%** | **Provisional p95 ≤ 500 ms** | |
| Service alerts display | **Provisional 99.9%** | **Provisional p95 ≤ 500 ms** | |
| Static timetable pages | **Provisional 99.5%** | CDN-cached | |

Public launch must not treat the Sprint 8 snow-day test as the first operational test — staging soak under Stage B/C is mandatory evidence.

### Analytics

- Product analytics: privacy-preserving, consented where required; no capture of precise continuous location beyond what tracking UI needs.
- Prefer first-party events (page views of tracker, planner searches, checkout funnel) over invasive session replay at launch.
- Exact vendor **TBC in Ticket 002**; until then, server logs + ticket-dashboard style operational metrics only.

---

## 6. Links and brief reconciliation

- Roadmap: [`tickets/overview.md`](../../tickets/overview.md)
- Functional brief: [`features.md`](../../features.md)
- Public-repo boundary: [`SECURITY.md`](../../SECURITY.md)
- Sibling readiness docs (Sprint 0): `integrations.md` (002), `delivery.md` (003)

Deliberate scope cuts vs `features.md` are listed in §3. No other silent omissions are authorised; if a later ticket needs a deferred item, file a new numbered ticket rather than quietly expanding scope.

---

## Approval

| Role | Name | Date | Result |
|------|------|------|--------|
| Programme decision-maker | John Fegan | 2026-07-19 | Approved for Sprint 0 — proceed to 002/003; legal entity and counsel remain Stage E blockers |
