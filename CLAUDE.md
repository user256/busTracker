# Project rules — busTracker

These are operating rules for this repo specifically. They override default
behaviour and apply in every session/instance working here.

## What this project is

A bus operator's public website: real-time vehicle tracking, journey planning,
timetables, ticket sales, and the staff tooling behind them. The full functional
brief is in `features.md`; the sequenced plan is in `tickets/overview.md`.

**The live tracker is the priority.** It is the first customer-visible feature
we intend to land, and Sprints 1–2 are entirely devoted to it. We are
replicating the tracker at [ember.to](https://www.ember.to).

## Stack (decided 2026-07-19)

- **Frontend:** Next.js (App Router, TypeScript)
- **Map:** MapLibre GL JS over Stadia Maps tiles
- **Data store:** Postgres 16 + PostGIS
- **Transit data:** GTFS static + GTFS-Realtime (VehiclePositions, TripUpdates, ServiceAlerts)
- **Payments:** Stripe — we never store card details

Ticket 101 records this as an ADR. If you change it, change it there.

## The one rule the product turns on

**Never present an estimate as a guarantee, and never show stale data as live.**
`features.md` is emphatic about this and it is baked into the Sprint 1–2
acceptance criteria. A tracker that admits "no live data — showing timetable" is
correct; one that silently shows a five-minute-old position under a LIVE badge is
broken, even though it looks fine. Treat any change that blurs live / delayed /
scheduled as a bug.

## Git & deployment workflow

The motivating problem (from the project these rules came out of): work piled
up dozens of commits / several days ahead of `origin`, and the live
environment lagged the working tree, so bugs that were "fixed in code" were
still broken in production. These rules exist to stop that recurring.

### 1. Push to git on every completed major ticket/feature

When a major ticket or feature is **logically complete** (implemented +
verified — e.g. static analysis clean and smoke-tested), **commit and push to
the remote** — don't let completed work sit only on the dev box. Small
follow-up edits can batch, but a finished feature is a push.

- Branch first if on `main` (default-branch policy).
- Commit messages end with the standard `Co-Authored-By` trailer.
- **Before pushing, check for tracked secrets.** If any env/secret file is
  tracked in git, untrack + rotate it (and confirm with the user) before
  pushing, so you don't publish secrets to the remote.

### 2. Ask about merging when a branch is logically complete

If working on a feature branch (not `main`), once the work on it is
**logically complete / mergeable**, proactively **ask the user whether to
merge** it (to `main` or the relevant integration branch). Don't leave a
finished branch unmerged and unmentioned.

### 3. Keep the live environment current — don't let prod drift

A code fix that only exists in the repo is not "done"; production must reflect
it. Don't let the live environment fall far behind the current iteration.

**Know your deploy tiers — and whether they're coupled (this bites):**

- A **fast tier** (e.g. tar/rsync/`exec`-ing source into a *running*
  container, or a hot reload) is great for iterating + letting the user test,
  but it is often **EPHEMERAL** — the change lives only in the running
  container's writable layer, not in the image/artifact that a restart
  rebuilds from.
- A **durable tier** bakes the change into the deployable artifact (rebuild
  the image / publish the package), then restarts onto it.

**THE TRAP:** a bare restart / container recreate / redeploy can discard every
fast-tier change and revert prod to the last *baked* artifact — silently
rolling back all pending hot changes. So **never restart/recreate without
baking first** if you've been using the fast tier. Treat a restart as a
"promote the pending changes into the artifact" checkpoint, never a bare
bounce. After any rebuild + restart, **verify the change is actually in the
recreated environment** (e.g. `grep` for a known marker) and **ask the user to
test**.

Workflow: use the fast tier during a work session; bake the artifact at the
end of a batch (or before any needed restart) so the running environment and
the artifact converge.

- If the deploy applies DB migrations, **verify they actually ran** (not "up to
  date") rather than assuming.
- Don't SSH to prod or exec into prod containers beyond the agreed deploy
  unless the user authorises that specific action.

### 4. Ship a test with every change (if the project has a test harness)

Any new backend behaviour ships with at least one test exercising it on the
existing harness, unless the change is non-code. Keep the test + static-analysis
gates green; wire them into CI and let CI run on every push.

## See also

- `tickets/` — sprint roadmap, ticket template, closure-pattern conventions.
- Global `~/.claude/CLAUDE.md` — cross-project abilities + cross-instance notes.
