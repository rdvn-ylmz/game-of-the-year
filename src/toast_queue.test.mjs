import test from "node:test";
import assert from "node:assert/strict";
import { ToastQueue } from "./toast_queue.mjs";

test("uses priority ordering when multiple warnings collide", () => {
  const queue = new ToastQueue({ minGapMs: 1200, durationMs: 500 });
  queue.enqueue({ key: "phase_mid", message: "mid", tone: "warn" });
  queue.enqueue({ key: "damage", message: "damage", tone: "danger" });
  queue.enqueue({ key: "low_time", message: "final", tone: "warn" });
  queue.enqueue({ key: "extraction_unlocked", message: "unlock", tone: "good" });

  let state = queue.tick(0);
  assert.equal(state.active?.key, "extraction_unlocked");

  queue.tick(600);
  state = queue.tick(1200);
  assert.equal(state.active?.key, "low_time");

  queue.tick(1800);
  state = queue.tick(2400);
  assert.equal(state.active?.key, "damage");
});

test("enforces minimum gap before next queued warning", () => {
  const queue = new ToastQueue({ minGapMs: 1200, durationMs: 200 });
  queue.enqueue({ key: "phase_mid", message: "mid", tone: "warn" });
  queue.enqueue({ key: "damage", message: "damage", tone: "danger" });

  let state = queue.tick(0);
  assert.equal(state.active?.key, "damage");

  queue.tick(250);
  state = queue.tick(1100);
  assert.equal(state.active, null);

  state = queue.tick(1200);
  assert.equal(state.active?.key, "phase_mid");
});

test("reset clears active toast and pending queue", () => {
  const queue = new ToastQueue({ minGapMs: 1200, durationMs: 500 });
  queue.enqueue({ key: "phase_mid", message: "mid", tone: "warn" });
  queue.tick(0);
  queue.enqueue({ key: "damage", message: "damage", tone: "danger" });

  queue.reset();
  const state = queue.tick(1500);
  assert.equal(state.active, null);
});
