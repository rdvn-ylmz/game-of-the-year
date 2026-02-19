import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GameRuntime } from "./game_state.mjs";
import { DepositZone, Vector2 } from "./entities.mjs";

test("pause freezes tick and blocks runtime gameplay actions", () => {
  const runtime = new GameRuntime();
  runtime.startRun();
  runtime.drainEvents();
  runtime.collectScrap({ value: 60 });
  runtime.drainEvents();

  const beforePause = runtime.getSnapshot();
  runtime.setPaused(true);

  runtime.tick(2);
  runtime.collectScrap({ value: 60 });
  runtime.depositCarry();
  runtime.takeDamage();
  runtime.syncPlayerState({ hp: 1, carryCount: 5, carryValue: 300 });

  const pausedSnapshot = runtime.getSnapshot();
  assert.equal(pausedSnapshot.elapsed, beforePause.elapsed, "Elapsed should not advance while paused");
  assert.equal(pausedSnapshot.timeLeft, beforePause.timeLeft, "Time left should not change while paused");
  assert.equal(pausedSnapshot.hp, beforePause.hp, "Damage should be blocked while paused");
  assert.equal(pausedSnapshot.carryCount, beforePause.carryCount, "Collect/deposit should be blocked while paused");
  assert.equal(pausedSnapshot.score, beforePause.score, "Score should not change while paused");
  assert.equal(runtime.drainEvents().length, 0, "Paused action attempts should not emit gameplay events");

  runtime.setPaused(false);
  runtime.tick(1);
  const resumedSnapshot = runtime.getSnapshot();
  assert.equal(resumedSnapshot.elapsed, beforePause.elapsed + 1, "Elapsed should resume after unpause");
});

test("runtime actions blocked when not running", () => {
  const runtime = new GameRuntime();
  
  // Actions before start should not work
  runtime.collectScrap();
  runtime.depositCarry();
  runtime.takeDamage();
  
  const snapshot = runtime.getSnapshot();
  assert.equal(snapshot.carryCount, 0, "Should not collect scrap when not running");
  assert.equal(snapshot.score, 0, "Should not deposit when not running");
  assert.equal(snapshot.hp, 3, "Should not take damage when not running");
});

test("deposit zone contains player when inside radius", () => {
  const zone = new DepositZone(100, 100, 50);
  
  // Player at center
  const inside = new Vector2(100, 100);
  assert.ok(zone.contains(inside), "Should contain player at center");
  
  // Player at edge
  const atEdge = new Vector2(140, 100);
  assert.ok(zone.contains(atEdge), "Should contain player at edge (radius 40)");
  
  // Player outside
  const outside = new Vector2(200, 100);
  assert.ok(!zone.contains(outside), "Should not contain player outside radius");
});

test("game over transitions correctly on HP depletion", () => {
  const runtime = new GameRuntime({ integrity: 2 });
  runtime.startRun();
  runtime.drainEvents();
  
  // Take damage twice
  runtime.takeDamage();
  runtime.drainEvents();
  
  let snapshot = runtime.getSnapshot();
  assert.equal(snapshot.hp, 1, "HP should be 1 after one damage");
  assert.equal(snapshot.status, "running", "Should still be running");
  
  // Second damage should trigger game over
  runtime.takeDamage();
  const events = runtime.drainEvents();
  
  snapshot = runtime.getSnapshot();
  assert.equal(snapshot.hp, 0, "HP should be 0");
  assert.equal(snapshot.status, "lost", "Status should be lost");
  
  const endEvent = events.find(e => e.type === "end");
  assert.ok(endEvent, "Should emit end event");
  assert.equal(endEvent.outcome, "ko", "Outcome should be ko");
});

test("game over transitions correctly on timer expiry", () => {
  const runtime = new GameRuntime({ runDurationSeconds: 5 });
  runtime.startRun();
  runtime.drainEvents();
  
  // Tick past duration
  runtime.tick(5.1);
  const events = runtime.drainEvents();
  
  const snapshot = runtime.getSnapshot();
  assert.equal(snapshot.status, "completed", "Status should be completed");
  
  const endEvent = events.find(e => e.type === "end");
  assert.ok(endEvent, "Should emit end event");
  assert.equal(endEvent.outcome, "timer_complete", "Outcome should be timer_complete");
});

test("actions blocked after game over", () => {
  const runtime = new GameRuntime({ integrity: 1 });
  runtime.startRun();
  runtime.drainEvents();
  
  // Trigger game over
  runtime.takeDamage();
  runtime.drainEvents();
  
  const snapshot1 = runtime.getSnapshot();
  assert.equal(snapshot1.status, "lost", "Should be lost");
  
  // Try actions after game over
  runtime.collectScrap();
  runtime.depositCarry();
  runtime.takeDamage();
  
  const snapshot2 = runtime.getSnapshot();
  assert.equal(snapshot2.carryCount, 0, "Should not collect after game over");
  assert.equal(snapshot2.hp, 0, "HP should stay at 0");
});

test("syncPlayerState updates runtime state correctly", () => {
  const runtime = new GameRuntime();
  runtime.startRun();
  runtime.drainEvents();
  
  runtime.syncPlayerState({ hp: 2, carryCount: 5, carryValue: 300 });
  
  const snapshot = runtime.getSnapshot();
  assert.equal(snapshot.hp, 2, "HP should be synced to 2");
  assert.equal(snapshot.carryCount, 5, "Carry count should be synced to 5");
});

test("endRunFromGameOver triggers finish run", () => {
  const runtime = new GameRuntime();
  runtime.startRun();
  runtime.drainEvents();
  
  runtime.endRunFromGameOver();
  const events = runtime.drainEvents();
  
  const snapshot = runtime.getSnapshot();
  assert.equal(snapshot.status, "lost", "Should be lost after endRunFromGameOver");
  
  const endEvent = events.find(e => e.type === "end");
  assert.ok(endEvent, "Should emit end event");
});

test("endRunFromGameOver clears pause and blocks post-end mutations", () => {
  const runtime = new GameRuntime();
  runtime.startRun();
  runtime.drainEvents();

  runtime.setPaused(true);
  assert.equal(runtime.isPaused(), true, "Pause should be enabled while run is active");

  runtime.endRunFromGameOver();
  const snapshot = runtime.getSnapshot();
  assert.equal(snapshot.status, "lost", "Run should be finished as lost");
  assert.equal(snapshot.paused, false, "End run should clear paused state");

  runtime.collectScrap({ value: 60 });
  const afterAction = runtime.getSnapshot();
  assert.equal(afterAction.carryCount, snapshot.carryCount, "Actions should remain blocked after end run");
});

test("main integration uses public runtime APIs and keeps keyboard/debug paths", () => {
  const source = readFileSync(new URL("./main.mjs", import.meta.url), "utf8");

  assert.equal(source.includes("runtime.state."), false, "main should not mutate runtime.state directly");
  assert.equal(source.includes("runtime._finishRun("), false, "main should not call private runtime methods");
  assert.equal(source.includes("runtime.syncPlayerState("), true, "main should sync via public API");
  assert.equal(source.includes("runtime.endRunFromGameOver("), true, "main should finish via public API");
  assert.equal(source.includes("if (isGameplayPaused()) {"), true, "keyboard actions should be pause-guarded");
  assert.equal(source.includes("if (canDispatchGameplayAction()) {"), true, "debug actions should be gated");
  assert.equal(source.includes("if (MOVEMENT_KEYS.has(key)) {"), true, "keyboard movement should remain available");
});

test("deposit zone prompt visibility is contextual", () => {
  const zone = new DepositZone(100, 100, 50);
  
  // Create a mock canvas context
  const mockCtx = {
    strokeStyle: "",
    lineWidth: 0,
    setLineDash: () => {},
    beginPath: () => {},
    arc: () => {},
    stroke: () => {},
    fillStyle: "",
    fill: () => {},
    font: "",
    textAlign: "",
    fillText: () => {}
  };
  
  let fillTextCalls = [];
  mockCtx.fillText = (text, x, y) => {
    fillTextCalls.push({ text, x, y });
  };
  
  // Draw without player - should not show "Press E"
  zone.draw(mockCtx, { x: 0, y: 0 }, null);
  const promptWithoutPlayer = fillTextCalls.find(c => c.text && c.text.includes("Press E"));
  assert.ok(!promptWithoutPlayer, "Should not show Press E prompt without player");
  
  // Draw with player outside - should not show "Press E"
  fillTextCalls = [];
  const outsidePlayer = new Vector2(200, 100);
  zone.draw(mockCtx, { x: 0, y: 0 }, outsidePlayer);
  const promptOutside = fillTextCalls.find(c => c.text && c.text.includes("Press E"));
  assert.ok(!promptOutside, "Should not show Press E prompt when player outside");
  
  // Draw with player inside - should show "Press E"
  fillTextCalls = [];
  const insidePlayer = new Vector2(100, 100);
  zone.draw(mockCtx, { x: 0, y: 0 }, insidePlayer);
  const promptInside = fillTextCalls.find(c => c.text && c.text.includes("Press E"));
  assert.ok(promptInside, "Should show Press E prompt when player inside");
});
