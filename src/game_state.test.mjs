import test from "node:test";
import assert from "node:assert/strict";
import { GameRuntime, UI_COPY } from "./game_state.mjs";

test("phase alerts and low-time warning are one-shot", () => {
  const runtime = new GameRuntime();
  runtime.startRun();
  runtime.drainEvents();

  runtime.tick(121.1);
  let events = runtime.drainEvents();
  assert.equal(
    events.filter((event) => event.type === "toast" && event.key === "phase_mid").length,
    1
  );

  runtime.tick(10);
  events = runtime.drainEvents();
  assert.equal(
    events.filter((event) => event.type === "toast" && event.key === "phase_mid").length,
    0
  );

  runtime.tick(200);
  events = runtime.drainEvents();
  assert.equal(
    events.filter((event) => event.type === "toast" && event.key === "phase_mid").length,
    0
  );
  assert.equal(
    events.filter((event) => event.type === "toast" && event.key === "low_time").length,
    1
  );

  runtime.tick(1);
  events = runtime.drainEvents();
  assert.equal(
    events.filter((event) => event.type === "toast" && event.key === "low_time").length,
    0
  );
});

test("run-start cadence toast fires on first movement or timeout", () => {
  const movementRuntime = new GameRuntime();
  movementRuntime.startRun();
  let events = movementRuntime.drainEvents();
  assert.equal(events.some((event) => event.type === "toast" && event.key === "run_start"), false);

  movementRuntime.registerMovement();
  events = movementRuntime.drainEvents();
  assert.equal(events.some((event) => event.type === "toast" && event.key === "run_start"), true);

  const timeoutRuntime = new GameRuntime();
  timeoutRuntime.startRun();
  timeoutRuntime.drainEvents();
  timeoutRuntime.tick(2.1);
  events = timeoutRuntime.drainEvents();
  assert.equal(events.some((event) => event.type === "toast" && event.key === "run_start"), true);
});

test("extraction unlock and win end-state copy are correct", () => {
  const runtime = new GameRuntime();
  runtime.startRun({ firstRun: true });
  runtime.drainEvents();

  for (let index = 0; index < 6; index += 1) {
    runtime.collectCell();
  }
  let events = runtime.drainEvents();
  assert.equal(
    events.filter((event) => event.type === "toast" && event.key === "extraction_unlocked").length,
    1
  );

  runtime.attemptExtraction();
  events = runtime.drainEvents();
  const endEvent = events.find((event) => event.type === "end");
  assert.ok(endEvent);
  assert.equal(endEvent.outcome, "win");
  assert.equal(endEvent.title, UI_COPY.endWinTitle);
  assert.equal(endEvent.body, UI_COPY.endWinBody);
  assert.equal(endEvent.primaryAction, "Restart");
  assert.equal(endEvent.secondaryAction, "Quit to Title");
});

test("integrity fail path uses fail variant copy", () => {
  const runtime = new GameRuntime();
  runtime.startRun();
  runtime.drainEvents();

  runtime.takeDamage();
  runtime.drainEvents();
  runtime.takeDamage();
  runtime.drainEvents();
  runtime.takeDamage();
  const events = runtime.drainEvents();
  const endEvent = events.find((event) => event.type === "end");

  assert.ok(endEvent);
  assert.equal(endEvent.outcome, "fail");
  assert.equal(endEvent.title, UI_COPY.endFailTitle);
  assert.equal(endEvent.body, UI_COPY.endFailBody);
  assert.equal(endEvent.primaryAction, "Restart");
  assert.equal(endEvent.secondaryAction, "Quit to Title");
  assert.match(endEvent.tip, /^Tip:/);
});
