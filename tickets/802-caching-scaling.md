# Ticket 802: Caching, CDN, and Peak Scaling

**Sprint:** 8 — Reliability, Security, and Scale
**Status:** Planned
**Owner:** unassigned
**Estimate:** L

---

## Context

The sprint theme is surviving a snow day — the moment when demand and disruption peak together, and every passenger loads the tracker, the journey planner, and a timetable at once. Everything built so far has been correctness-first and has never been load-tested: route, stop, and timetable pages (301–303) recompute from Postgres on every request even though their underlying GTFS data changes at most daily, and the position API (106) is queried by every open map tab. A snow day is precisely when a database that copes fine at Tuesday-lunchtime traffic falls over, and it is also the day the service matters most. This ticket sizes and caches the system for that day.

## Goal

Routes, stops, and timetables are CDN-served from cache, and the system holds its latency targets under a modelled peak-plus-disruption load with automated scaling and a tested database recovery path.

## Acceptance criteria

- [ ] Route, stop, and timetable pages (301, 302, 303) are statically generated or ISR-cached and served from the CDN edge with `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`; a GTFS re-ingest or a 703 publish targets-invalidates only the affected paths within 60 seconds, verified by publishing a change and polling the edge URL.
- [ ] Cache TTLs are set per data volatility and documented in one table in the repo: static GTFS-derived pages 1h (SWR 24h); live departures 20s; the 106 vehicle-positions API 5s (`s-maxage=5, stale-while-revalidate=10`); service alerts 30s; anything authenticated, ticket-bearing, or under `/admin` is `no-store` and provably never edge-cached — asserted by a test sweeping every route class and checking response headers.
- [ ] A load test (k6 or Gatling, committed to the repo and runnable in CI) models a disruption peak — 10,000 concurrent users, a 5× step-up in 60 seconds, and a traffic mix weighted to tracker, journey planner, and alerts — and the system holds p95 under 800ms for cached pages, under 1200ms for journey-planner searches, and under 400ms for the positions API, with an error rate below 0.5%.
- [ ] The application tier autoscales on request concurrency, scales from baseline to peak within 3 minutes of the step-up, and the load test passes *without* manual pre-scaling; scale-down does not drop in-flight requests.
- [ ] Postgres has at least one streaming read replica, read-only workloads (route/stop/timetable rendering, 705 reporting) are routed to it, and a documented failover promotes the replica within a 5-minute RTO — demonstrated once against staging with the result recorded here.
- [ ] Automated backups run at least daily with WAL archiving giving a point-in-time recovery objective of 15 minutes (RPO); a restore is actually performed to a scratch instance and the restored data verified — an untested backup does not satisfy this criterion.
- [ ] Cache correctness is proven, not assumed: no response containing a ticket, QR payload, session, or personal data is ever served from a shared cache, and a test asserts that two different authenticated sessions hitting the same URL never receive each other's response.
- [ ] Cache-hit ratio, origin request rate, replica lag, and autoscaler events are exported as metrics and visible on the 803 monitoring dashboard, with edge cache-hit ratio for static route/stop/timetable pages above 90% under the load test.

## Out of scope

- Multi-region active-active infrastructure — explicitly out of scope at the sprint level. Multiple availability zones within one region are in scope; a second region is not.
- Graceful degradation behaviour, status pages, and alerting — 803 consumes the metrics this ticket emits.
- Rate limiting and bot protection, which shape traffic rather than absorb it — 804.
- Rewriting queries for their own sake; optimise only what the load test shows is a bottleneck, and record what was found.

## Dependencies

- **Blocks:** 899
- **Blocked by:** 301, 302, 303, 306
- **External:** CDN provider selection and account (affects invalidation API and header semantics); hosting platform's autoscaling and managed-Postgres capabilities; a load-generation budget and permission to run peak tests against staging; the operator's real peak-traffic figures, if any exist, to calibrate the model.

## Approach (optional)

Cache at the edge by URL and keep every personalised element out of cacheable documents — fetch active tickets and account state client-side against `no-store` endpoints rather than sprinkling per-user fragments through server-rendered pages, which is the usual route to leaking one passenger's ticket to another. The positions API is the hard case: a 5s shared cache in front of it turns thousands of map clients into a handful of origin queries, but the freshness label the UI shows (206) must be computed from the *data* timestamp, not the response time, or the cache will make stale data look live — which is the exact failure mode the programme has been avoiding since Sprint 1. Run the load test before optimising anything so the sprint spends its effort where the evidence points.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
