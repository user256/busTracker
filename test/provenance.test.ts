import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyArrivalProvenance,
  DELAY_THRESHOLD_SECONDS,
} from "../lib/arrivals/provenance";

describe("arrival provenance", () => {
  it("labels scheduled when no realtime", () => {
    const p = classifyArrivalProvenance({
      source: "scheduled",
      delaySeconds: null,
    });
    assert.equal(p.kind, "scheduled");
    assert.equal(p.label, "Scheduled");
    assert.equal(p.icon, "scheduled");
  });

  it("labels live when realtime and delay under threshold", () => {
    const p = classifyArrivalProvenance({
      source: "realtime",
      delaySeconds: 60,
    });
    assert.equal(p.kind, "live");
    assert.equal(p.label, "Live");
  });

  it("labels Delayed +Nm when delay ≥ 2 minutes", () => {
    assert.equal(DELAY_THRESHOLD_SECONDS, 120);
    const p = classifyArrivalProvenance({
      source: "realtime",
      delaySeconds: 185,
    });
    assert.equal(p.kind, "delayed");
    assert.equal(p.label, "Delayed +3m");
    assert.equal(p.icon, "delayed");
  });
});
