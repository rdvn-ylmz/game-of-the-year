import test from "node:test";
import assert from "node:assert/strict";
import { CanvasGame } from "./game_canvas.mjs";

function createCanvasStub() {
  return {
    width: 920,
    height: 400,
    getContext() {
      return {};
    }
  };
}

test("CanvasGame applies difficulty profiles on init", () => {
  const game = new CanvasGame(createCanvasStub(), {});

  assert.equal(game.setDifficulty("casual"), "casual");
  game.init();
  assert.equal(game.player.maxHp, 4);
  assert.ok(game.getSpawnInterval() > 1.2);

  assert.equal(game.setDifficulty("insane"), "insane");
  game.init();
  assert.equal(game.player.maxHp, 3);
  assert.ok(game.getSpawnInterval() < 1.1);
});

test("CanvasGame surge enters active state and enforces cooldown", () => {
  const game = new CanvasGame(createCanvasStub(), {});
  game.init();

  const started = game.startSurge();
  assert.equal(started, true);
  assert.equal(game.surgeActive, true);
  assert.ok(game.surgeCooldown > 0);

  const secondStart = game.startSurge();
  assert.equal(secondStart, false);

  game.updateSurgeState(10);
  assert.equal(game.surgeActive, false);
  assert.equal(game.surgeCooldown, 0);

  const restart = game.startSurge();
  assert.equal(restart, true);
});

test("CanvasGame combat snapshot reports surge fields", () => {
  const game = new CanvasGame(createCanvasStub(), {});
  game.init();

  game.startSurge();
  const snapshot = game.getCombatSnapshot();

  assert.equal(typeof snapshot.surgeActive, "boolean");
  assert.equal(typeof snapshot.surgeCooldown, "number");
  assert.ok("difficulty" in snapshot);
});
