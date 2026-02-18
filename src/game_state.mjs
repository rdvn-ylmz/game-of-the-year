export const UI_COPY = Object.freeze({
  missionFraming: "Blackout wave inbound. Stay mobile.",
  runStart: "Run live. Build a clean route.",
  objective: "Collect 6 energy cells to unlock extraction.",
  damage: "Integrity hit. Multiplier reset.",
  phaseMid: "Grid surge. Patrol traffic increasing.",
  extractionUnlocked: "Quota met. Extraction is now active.",
  lowTime: "Thirty seconds. Commit to extraction now.",
  movementHint: "Move: WASD / Arrow Keys",
  dashHint: "Space - Short burst, then cooldown",
  endWinTitle: "Delivery complete. Last light preserved.",
  endWinBody: "Extraction secured. Sector pulse restored.",
  endFailTitle: "Mission failed. Re-run and reroute.",
  endFailBody: "Courier signal lost. Sector offline."
});

const FAIL_TIPS = Object.freeze({
  integrity: [
    "Tip: Dash through laser off-window.",
    "Tip: Avoid drone overlap before committing lanes."
  ],
  timer: [
    "Tip: Turn to extraction as soon as quota is met.",
    "Tip: Keep one route open for the final 30 seconds."
  ]
});

const DEFAULT_CONFIG = Object.freeze({
  runDurationSeconds: 360,
  requiredCells: 6,
  integrity: 3,
  phaseMidSecond: 121,
  lowTimeThresholdSeconds: 30,
  runStartToastDelaySeconds: 2,
  movementPromptDelaySeconds: 3,
  dashPromptDelaySeconds: 8,
  multiplierStart: 1.0,
  multiplierStep: 0.1,
  multiplierMax: 2.0,
  multiplierGainIntervalSeconds: 10,
  cellScore: 100,
  survivalScorePerSecond: 5
});

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

export class GameRuntime {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this._events = [];
    this._survivalAccumulator = 0;
    this._multiplierAccumulator = 0;
    this._failTipCursor = { integrity: 0, timer: 0 };
    this.state = this._createBaseState();
  }

  _createBaseState() {
    return {
      status: "idle",
      firstRun: false,
      elapsed: 0,
      timeLeft: this.config.runDurationSeconds,
      hp: this.config.integrity,
      cells: 0,
      extractionUnlocked: false,
      score: 0,
      multiplier: this.config.multiplierStart,
      moved: false,
      dashed: false,
      movementPromptShown: false,
      dashPromptShown: false,
      runStartToastFired: false,
      phaseMidFired: false,
      lowTimeFired: false,
      failReason: null,
      overlayKey: null
    };
  }

  startRun({ firstRun = false } = {}) {
    this.state = this._createBaseState();
    this.state.status = "running";
    this.state.firstRun = Boolean(firstRun);
    this._survivalAccumulator = 0;
    this._multiplierAccumulator = 0;

    this._emit({
      type: "objective",
      key: "objective",
      message: UI_COPY.objective
    });
    this._showOverlay("mission_intro", UI_COPY.missionFraming);
  }

  isRunning() {
    return this.state.status === "running";
  }

  getSnapshot() {
    return {
      ...this.state,
      requiredCells: this.config.requiredCells,
      timeLeftRounded: Math.max(0, Math.ceil(this.state.timeLeft)),
      scoreRounded: Math.round(this.state.score)
    };
  }

  drainEvents() {
    const pending = this._events;
    this._events = [];
    return pending;
  }

  registerMovement() {
    if (!this.isRunning()) {
      return;
    }
    this.state.moved = true;
    if (
      this.state.overlayKey === "mission_intro" ||
      this.state.overlayKey === "movement_prompt"
    ) {
      this._hideOverlay();
    }
    this._emitRunStartToastOnce();
  }

  useDash() {
    if (!this.isRunning()) {
      return;
    }
    this.state.dashed = true;
    if (this.state.overlayKey === "dash_prompt") {
      this._hideOverlay();
    }
  }

  collectCell() {
    if (!this.isRunning() || this.state.cells >= this.config.requiredCells) {
      return;
    }

    this.state.cells += 1;
    this.state.score += this.config.cellScore * this.state.multiplier;

    this._emit({
      type: "objective_update",
      key: "cells",
      current: this.state.cells,
      total: this.config.requiredCells
    });

    if (this.state.cells === 1) {
      this._emit({
        type: "toast",
        key: "first_cell",
        message: `Cells collected: ${this.state.cells}/${this.config.requiredCells}`,
        tone: "neutral"
      });
    }

    if (this.state.cells >= this.config.requiredCells && !this.state.extractionUnlocked) {
      this.state.extractionUnlocked = true;
      this._emit({
        type: "toast",
        key: "extraction_unlocked",
        message: UI_COPY.extractionUnlocked,
        tone: "good"
      });
      this._emit({
        type: "feedback",
        key: "extraction_pulse"
      });
    }
  }

  takeDamage() {
    if (!this.isRunning()) {
      return;
    }

    this.state.hp = Math.max(0, this.state.hp - 1);
    this.state.multiplier = this.config.multiplierStart;
    this._multiplierAccumulator = 0;

    this._emit({
      type: "toast",
      key: "damage",
      message: UI_COPY.damage,
      tone: "danger"
    });
    this._emit({
      type: "feedback",
      key: "damage"
    });

    if (this.state.hp <= 0) {
      this._finishRun({ win: false, reason: "integrity" });
    }
  }

  attemptExtraction() {
    if (!this.isRunning() || !this.state.extractionUnlocked) {
      return;
    }
    this._finishRun({ win: true, reason: null });
  }

  tick(deltaSeconds) {
    if (!this.isRunning()) {
      return;
    }

    const delta = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    if (delta === 0) {
      return;
    }

    const previousElapsed = this.state.elapsed;
    this.state.elapsed += delta;
    this.state.timeLeft = Math.max(0, this.config.runDurationSeconds - this.state.elapsed);

    this._survivalAccumulator += delta;
    while (this._survivalAccumulator >= 1) {
      this.state.score += this.config.survivalScorePerSecond;
      this._survivalAccumulator -= 1;
    }

    this._multiplierAccumulator += delta;
    while (this._multiplierAccumulator >= this.config.multiplierGainIntervalSeconds) {
      if (this.state.multiplier < this.config.multiplierMax) {
        this.state.multiplier = Math.min(
          this.config.multiplierMax,
          roundOne(this.state.multiplier + this.config.multiplierStep)
        );
        this._emit({
          type: "feedback",
          key: "multiplier_up"
        });
      }
      this._multiplierAccumulator -= this.config.multiplierGainIntervalSeconds;
    }

    if (!this.state.phaseMidFired &&
      previousElapsed < this.config.phaseMidSecond &&
      this.state.elapsed >= this.config.phaseMidSecond) {
      this.state.phaseMidFired = true;
      this._emit({
        type: "toast",
        key: "phase_mid",
        message: UI_COPY.phaseMid,
        tone: "warn"
      });
    }

    if (!this.state.lowTimeFired && this.state.timeLeft < this.config.lowTimeThresholdSeconds) {
      this.state.lowTimeFired = true;
      this._emit({
        type: "toast",
        key: "low_time",
        message: UI_COPY.lowTime,
        tone: "warn"
      });
      this._emit({
        type: "feedback",
        key: "timer_low"
      });
    }

    if (
      !this.state.runStartToastFired &&
      this.state.elapsed >= this.config.runStartToastDelaySeconds
    ) {
      this._emitRunStartToastOnce();
    }

    if (this.state.firstRun &&
      !this.state.moved &&
      !this.state.movementPromptShown &&
      this.state.elapsed >= this.config.movementPromptDelaySeconds) {
      this.state.movementPromptShown = true;
      this._showOverlay("movement_prompt", UI_COPY.movementHint);
    }

    if (this.state.firstRun &&
      this.state.moved &&
      !this.state.dashed &&
      !this.state.dashPromptShown &&
      this.state.elapsed >= this.config.dashPromptDelaySeconds) {
      this.state.dashPromptShown = true;
      this._showOverlay("dash_prompt", UI_COPY.dashHint);
    }

    if (this.state.timeLeft <= 0) {
      this._finishRun({ win: false, reason: "timer" });
    }
  }

  _emitRunStartToastOnce() {
    if (this.state.runStartToastFired) {
      return;
    }
    this.state.runStartToastFired = true;
    this._emit({
      type: "toast",
      key: "run_start",
      message: UI_COPY.runStart,
      tone: "neutral"
    });
    if (this.state.overlayKey === "mission_intro") {
      this._hideOverlay();
    }
  }

  _showOverlay(key, message) {
    this.state.overlayKey = key;
    this._emit({
      type: "overlay",
      key,
      visible: true,
      message
    });
  }

  _hideOverlay() {
    this.state.overlayKey = null;
    this._emit({
      type: "overlay",
      key: null,
      visible: false,
      message: ""
    });
  }

  _nextFailTip(reason) {
    const pool = FAIL_TIPS[reason];
    if (!pool || pool.length === 0) {
      return "";
    }

    const index = this._failTipCursor[reason] % pool.length;
    this._failTipCursor[reason] += 1;
    return pool[index];
  }

  _finishRun({ win, reason }) {
    if (!this.isRunning()) {
      return;
    }

    this.state.status = win ? "won" : "lost";
    this.state.failReason = reason;
    this._hideOverlay();

    this._emit({
      type: "end",
      outcome: win ? "win" : "fail",
      title: win ? UI_COPY.endWinTitle : UI_COPY.endFailTitle,
      body: win ? UI_COPY.endWinBody : UI_COPY.endFailBody,
      primaryAction: "Restart",
      secondaryAction: "Quit to Title",
      tip: win ? "" : this._nextFailTip(reason),
      stats: {
        finalScore: Math.round(this.state.score),
        cellsCollected: this.state.cells,
        requiredCells: this.config.requiredCells,
        survivedSeconds: Math.floor(this.state.elapsed)
      }
    });
  }

  _emit(event) {
    this._events.push(event);
  }
}
