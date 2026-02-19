export const UI_COPY = Object.freeze({
  missionFraming: "Orbit is dirty. Shift starts now.",
  runStart: "Run live. Build a safe first route.",
  objective: "Vacuum junk and deposit at recycler for score.",
  damage: "Hull hit. Stability reduced.",
  phaseTwo: "Meteor lanes tightening. Keep deposits steady.",
  phaseThree: "Solar pulse cadence rising. Bank often.",
  comboGainTemplate: "Chain held. Combo now {combo}x.",
  comboTimeout: "Combo fading. Deposit now.",
  comboCapTemplate: "Combo capped at {combo_cap}x. Cash it in.",
  comboReset: "Combo reset to 1.0x. Rebuild the chain.",
  orbitHint: "Left/Right to orbit the planet",
  boostHint: "Space: short burst, then cooldown",
  carryHint: "More junk carried means slower turning",
  depositHint: "Press E in recycler zone to bank points",
  depositEmpty: "No scrap in hold to deposit.",
  endTimerTitle: "Shift Complete",
  endTimerBody: "Final score locked. Recycler cycle closed.",
  endKoTitle: "Hull Failure",
  endKoBody: "Recovery tug inbound. Run terminated.",
  pbBadge: "New Personal Best",
  pbBody: "Clean orbit, cleaner record."
});

const FAIL_TIPS = Object.freeze({
  integrity: [
    "Tip: Bank before crossing hazard lanes with heavy carry.",
    "Tip: Boost after telegraph, not into it."
  ],
  timer: [
    "Tip: Deposit earlier when carry slows your turn speed.",
    "Tip: Keep combo alive, but avoid greedy late-run routes."
  ]
});

const DEFAULT_CONFIG = Object.freeze({
  runDurationSeconds: 360,
  integrity: 3,
  phaseTwoSecond: 121,
  phaseThreeSecond: 241,
  runStartToastDelaySeconds: 2,
  orbitPromptDelaySeconds: 3,
  boostPromptDelaySeconds: 8,
  comboStart: 1.0,
  comboStep: 0.2,
  comboCap: 2.0,
  comboTimeoutSeconds: 8,
  comboWarningThresholdSeconds: 2,
  scrapValue: 60
});

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function formatOneDecimal(value) {
  return roundOne(value).toFixed(1);
}

export class GameRuntime {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this._events = [];
    this._failTipCursor = { integrity: 0, timer: 0 };
    this.state = this._createBaseState();
  }

  _createBaseState() {
    return {
      status: "idle",
      paused: false,
      firstRun: false,
      elapsed: 0,
      timeLeft: this.config.runDurationSeconds,
      hp: this.config.integrity,
      carryCount: 0,
      carryValue: 0,
      score: 0,
      combo: this.config.comboStart,
      comboWindowRemaining: 0,
      comboWarningFired: false,
      comboCapFired: false,
      moved: false,
      boosted: false,
      orbitPromptShown: false,
      boostPromptShown: false,
      runStartToastFired: false,
      phaseTwoFired: false,
      phaseThreeFired: false,
      carryHintShown: false,
      depositHintShown: false,
      failReason: null,
      overlayKey: null
    };
  }

  startRun({ firstRun = false } = {}) {
    this.state = this._createBaseState();
    this.state.status = "running";
    this.state.firstRun = Boolean(firstRun);

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

  isPaused() {
    return this.state.paused === true;
  }

  setPaused(paused) {
    this.state.paused = Boolean(paused) && this.isRunning();
    return this.state.paused;
  }

  getSnapshot() {
    return {
      ...this.state,
      timeLeftRounded: Math.max(0, Math.ceil(this.state.timeLeft)),
      comboText: formatOneDecimal(this.state.combo),
      comboWindowText: formatOneDecimal(this.state.comboWindowRemaining),
      scoreRounded: Math.round(this.state.score)
    };
  }

  drainEvents() {
    const pending = this._events;
    this._events = [];
    return pending;
  }

  _canProcessActions() {
    return this.isRunning() && !this.isPaused();
  }

  registerMovement() {
    if (!this._canProcessActions()) {
      return;
    }

    this.state.moved = true;
    if (this.state.overlayKey === "mission_intro" || this.state.overlayKey === "orbit_prompt") {
      this._hideOverlay();
    }
    this._emitRunStartToastOnce();
  }

  useBoost() {
    if (!this._canProcessActions()) {
      return;
    }

    this.state.boosted = true;
    if (this.state.overlayKey === "boost_prompt") {
      this._hideOverlay();
    }
  }

  collectScrap({ value = this.config.scrapValue } = {}) {
    if (!this._canProcessActions()) {
      return;
    }

    this.state.carryCount += 1;
    this.state.carryValue += Math.max(1, Number(value) || this.config.scrapValue);

    this._emit({
      type: "carry_update",
      key: "carry_update",
      carryCount: this.state.carryCount
    });

    if (!this.state.carryHintShown) {
      this.state.carryHintShown = true;
      this._emit({
        type: "toast",
        key: "carry_hint",
        message: UI_COPY.carryHint,
        tone: "neutral"
      });
      this._emit({
        type: "feedback",
        key: "carry_pulse"
      });
    }
  }

  depositCarry() {
    if (!this._canProcessActions()) {
      return;
    }

    if (this.state.carryCount <= 0) {
      this._emit({
        type: "toast",
        key: "deposit_empty",
        message: UI_COPY.depositEmpty,
        tone: "warn"
      });
      return;
    }

    const depositPoints = Math.round(this.state.carryValue * this.state.combo);
    this.state.score += depositPoints;
    this.state.carryCount = 0;
    this.state.carryValue = 0;

    if (!this.state.depositHintShown) {
      this.state.depositHintShown = true;
      this._emit({
        type: "toast",
        key: "deposit_hint",
        message: UI_COPY.depositHint,
        tone: "neutral"
      });
    }

    const wasChainActive = this.state.comboWindowRemaining > 0;
    const previousCombo = this.state.combo;

    if (wasChainActive) {
      this.state.combo = Math.min(
        this.config.comboCap,
        roundOne(this.state.combo + this.config.comboStep)
      );
    }

    this.state.comboWindowRemaining = this.config.comboTimeoutSeconds;
    this.state.comboWarningFired = false;

    if (wasChainActive) {
      if (
        !this.state.comboCapFired &&
        previousCombo < this.config.comboCap &&
        this.state.combo >= this.config.comboCap
      ) {
        this.state.comboCapFired = true;
        this._emit({
          type: "toast",
          key: "combo_cap",
          message: UI_COPY.comboCapTemplate,
          values: { combo_cap: formatOneDecimal(this.config.comboCap) },
          tone: "warn"
        });
      } else {
        this._emit({
          type: "toast",
          key: "combo_gain",
          message: UI_COPY.comboGainTemplate,
          values: { combo: formatOneDecimal(this.state.combo) },
          tone: "good"
        });
      }
    }

    this._emit({
      type: "feedback",
      key: "deposit"
    });
  }

  takeDamage() {
    if (!this._canProcessActions()) {
      return;
    }

    this.state.hp = Math.max(0, this.state.hp - 1);
    this._resetCombo({ reason: "damage" });

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
      this._finishRun({ reason: "integrity" });
    }
  }

  syncPlayerState({ hp, carryCount, carryValue = 0 }) {
    if (!this._canProcessActions()) {
      return;
    }
    this.state.hp = Math.max(0, Number.isFinite(hp) ? hp : this.state.hp);
    this.state.carryCount = Number.isFinite(carryCount) ? carryCount : this.state.carryCount;
    this.state.carryValue = Number.isFinite(carryValue) ? carryValue : this.state.carryValue;
  }

  endRunFromGameOver() {
    if (!this.isRunning()) {
      return;
    }
    this._finishRun({ reason: "integrity" });
  }

  tick(deltaSeconds) {
    if (!this._canProcessActions()) {
      return;
    }

    const delta = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    if (delta === 0) {
      return;
    }

    const previousElapsed = this.state.elapsed;
    this.state.elapsed += delta;
    this.state.timeLeft = Math.max(0, this.config.runDurationSeconds - this.state.elapsed);

    if (
      !this.state.phaseTwoFired &&
      previousElapsed < this.config.phaseTwoSecond &&
      this.state.elapsed >= this.config.phaseTwoSecond
    ) {
      this.state.phaseTwoFired = true;
      this._emit({
        type: "toast",
        key: "phase_two",
        message: UI_COPY.phaseTwo,
        tone: "warn"
      });
    }

    if (
      !this.state.phaseThreeFired &&
      previousElapsed < this.config.phaseThreeSecond &&
      this.state.elapsed >= this.config.phaseThreeSecond
    ) {
      this.state.phaseThreeFired = true;
      this._emit({
        type: "toast",
        key: "phase_three",
        message: UI_COPY.phaseThree,
        tone: "warn"
      });
    }

    if (this.state.comboWindowRemaining > 0) {
      const previousComboWindow = this.state.comboWindowRemaining;
      this.state.comboWindowRemaining = Math.max(0, previousComboWindow - delta);

      if (
        !this.state.comboWarningFired &&
        this.state.comboWindowRemaining > 0 &&
        this.state.comboWindowRemaining <= this.config.comboWarningThresholdSeconds
      ) {
        this.state.comboWarningFired = true;
        this._emit({
          type: "toast",
          key: "combo_timeout",
          message: UI_COPY.comboTimeout,
          tone: "warn"
        });
      }

      if (previousComboWindow > 0 && this.state.comboWindowRemaining === 0) {
        this._resetCombo({ reason: "timeout" });
      }
    }

    if (
      !this.state.runStartToastFired &&
      this.state.elapsed >= this.config.runStartToastDelaySeconds
    ) {
      this._emitRunStartToastOnce();
    }

    if (
      this.state.firstRun &&
      !this.state.moved &&
      !this.state.orbitPromptShown &&
      this.state.elapsed >= this.config.orbitPromptDelaySeconds
    ) {
      this.state.orbitPromptShown = true;
      this._showOverlay("orbit_prompt", UI_COPY.orbitHint);
    }

    if (
      this.state.firstRun &&
      !this.state.boosted &&
      !this.state.boostPromptShown &&
      this.state.elapsed >= this.config.boostPromptDelaySeconds
    ) {
      this.state.boostPromptShown = true;
      this._showOverlay("boost_prompt", UI_COPY.boostHint);
    }

    if (this.state.timeLeft <= 0) {
      this._finishRun({ reason: "timer" });
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

  _resetCombo({ reason }) {
    const hadCombo = this.state.combo > this.config.comboStart || this.state.comboWindowRemaining > 0;
    this.state.combo = this.config.comboStart;
    this.state.comboWindowRemaining = 0;
    this.state.comboWarningFired = false;

    if (hadCombo) {
      this._emit({
        type: "toast",
        key: "combo_reset",
        message: UI_COPY.comboReset,
        tone: reason === "damage" ? "warn" : "neutral"
      });
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

  _finishRun({ reason }) {
    if (!this.isRunning()) {
      return;
    }

    const timerComplete = reason === "timer";
    this.state.status = timerComplete ? "completed" : "lost";
    this.state.paused = false;
    this.state.failReason = reason;
    this._hideOverlay();

    this._emit({
      type: "end",
      outcome: timerComplete ? "timer_complete" : "ko",
      title: timerComplete ? UI_COPY.endTimerTitle : UI_COPY.endKoTitle,
      body: timerComplete ? UI_COPY.endTimerBody : UI_COPY.endKoBody,
      primaryAction: "Restart Shift",
      secondaryAction: "Quit to Title",
      tip: timerComplete ? this._nextFailTip("timer") : this._nextFailTip("integrity"),
      pbBadge: UI_COPY.pbBadge,
      pbBody: UI_COPY.pbBody,
      stats: {
        finalScore: Math.round(this.state.score),
        carryCount: this.state.carryCount,
        survivedSeconds: Math.floor(this.state.elapsed)
      }
    });
  }

  _emit(event) {
    this._events.push(event);
  }
}
