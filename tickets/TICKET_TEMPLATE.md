# Ticket {ID}: {Short title}

**Sprint:** {Sprint number and theme, e.g. "1 — Foundation"}
**Status:** {Not started | In progress | Blocked | In review | Done}
**Owner:** {Name or @handle, or "unassigned"}
**Estimate:** {Rough size — S / M / L, or hours/days. Be honest.}

---

## Context

Why this ticket exists. What problem does it solve, what does the project look like without it, and what triggered it being written now? Two to five sentences. Link prior tickets, PRs, or discussions if relevant.

## Goal

A single sentence describing the outcome. If you need more than one sentence, this is probably two tickets.

> Example: *"The primary workflow runs end-to-end on a fixed input set with structured, validated output, and any failure is surfaced with a traceable error."*

## Acceptance criteria

Concrete, checkable conditions. Each one should be something a reviewer can verify by running the code or reading the diff — not a vibe.

- [ ] {Specific behaviour or artefact, e.g. "running `python3 run.py --input fixtures/sample.json` produces a `Result` object that validates against `schema/result.json`"}
- [ ] {Test or eval that must pass, with the exact command}
- [ ] {Observable change, e.g. "errors raised inside the workflow are logged with `run_id`, `step`, and `model` fields"}
- [ ] {Docs updated where relevant — `README.md`, `private.md`, or this ticket's parent sprint exit criteria}

## Out of scope

What this ticket explicitly does **not** do. This is as important as the goal — it stops scope creep mid-implementation.

- {Thing that might look like it belongs here but doesn't}
- {Future work this enables but doesn't deliver}

## Dependencies

- **Blocks:** {tickets that can't start until this is done, or "none"}
- **Blocked by:** {tickets that must finish first, or "none"}
- **External:** {APIs, credentials, datasets, model access, decisions from outside the team}

## Approach (optional)

Sketch of how you plan to implement it. Keep it short — this is a working note, not a design doc. If the approach needs a full design doc, link it.

## LLM-specific notes (if applicable)

Fill in any that apply, delete the rest:

- **Prompts touched:** {paths under `prompts/`}
- **Models used:** {e.g. `claude-opus-4-7`, `claude-haiku-4-5`}
- **Eval set:** {which dataset under `evals/` covers this, and what the pass bar is}
- **Cost / latency expectations:** {rough per-run cost or p50/p95 latency, if relevant}
- **Determinism:** {is output expected to be stable? what's the variance budget?}

## Notes / decisions log

Append-only. Record decisions made during implementation, especially ones that change the original plan. Useful for the review ticket at the end of the sprint.

- {date} — {decision or finding}

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
