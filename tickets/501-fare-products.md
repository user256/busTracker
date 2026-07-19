# Ticket 501: Fare Products and Pricing Model

**Sprint:** 5 — Ticketing and Payments
**Status:** Planned
**Owner:** unassigned
**Estimate:** L

---

## Context

Everything else in Sprint 5 is downstream of one question: what exactly is being sold, for how much, and under what rules? `features.md` §3 asks for singles, returns, day, weekly and monthly tickets, across adult/child/student/senior/concession, priced by zone *and* by route, plus group and family tickets and promo codes. §9 additionally requires fare changes to be schedulable in advance and products to be suspendable. If we let checkout invent prices, we will end up with pricing logic smeared across the UI, and a fare change will mean a deploy. This ticket builds the fare catalogue and a single pricing engine that is the only thing in the system allowed to say what something costs. It also owns the requirement that validity rules are shown to the passenger **before** they pay — not in the confirmation email.

## Goal

A versioned fare catalogue in Postgres and a single server-side pricing engine that, given a product, passenger class, journey context and optional promo code, returns an authoritative price and a human-readable set of validity rules.

## Acceptance criteria

- [ ] Migrations under `db/migrations/` create `fare_products`, `fare_product_versions`, `passenger_classes`, `fare_zones`, `zone_pairs`, `route_fares`, `promo_codes`, and `promo_code_redemptions`; `fare_zones` carries a `geom geography(MultiPolygon,4326)` column with a GIST index so zone lookup is a PostGIS containment query, not a hardcoded table.
- [ ] `fare_product_versions` rows carry `effective_from`/`effective_to` timestamptz and are immutable once `effective_from` is in the past; a scheduled future fare change is created by inserting a new version, and `GET /api/fares/quote?at=2026-09-01T00:00:00Z` returns the price that *will* apply on that date while today's price is unchanged. Products can also be suspended (`status = 'suspended'`) or sales-limited by availability window, and a suspended or out-of-window product returns `409 product_not_on_sale` and is absent from the public catalogue listing.
- [ ] `POST /api/fares/quote` accepts `{productId, passengerClass, origin?, destination?, routeId?, quantity, promoCode?, travelDate}` and returns `{currency:<ISO-4217 from Ticket 001>, unitAmountMinor, totalAmountMinor, breakdown[], validity:{...}, quoteId, expiresAt}`; all money is integer minor units and the response is signed/persisted so 502 can re-derive the same total server-side rather than trusting a client-sent price.
- [ ] Product types `single`, `return`, `day`, `weekly`, `monthly` and passenger classes `adult`, `child`, `student`, `senior`, `concession` are all representable, and a group/family product prices as one order line covering N travellers with per-class composition rules (e.g. family = max 2 adult + 3 child) enforced server-side with a `422 group_composition_invalid` on violation.
- [ ] Zone-based and route-based pricing both resolve through the same engine: a zone product prices from `zone_pairs` after resolving origin/destination stops to zones via PostGIS, a route product prices from `route_fares` keyed on `route_id`, and a test asserts an identical journey priced both ways returns each configured amount rather than silently falling through to a default.
- [ ] Promo codes support percentage and fixed-amount discounts with `valid_from`/`valid_to`, max total redemptions, max per-account redemptions, and product/class eligibility; redemption is atomic (`INSERT ... ON CONFLICT` against `promo_code_redemptions` inside the quote-to-order transaction) so a code capped at 100 uses cannot be redeemed 101 times under concurrent load — proven by a concurrency test firing 200 parallel redemptions.
- [ ] Every product surfaces machine-readable validity before purchase — `validFrom` basis (purchase vs activation), duration, permitted routes/zones, transfer rules, peak/off-peak restrictions, and refundability — and the product page and checkout both render it from that same field; a snapshot test asserts no product renders with an empty validity block.
- [ ] `npm test -- fares` passes, covering: zone resolution, scheduled fare change boundaries (a quote at `effective_from - 1s` and `+ 1s`), promo concurrency, group composition, and rounding (all arithmetic in minor units, no float money anywhere — a lint rule or test asserts no `number` price fields are divided in pricing code).

## Out of scope

- Taking payment, checkout UI, or order records — 502.
- Ticket issuance, QR payloads, activation — 503.
- Staff-facing fare administration UI. This ticket delivers the model and API; the admin screens are 702.
- Subscriptions, auto-renewal, and loyalty pricing — explicitly out of scope for Sprint 5.
- Multi-operator or through-ticketing fares.
- Showing fares inside journey-planner results (Sprint 3 deliberately excluded this).

## Dependencies

- **Blocks:** 502, 503, 599
- **Blocked by:** 101
- **External:** the operator's actual fare table (zone map, route fares, concession eligibility rules) as a signed-off spreadsheet; legal sign-off on conditions of carriage and passenger eligibility wording; confirmation of VAT treatment for bus fares in the operating region.

## Approach (optional)

Model products as an immutable version chain rather than mutable rows — a fare change is an insert, never an update, which makes "what did this cost on the day they bought it?" answerable from the order record forever. Resolve everything through one `priceQuote()` function in `lib/fares/`; if any other module computes an amount, that is a bug. Persist quotes with a short TTL (15 minutes) so checkout references a `quoteId` and the server never trusts a client-supplied amount. Zone geometry comes from the operator's zone map loaded like GTFS static — reproducible, versioned, not hand-drawn in the database.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
