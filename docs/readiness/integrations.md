# Data and Vendor Access Readiness

**Ticket:** [002](../../tickets/002-data-and-vendor-access-readiness.md) (live path until archived: `tickets/002-…`)
**Status:** Decided — fixtures ready; operator production feeds and several vendor sandboxes still gate their first consumers
**Decided:** 2026-07-19
**Owner:** John Fegan

This document tracks every external dependency. Secrets stay in `.env` / the chosen secret store — never in this file or in git.

---

## 1. Approved private feed location

| Item | Value |
|------|--------|
| Path | `/home/user256/GitRepos/busTracker/data/feeds/` (gitignored via `data/`) |
| Alternate machine layout | Document under `private.md` → `DATA_DIR` |
| Publishable? | **No** — raw feeds, even public third-party snapshots used as fixtures, stay out of git |
| Provenance index | `data/feeds/notes/README.md` (local only) |

### Samples currently on disk

| Sample | Role | Auth | Update cadence | Licence note | Escalation |
|--------|------|------|----------------|--------------|------------|
| `static/synthetic-gtfs.zip` | Tiny UK-shaped fixture for CI / Ticket 102 | n/a | static | Project-owned | Delivery |
| `static/mbta-sample.zip` | Large real-world static GTFS for parser stress | none | manual refresh | MBTA open data — **not the operator** | Delivery |
| `realtime/VehiclePositions.pb` | VehiclePositions snapshot | none | snapshot 2026-07-19 | MBTA open data — fixture only | Delivery |
| `realtime/TripUpdates.pb` | TripUpdates snapshot | none | snapshot 2026-07-19 | same | Delivery |
| `realtime/Alerts.pb` | ServiceAlerts snapshot | none | snapshot 2026-07-19 | same | Delivery |
| `fixtures/operator-dummy/` (in git) | Synthetic Stagecoach-style 55/23 Perth–Kinross–Tillicoultry + local RT server | n/a | rebuild via `npm run dummy:gtfs` | Project-owned dummy — **not** the operator | Delivery |
| **Operator GTFS static** | Production truth for Sprint 1 | **TBC** | **TBC** | **TBC** | **Operator data team — TBC** |
| **Operator GTFS-RT VP / TU / Alerts** | Production truth | **TBC** | **TBC** | **TBC** | **Operator data team — TBC** |

**Gate:** Ticket **105** / **109** / Stage C cannot claim operator feed quality until operator URLs, auth, licence, expected fleet coverage, and escalation contact are filled above. Tickets **102–104**, **107**, **201+** may develop against synthetic, MBTA, or `fixtures/operator-dummy`.

---

## 2. Static feed capability profile

### Synthetic fixture (`synthetic-gtfs.zip`)

| Capability | Present? | Fallback / follow-up |
|------------|----------|----------------------|
| `agency.txt`, `routes`, `stops`, `trips`, `stop_times`, `calendar`, `shapes` | Yes | Core path for 102 |
| `stop_code` | Yes | Display on stop pages (302) |
| Wheelchair / accessibility fields | Partial (`wheelchair_boarding` on stops) | Vehicle accessibility deferred until feed provides it |
| `frequencies.txt` | No | Expand stop_times only; no frequency-based scheduling UI |
| `transfers.txt` | No | Planner uses geographic/transfer heuristics until operator feed supplies transfers (follow-up if needed after 304) |
| `pathways.txt` | No | No indoor path routing at launch |
| Fare files (`fare_*`) | No | Fares owned by Ticket 501 product model, not GTFS fares v2, unless operator later supplies them |
| `levels.txt` / translations | No | Single-level stops; English only (001) |

### MBTA open fixture (stress / parser realism)

| Capability | Present? | Note |
|------------|----------|------|
| `shapes.txt` | Yes | Large |
| `transfers.txt` | Yes | |
| `pathways.txt` | Yes | |
| `frequencies.txt` | No | |
| `fare_products.txt` (Fares v2) | Yes | Do not assume operator has this |
| Accessibility on `stops.txt` | Yes (`wheelchair_boarding`, …) | |
| `stop_code` | Yes | |

### Operator feed

**Not received.** When it arrives, re-run the optional-file checklist and update this section; file follow-up tickets for each absent capability that passenger UX still needs.

---

## 3. Vendor / platform access matrix

Status vocabulary: **Ready** · **Partial** · **Not started** · **N/A (deferred)**

| Dependency | Purpose | First ticket blocked | Status | Sandbox / quota notes | Owner | Fallback |
|------------|---------|----------------------|--------|----------------------|-------|----------|
| Operator GTFS + GTFS-RT | Tracker truth | 105, 109 (quality Go); 104 needs URL for live poll | Not started | Place samples under `data/feeds/operator/` when issued; document auth in secret store | Operator data — TBC | `fixtures/operator-dummy` + MBTA/synthetic for code / Sprint 2 only |
| Postgres 16 + PostGIS image | Local/staging DB | 101 | Ready | Public `postgis/postgis:16-*` images | Delivery | None — hard requirement |
| Stadia Maps | Map tiles | 201 (runtime); 101 ADR | Not started | Free tier / API key required; set `STADIA_API_KEY` in `.env` | John Fegan | Cannot ship public map without key; local map shell can mock |
| Geocoding (provider TBC) | Postcode / address → coord | 305 | Not started | Prefer Stadia/geocoding or Ordnance Survey if UK licence allows; decide in 305 if still open | John Fegan | Postcode-only via open dataset if commercial geocoder delayed |
| Stripe | Payments | 502 | Not started | Create test-mode account; restrict live mode to Stage E (001) | John Fegan / finance | No ticket sales until Ready |
| Transactional email | Receipts, magic links, alerts | 502, 508, 403, 601 | Not started | Candidate: Resend or Postmark; sandbox domain required | John Fegan | Log-only sink in dev |
| SMS | Alert subscriptions / optional 2FA | 403 | Not started | Candidate: Twilio or MessageBird; UK sender ID rules | John Fegan | Email/web-push only until Ready |
| Web push | Alert subscriptions | 403 | Not started | VAPID keys in secret store | Delivery | Email only |
| Object storage | Receipts, CMS media, feed archives | 108, 703 | Not started | S3-compatible (platform-dependent; see 003) | Delivery | Local disk in dev |
| Malware scanning | CS uploads | 604 | Not started | ClamAV or vendor API | Delivery | Disable uploads until Ready |
| Monitoring / alerting | Ops | 108, 803 | Not started | Candidate: Grafana Cloud / Prometheus + Alertmanager; error tracking Sentry | Delivery | Structured logs only (degraded) |
| Hosting platform | Runtime | 003, 108 | Not started | Selected in Ticket 003 | Delivery | Local docker compose |
| Validator hardware | Ticket scan | 504 | Not started | See §4 | Ops — TBC | Online-only validation API first |

Renewal/expiry columns remain blank until accounts exist; update this table when each sandbox is opened.

---

## 4. Validator hardware and online-only boundary

Agreed for the **first release** (Stages A–E):

| Topic | Decision |
|-------|----------|
| Validation mode | **Online-only** — devices call the validation API; no offline store-and-forward in v1 |
| Barcode formats | Signed QR (Ticket 503); exact symbology confirmed when hardware is chosen |
| Scan throughput | **Provisional:** design API for ≥ 5 scans/sec/vehicle burst; revise after device trials |
| Credential provisioning | Staff device credentials via Ticket 400 RBAC; no shared static API keys on devices |
| Hardware observation | **Not yet observed with operations** — blocks hardening claims in 504 load tests against real devices, not API development |

Follow-up: schedule an ops session before Stage E; record device model, supported formats, and measured throughput here.

---

## 5. Secrets handling

| Rule | Detail |
|------|--------|
| Local secrets | `.env` only (gitignored); shape documented in `private.md` |
| CI / staging / prod | Platform secret store chosen in Ticket 003; never bake secrets into images |
| Feed credentials | Same secret store; fixture feeds in `data/feeds` must not include operator credentials in filenames or sidecar JSON committed to git |
| Public-repo scan (2026-07-19) | `private.md` and `.env` untracked; `data/` ignored; no `sk_live_` / `sk_test_` / AWS key / PEM patterns in tracked content; ticket filenames mentioning `gtfs` are documentation only |

Expected `.env` keys as integrations come online (no values here):

```
DATABASE_URL=
STADIA_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
GTFS_STATIC_URL=
GTFS_RT_VEHICLE_POSITIONS_URL=
GTFS_RT_TRIP_UPDATES_URL=
GTFS_RT_SERVICE_ALERTS_URL=
GTFS_FEED_AUTH_HEADER=
EMAIL_API_KEY=
SMS_API_KEY=
```

---

## 6. Risk register (unresolved dependencies)

| ID | Dependency | Severity | Owner | Due | First ticket blocked |
|----|------------|----------|-------|-----|----------------------|
| R1 | Operator GTFS + GTFS-RT access + licence | Critical | John Fegan / operator data | Before 199 | 105, 199 |
| R2 | Stadia Maps API key | High | John Fegan | Before 201 | 201 |
| R3 | Stripe test account | High | John Fegan | Before 502 | 502 |
| R4 | Hosting platform choice | High | Ticket 003 | Before 101 ADR runtime | 101, 108 |
| R5 | Email provider sandbox | Medium | John Fegan | Before 502 | 502, 601 |
| R6 | Validator device trial | Medium | Ops TBC | Before Stage E | 504 evidence |
| R7 | Legal entity / counsel (from 001) | Critical for sales | John Fegan | Before Stage E | 500, 805 |

No critical item above is relabelled as an “implementation detail”.

---

## Approval

| Role | Name | Date | Result |
|------|------|------|--------|
| Programme owner | John Fegan | 2026-07-19 | Approved — fixtures + gates recorded; operator feed remains Critical for Sprint 1 Go |
