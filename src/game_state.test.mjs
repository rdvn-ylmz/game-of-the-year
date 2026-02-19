import test from "node:test";
import assert from "node:assert/strict";
import { GameRuntime, UI_COPY } from "./game_state.mjs";

test("phase warnings are one-shot at 121s and 160s", () => {
  const runtime = new GameRuntime();
  runtime.startRun();
  runtime.drainEvents();

  runtime.tick(121.1);
  let events = runtime.drainEvents();
  assert.equal(
    events.filter((event) => event.type === "toast" && event.key === "phase_two").length,
    1
  );

  runtime.tick(10);
  events = runtime.drainEvents();
  assert.equal(
    events.filter((event) => event.type === "toast" && event.key === "phase_two").length,
    0
  );

  runtime.tick(39);
  events = runtime.drainEvents();
  assert.equal(
    events.filter((event) => event.type === "toast" && event.key === "phase_three").length,
    1
  );

  runtime.tick(10);
  events = runtime.drainEvents();
  assert.equal(
    events.filter((event) => event.type === "toast" && event.key === "phase_three").length,
    0
  );
});

test("run-start cadence toast fires on movement or timeout", () => {
  const moveRuntime = new GameRuntime();
  moveRuntime.startRun();
  let events = moveRuntime.drainEvents();
  assert.equal(events.some((event) => event.key === "run_start"), false);

  moveRuntime.registerMovement();
  events = moveRuntime.drainEvents();
  assert.equal(events.some((event) => event.key === "run_start"), true);

  const timeoutRuntime = new GameRuntime();
  timeoutRuntime.startRun();
  timeoutRuntime.drainEvents();
  timeoutRuntime.tick(2.1);
  events = timeoutRuntime.drainEvents();
  assert.equal(events.some((event) => event.key === "run_start"), true);
});

test("runtime exposes objective and narrative toast events for chapter scripting", () => {
  const runtime = new GameRuntime();
  runtime.startRun();
  runtime.drainEvents();

  runtime.setObjective("Sector B: break shooter lanes.");
  runtime.pushNarrativeToast({
    key: "radio_custom",
    tone: "warn",
    message: "ARC-12: Shooter squad detected."
  });

  const events = runtime.drainEvents();
  const objectiveEvent = events.find((event) => event.type === "objective");
  const toastEvent = events.find((event) => event.type === "toast" && event.key === "radio_custom");
  assert.ok(objectiveEvent);
  assert.equal(objectiveEvent.message, "Sector B: break shooter lanes.");
  assert.ok(toastEvent);
  assert.equal(toastEvent.tone, "warn");
});

test("combo timeout warning fires once per chain and resets on expiry", () => {
  const runtime = new GameRuntime();
  runtime.startRun();
  runtime.drainEvents();

  runtime.collectScrap();
  runtime.depositCarry();
  runtime.collectScrap();
  runtime.depositCarry();
  runtime.drainEvents();

  runtime.tick(6.1);
  let events = runtime.drainEvents();
  assert.equal(
    events.filter((event) => event.type === "toast" && event.key === "combo_timeout").length,
    1
  );

  runtime.tick(0.4);
  events = runtime.drainEvents();
  assert.equal(
    events.filter((event) => event.type === "toast" && event.key === "combo_timeout").length,
    0
  );

  runtime.tick(2);
  events = runtime.drainEvents();
  assert.equal(
    events.filter((event) => event.type === "toast" && event.key === "combo_reset").length,
    1
  );

  runtime.collectScrap();
  runtime.depositCarry();
  runtime.collectScrap();
  runtime.depositCarry();
  runtime.drainEvents();
  runtime.tick(6.1);
  events = runtime.drainEvents();
  assert.equal(
    events.filter((event) => event.type === "toast" && event.key === "combo_timeout").length,
    1
  );
});

test("combo placeholder values are one decimal and cap message is emitted once", () => {
  const runtime = new GameRuntime({ comboStep: 0.5, comboCap: 2.0 });
  runtime.startRun();
  runtime.drainEvents();

  runtime.collectScrap();
  runtime.depositCarry();
  runtime.collectScrap();
  runtime.depositCarry();
  let events = runtime.drainEvents();
  const gainEvent = events.find((event) => event.type === "toast" && event.key === "combo_gain");
  assert.ok(gainEvent);
  assert.equal(gainEvent.values.combo, "1.5");

  runtime.collectScrap();
  runtime.depositCarry();
  events = runtime.drainEvents();
  const capEvent = events.find((event) => event.type === "toast" && event.key === "combo_cap");
  assert.ok(capEvent);
  assert.equal(capEvent.values.combo_cap, "2.0");

  runtime.collectScrap();
  runtime.depositCarry();
  events = runtime.drainEvents();
  assert.equal(events.filter((event) => event.type === "toast" && event.key === "combo_cap").length, 0);
});

test("timer-complete and KO end states use correct hierarchy and CTA order", () => {
  const timerRuntime = new GameRuntime();
  timerRuntime.startRun();
  timerRuntime.drainEvents();
  timerRuntime.tick(360.1);
  let events = timerRuntime.drainEvents();
  const timerEnd = events.find((event) => event.type === "end");

  assert.ok(timerEnd);
  assert.equal(timerEnd.outcome, "timer_complete");
  assert.equal(timerEnd.title, UI_COPY.endTimerTitle);
  assert.equal(timerEnd.body, UI_COPY.endTimerBody);
  assert.equal(timerEnd.primaryAction, "Restart Shift");
  assert.equal(timerEnd.secondaryAction, "Quit to Title");

  const koRuntime = new GameRuntime();
  koRuntime.startRun();
  koRuntime.drainEvents();
  koRuntime.takeDamage();
  koRuntime.drainEvents();
  koRuntime.takeDamage();
  koRuntime.drainEvents();
  koRuntime.takeDamage();
  events = koRuntime.drainEvents();
  const koEnd = events.find((event) => event.type === "end");

  assert.ok(koEnd);
  assert.equal(koEnd.outcome, "ko");
  assert.equal(koEnd.title, UI_COPY.endKoTitle);
  assert.equal(koEnd.body, UI_COPY.endKoBody);
  assert.equal(koEnd.primaryAction, "Restart Shift");
  assert.equal(koEnd.secondaryAction, "Quit to Title");
});

test("boss defeat emits victory end state", () => {
  const runtime = new GameRuntime();
  runtime.startRun();
  runtime.drainEvents();

  runtime.addScore(900);
  runtime.triggerBossDefeat();
  const events = runtime.drainEvents();
  const victoryEnd = events.find((event) => event.type === "end");

  assert.ok(victoryEnd);
  assert.equal(victoryEnd.outcome, "victory");
  assert.equal(victoryEnd.title, UI_COPY.endVictoryTitle);
  assert.equal(victoryEnd.body, UI_COPY.endVictoryBody);
  assert.equal(victoryEnd.stats.finalScore, 900);
  assert.equal(runtime.getSnapshot().status, "completed");
});

test("syncCombatState updates combat-facing HUD fields", () => {
  const runtime = new GameRuntime();
  runtime.startRun();
  runtime.drainEvents();

  runtime.syncCombatState({
    hp: 2,
    score: 1234,
    heat: 78,
    wave: "MINIBOSS",
    bossPhase: 2,
    polarity: "repel",
    magnetActive: true,
    overheatLocked: false,
    minibossDefeated: true
  });

  const snapshot = runtime.getSnapshot();
  assert.equal(snapshot.hp, 2);
  assert.equal(snapshot.scoreRounded, 1234);
  assert.equal(snapshot.heat, 78);
  assert.equal(snapshot.wave, "MINIBOSS");
  assert.equal(snapshot.bossPhase, 2);
  assert.equal(snapshot.polarity, "repel");
  assert.equal(snapshot.magnetActive, true);
  assert.equal(snapshot.minibossDefeated, true);
});

test("boss phase toasts are HP-phase driven via syncCombatState", () => {
  const runtime = new GameRuntime();
  runtime.startRun();
  runtime.drainEvents();

  runtime.tick(166);
  let events = runtime.drainEvents();
  assert.equal(events.some((event) => event.type === "toast" && event.key === "boss_spawn"), true);
  assert.equal(events.some((event) => event.type === "toast" && event.key === "boss_phase2"), false);
  assert.equal(events.some((event) => event.type === "toast" && event.key === "boss_phase3"), false);

  runtime.syncCombatState({ bossPhase: 2 });
  runtime.tick(0.016);
  events = runtime.drainEvents();
  assert.equal(events.some((event) => event.type === "toast" && event.key === "boss_phase2"), true);
  assert.equal(events.some((event) => event.type === "toast" && event.key === "boss_phase3"), false);

  runtime.syncCombatState({ bossPhase: 3 });
  runtime.tick(0.016);
  events = runtime.drainEvents();
  assert.equal(events.some((event) => event.type === "toast" && event.key === "boss_phase3"), true);
});
