# ADR 0001: Hosting and runtime platform

**Status:** Accepted  
**Date:** 2026-07-19  
**Ticket:** 003 (delivery model); grounds Ticket 101 worker/runtime ADR  
**Deciders:** John Fegan

## Context

busTracker needs a place to run (a) a Next.js web app, (b) long-lived GTFS-Realtime poller workers, (c) Postgres 16 + PostGIS, (d) object storage for artefacts, and (e) TLS-terminated public HTTP. Serverless/request-scoped runtimes are a poor fit for continuous feed polling. The operator of this programme already runs Docker Compose stacks (e.g. Backdoor) behind a VPS TLS front-end and NAS reverse proxy.

## Decision

**Self-hosted Docker Compose on Linux**, following the existing homelab/NAS operating model:

| Component | How it runs |
|-----------|-------------|
| Web app | `web` container — Next.js Node server (not serverless) |
| Ingest workers | separate `worker` container(s) — long-lived Node processes, restart `unless-stopped`, supervised by Compose |
| Database | `db` container — `postgis/postgis:16-*` with a named volume |
| Object storage | named volume in Stage A–B; S3-compatible (MinIO or cloud bucket) from Ticket 108 when feed archives / receipts need it |
| CDN / edge | optional Cloudflare proxy in front of the public hostname (enable before Stage C public beta); origin remains Compose |
| Shared rate-limit state | Redis container when Ticket 804 needs it; until then in-process / Postgres-backed limits are acceptable for staging |
| Scheduled jobs | `cron`-style Compose service or worker timers (static GTFS refresh) — not GitHub Actions hitting production |

**Environments:**

- **Development** — `docker compose up` on a laptop; bind-mounted source; local `.env`
- **Staging** — Compose project on the NAS (or dedicated VM), auth-walled / non-indexed hostname
- **Production** — separate Compose project and volumes; separate secrets; public hostname

**TLS / ingress:** Reuse the proven pattern — public VPS terminates TLS and reverse-proxies to the private origin (Tailscale/VPN or equivalent). Admin surfaces get a distinct hostname and stricter allowlisting (Stage F).

## Consequences

- Ticket 101 can write its worker ADR against “always-on Node process in Compose,” not Lambda/Cloud Run jobs.
- Ticket 108 implements staging Compose, backups, and baseline telemetry on this model rather than choosing a PaaS.
- Peak multi-region active-active is out of scope (Sprint 8 explicitly); vertical scale + Cloudflare cache come first.
- Cost is primarily the existing VPS/NAS electricity and any Cloudflare/Stadia/Stripe usage — not a second full PaaS bill — but the operator must still name budget alerts (see `delivery.md`).

## Alternatives considered

| Option | Why not (now) |
|--------|----------------|
| Fly.io / Railway / Render | Fine for web, awkward for PostGIS + always-on workers + familiar ops; adds a second ops dialect |
| Kubernetes | Excess operational surface for a single-operator programme |
| Vercel + external DB + separate worker host | Splits the system across vendors; worker still needs a host; worse local parity |
