export const UI_COPY = Object.freeze({
  missionFraming: "Orbit defense active. Hostiles inbound.",
  runStart: "Use SPACE to toggle magnet polarity.",
  objective: "Defend the orbit. Master the magnet and time your Surge.",
  damage: "Hull hit. Stability reduced.",
  phaseTwo: "Meteor lanes tightening. Keep deposits steady.",
  phaseThree: "Solar pulse cadence rising. Bank often.",
  orbitHint: "A/D: Orbit clockwise/counter-clockwise",
  magnetHint: "SPACE: Toggle magnet polarity",
  attractHint: "Hold SPACE to ATTRACT enemies for damage",
  repelHint: "SPACE: REPEL projectiles when threatened",
  overheatWarn: "OVERHEAT WARNING - Release SPACE",
  overheatLockout: "MAGNET OFFLINE - Cooling down...",
  attractTeaching: "ATTRACT pulls enemies in. Let them crash into you!",
  repelTeaching: "REPEL pushes enemies and projectiles away!",
  minibossSpawn: "PRIORITY TARGET: TANK MK.II",
  minibossDefeat: "Target destroyed. Upgrade available.",
  bossSpawn: "WARNING: MAGNET CORE DETECTED",
  bossPhaseTwo: "Core destabilizing - increased activity",
  bossPhaseThree: "CRITICAL: Core entering meltdown",
  comboGainTemplate: "Chain held. Combo now {combo}x.",
  comboTimeout: "Combo fading. Deposit now.",
  comboCapTemplate: "Combo capped at {combo_cap}x. Cash it in.",
  comboReset: "Combo reset to 1.0x. Rebuild the chain.",
  carryHint: "More junk carried means slower turning",
  depositHint: "Press E in recycler zone to bank points",
  depositEmpty: "No scrap in hold to deposit.",
  endVictoryTitle: "Core Secured",
  endVictoryBody: "Threat eliminated. Orbit stabilized.",
  endDefeatTitle: "Signal Lost",
  endDefeatBody: "Defense breached. Recovery recommended.",
  endKoTitle: "Signal Lost",
  endKoBody: "Defense breached. Recovery recommended.",
  endTimerTitle: "Shift Complete",
  endTimerBody: "Final score locked. Recycler cycle closed.",
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
  runDurationSeconds: 180,
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
  scrapValue: 60,
  minibossSecond: 90,
  bossSecond: 165,
  overheatWarnThreshold: 75,
  overheatLockoutThreshold: 100,
  overheatCoolRate: 25,
  overheatHeatRate: 30,
  overheatLockoutDuration: 2000
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
      overlayKey: null,
      polarity: "off",
      magnetActive: false,
      heat: 0,
      overheatLocked: false,
      overheatLockoutEndTime: 0,
      ftueSteps: {
        orbitHint: false,
        magnetIntro: false,
        attractTeaching: false,
        repelTeaching: false,
        overheat50: false,
        overheat75: false,
        overheat100: false,
        minibossSpawn: false,
        minibossDefeat: false,
        upgradeSelect: false,
        bossSpawn: false,
        bossPhase2: false,
        bossPhase3: false
      },
      wave: 1,
      bossPhase: 0,
      minibossDefeated: false,
      bossDefeated: false
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

  toggleMagnet() {
    if (!this._canProcessActions()) {
      return;
    }

    if (this.state.overheatLocked) {
      return;
    }

    if (this.state.polarity === "off") {
      this.state.polarity = "attract";
      this.state.magnetActive = true;
    } else if (this.state.polarity === "attract") {
      this.state.polarity = "repel";
    } else {
      this.state.polarity = "attract";
    }

    this.state.ftueSteps.magnetIntro = true;
    this._hideOverlay();
  }

  releaseMagnet() {
    if (!this._canProcessActions()) {
      return;
    }

    this.state.magnetActive = false;
  }

  setMagnetActive(active) {
    if (!this._canProcessActions()) {
      return;
    }

    if (this.state.overheatLocked) {
      return;
    }

    if (active && this.state.polarity === "off") {
      this.state.polarity = "attract";
      this.state.magnetActive = true;
      this.state.ftueSteps.magnetIntro = true;
    } else if (active) {
      this.state.magnetActive = true;
    } else {
      this.state.magnetActive = false;
    }
  }

  triggerMinibossDefeat() {
    if (!this._canProcessActions()) {
      return;
    }

    this.state.minibossDefeated = true;
    this.state.ftueSteps.minibossDefeat = true;
    this._emit({
      type: "toast",
      key: "miniboss_defeat",
      message: UI_COPY.minibossDefeat,
      tone: "good"
    });
    this._emit({
      type: "feedback",
      key: "miniboss_defeat"
    });
  }

  triggerBossDefeat() {
    if (!this._canProcessActions()) {
      return;
    }

    this.state.bossDefeated = true;
    this._finishRun({ reason: "victory" });
  }

  selectUpgrade(upgradeId) {
    if (!this._canProcessActions()) {
      return;
    }

    this.state.ftueSteps.upgradeSelect = true;
    this._emit({
      type: "toast",
      key: "upgrade_selected",
      message: `Upgrade: ${upgradeId}`,
      tone: "good"
    });
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

  addScore(points = 0) {
    if (!this._canProcessActions()) {
      return;
    }

    const delta = Number(points);
    if (!Number.isFinite(delta)) {
      return;
    }

    this.state.score = Math.max(0, this.state.score + delta);
  }

  syncCombatState(payload = {}) {
    if (!this._canProcessActions()) {
      return;
    }

    if (Number.isFinite(payload.hp)) {
      this.state.hp = Math.max(0, Math.round(payload.hp));
    }

    if (Number.isFinite(payload.score)) {
      this.state.score = Math.max(0, Math.round(payload.score));
    }

    if (Number.isFinite(payload.heat)) {
      this.state.heat = Math.max(0, Math.min(100, payload.heat));
    }

    if (typeof payload.wave === "string" || Number.isFinite(payload.wave)) {
      this.state.wave = payload.wave;
    }

    if (Number.isFinite(payload.bossPhase)) {
      this.state.bossPhase = Math.max(0, Math.round(payload.bossPhase));
    }

    if (typeof payload.polarity === "string") {
      this.state.polarity = payload.polarity;
    }

    if (typeof payload.magnetActive === "boolean") {
      this.state.magnetActive = payload.magnetActive;
    }

    if (typeof payload.overheatLocked === "boolean") {
      this.state.overheatLocked = payload.overheatLocked;
    }

    if (typeof payload.minibossDefeated === "boolean") {
      this.state.minibossDefeated = payload.minibossDefeated;
    }

    if (typeof payload.bossDefeated === "boolean") {
      this.state.bossDefeated = payload.bossDefeated;
    }
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

    if (this.state.firstRun &&
      !this.state.boostPromptShown &&
      this.state.elapsed >= this.config.boostPromptDelaySeconds
    ) {
      this.state.boostPromptShown = true;
      this._showOverlay("magnet_prompt", UI_COPY.magnetHint);
    }

    this._updateOverheat(delta);
    this._updateWaveProgression(previousElapsed);
    this._updateBossPhases();

    if (this.state.timeLeft <= 0) {
      this._finishRun({ reason: "timer" });
    }
  }

  _updateOverheat(deltaSeconds) {
    const msElapsed = deltaSeconds * 1000;
    const nowMs = performance.now();

    if (this.state.overheatLocked) {
      if (nowMs >= this.state.overheatLockoutEndTime) {
        this.state.overheatLocked = false;
        this.state.heat = 0;
        if (this.state.magnetActive && this.state.polarity !== "off") {
        }
      } else {
        this.state.heat = Math.max(0, this.state.heat - (this.config.overheatCoolRate * deltaSeconds));
      }
      return;
    }

    if (this.state.magnetActive && this.state.polarity !== "off") {
      this.state.heat = Math.min(100, this.state.heat + (this.config.overheatHeatRate * deltaSeconds));

      if (this.state.heat >= this.config.overheatLockoutThreshold) {
        this.state.overheatLocked = true;
        this.state.overheatLockoutEndTime = nowMs + this.config.overheatLockoutDuration;
        this.state.magnetActive = false;
        this.state.ftueSteps.overheat100 = true;
        this._emit({
          type: "toast",
          key: "overheat_lockout",
          message: UI_COPY.overheatLockout,
          tone: "danger"
        });
        this._emit({
          type: "feedback",
          key: "overheat_lockout"
        });
      } else if (this.state.heat >= this.config.overheatWarnThreshold && !this.state.ftueSteps.overheat75) {
        this.state.ftueSteps.overheat75 = true;
        this._emit({
          type: "toast",
          key: "overheat_warn",
          message: UI_COPY.overheatWarn,
          tone: "warn"
        });
      } else if (this.state.heat >= 50 && !this.state.ftueSteps.overheat50) {
        this.state.ftueSteps.overheat50 = true;
      }
    } else {
      this.state.heat = Math.max(0, this.state.heat - (this.config.overheatCoolRate * deltaSeconds));
    }

    if (this.state.magnetActive && this.state.polarity === "attract" && !this.state.ftueSteps.attractTeaching) {
      this.state.ftueSteps.attractTeaching = true;
      this._emit({
        type: "toast",
        key: "attract_teaching",
        message: UI_COPY.attractTeaching,
        tone: "neutral"
      });
    }
  }

  _updateWaveProgression(previousElapsed) {
    if (this.state.elapsed >= this.config.minibossSecond && !this.state.ftueSteps.minibossSpawn) {
      this.state.ftueSteps.minibossSpawn = true;
      this.state.wave = "MINIBOSS";
      this._emit({
        type: "toast",
        key: "miniboss_spawn",
        message: UI_COPY.minibossSpawn,
        tone: "danger"
      });
      this._emit({
        type: "overlay",
        key: "miniboss_spawn",
        visible: true,
        message: UI_COPY.minibossSpawn
      });
      setTimeout(() => this._hideOverlay(), 2000);
    } else if (this.state.elapsed < this.config.minibossSecond) {
      this.state.wave = 1;
    }

    if (this.state.elapsed >= this.config.bossSecond && !this.state.ftueSteps.bossSpawn) {
      this.state.ftueSteps.bossSpawn = true;
      this.state.wave = "BOSS";
      this._emit({
        type: "toast",
        key: "boss_spawn",
        message: UI_COPY.bossSpawn,
        tone: "danger"
      });
      this._emit({
        type: "overlay",
        key: "boss_spawn",
        visible: true,
        message: UI_COPY.bossSpawn
      });
      setTimeout(() => this._hideOverlay(), 2000);
    }
  }

  _updateBossPhases() {
    if (!this.state.ftueSteps.bossSpawn) {
      return;
    }

    if (!this.state.ftueSteps.bossPhase2 && this.state.bossPhase >= 2) {
      this.state.ftueSteps.bossPhase2 = true;
      this._emit({
        type: "toast",
        key: "boss_phase2",
        message: UI_COPY.bossPhaseTwo,
        tone: "warn"
      });
    }

    if (!this.state.ftueSteps.bossPhase3 && this.state.bossPhase >= 3) {
      this.state.ftueSteps.bossPhase3 = true;
      this._emit({
        type: "toast",
        key: "boss_phase3",
        message: UI_COPY.bossPhaseThree,
        tone: "danger"
      });
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
    const victory = reason === "victory";
    this.state.status = timerComplete || victory ? "completed" : "lost";
    this.state.paused = false;
    this.state.failReason = reason;
    this._hideOverlay();

    const outcome = victory ? "victory" : (timerComplete ? "timer_complete" : "ko");
    const title = victory
      ? UI_COPY.endVictoryTitle
      : (timerComplete ? UI_COPY.endTimerTitle : UI_COPY.endDefeatTitle);
    const body = victory
      ? UI_COPY.endVictoryBody
      : (timerComplete ? UI_COPY.endTimerBody : UI_COPY.endDefeatBody);

    this._emit({
      type: "end",
      outcome,
      title,
      body,
      primaryAction: "Restart Shift",
      secondaryAction: "Quit to Title",
      tip: timerComplete ? this._nextFailTip("timer") : (victory ? "" : this._nextFailTip("integrity")),
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
