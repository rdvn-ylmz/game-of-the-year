import test from "node:test";
import assert from "node:assert/strict";
import { ToastQueue } from "./toast_queue.mjs";

test("uses priority ordering when warnings collide", () => {
  const queue = new ToastQueue({ minGapMs: 1200, durationMs: 400 });
  queue.enqueue({ key: "combo_gain", message: "gain", tone: "good" }, 0);
  queue.enqueue({ key: "combo_cap", message: "cap", tone: "warn" }, 0);
  queue.enqueue({ key: "phase_two", message: "phase", tone: "warn" }, 0);
  queue.enqueue({ key: "damage", message: "damage", tone: "danger" }, 0);

  let state = queue.tick(0);
  assert.equal(state.active?.key, "damage");

  queue.tick(500);
  state = queue.tick(1200);
  assert.equal(state.active?.key, "phase_two");

  queue.tick(1700);
  state = queue.tick(2400);
  assert.equal(state.active?.key, "combo_cap");
});

test("enforces minimum gap before showing next toast", () => {
  const queue = new ToastQueue({ minGapMs: 1200, durationMs: 200 });
  queue.enqueue({ key: "phase_two", message: "phase", tone: "warn" }, 0);
  queue.enqueue({ key: "combo_timeout", message: "timeout", tone: "warn" }, 0);

  let state = queue.tick(0);
  assert.equal(state.active?.key, "phase_two");

  queue.tick(250);
  state = queue.tick(1100);
  assert.equal(state.active, null);

  state = queue.tick(1200);
  assert.equal(state.active?.key, "combo_timeout");
});

test("debounces repeated combo gain toasts", () => {
  const queue = new ToastQueue({
    minGapMs: 0,
    durationMs: 100,
    debounceByKeyMs: { combo_gain: 900 }
  });

  const firstAccepted = queue.enqueue({ key: "combo_gain", message: "gain-1", tone: "good" }, 0);
  const secondAccepted = queue.enqueue({ key: "combo_gain", message: "gain-2", tone: "good" }, 100);
  const thirdAccepted = queue.enqueue({ key: "combo_gain", message: "gain-3", tone: "good" }, 950);

  assert.equal(firstAccepted, true);
  assert.equal(secondAccepted, false);
  assert.equal(thirdAccepted, true);
});

test("reset clears active toast, queue, and debounce state", () => {
  const queue = new ToastQueue({ minGapMs: 1200, durationMs: 500 });
  queue.enqueue({ key: "combo_gain", message: "gain", tone: "good" }, 0);
  queue.tick(0);
  queue.enqueue({ key: "combo_gain", message: "gain-2", tone: "good" }, 100);

  queue.reset();
  const acceptedAfterReset = queue.enqueue({ key: "combo_gain", message: "gain-3", tone: "good" }, 200);
  const state = queue.tick(200);

  assert.equal(acceptedAfterReset, true);
  assert.equal(state.active?.key, "combo_gain");
});
