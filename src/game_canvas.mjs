import { Player } from "./entities.mjs";
import {
  CombatHazard,
  EnhancedVFX,
  AudioCueSystem,
  UPGRADE_POOL
} from "./combat_system.mjs";

const MINIBOSS_TIME = 90;
const BOSS_TIME = 165;
const UPGRADE_TYPES = new Set(["damage", "health", "magnet", "cooldown", "overheat", "heat_per_shot"]);
const DEFAULT_DIFFICULTY = "arcade";

const DIFFICULTY_PROFILES = Object.freeze({
  casual: Object.freeze({
    playerHp: 4,
    spawnIntervalScale: 1.15,
    enemySpeedScale: 0.88,
    bossHpScale: 0.85,
    scoreScale: 0.9,
    heatRateScale: 0.86,
    coolRateScale: 1.15,
    lockDurationScale: 0.82,
    surgeDuration: 2.4,
    surgeCooldown: 5.2
  }),
  arcade: Object.freeze({
    playerHp: 3,
    spawnIntervalScale: 1,
    enemySpeedScale: 1,
    bossHpScale: 1,
    scoreScale: 1,
    heatRateScale: 1,
    coolRateScale: 1,
    lockDurationScale: 1,
    surgeDuration: 2,
    surgeCooldown: 6
  }),
  insane: Object.freeze({
    playerHp: 3,
    spawnIntervalScale: 0.84,
    enemySpeedScale: 1.16,
    bossHpScale: 1.22,
    scoreScale: 1.2,
    heatRateScale: 1.12,
    coolRateScale: 0.9,
    lockDurationScale: 1.25,
    surgeDuration: 1.75,
    surgeCooldown: 7.2
  })
});

const STORY_CHAPTERS = Object.freeze([
  Object.freeze({
    id: "chapter_1",
    start: 0,
    end: 58,
    label: "Sector A - Debris Storm",
    objective: "Clear scout packs and keep heat under 70%.",
    introToast: "ARC-12: Sector A online. Build charge safely."
  }),
  Object.freeze({
    id: "chapter_2",
    start: 58,
    end: 128,
    label: "Sector B - Reactor Drift",
    objective: "Shooter squadrons incoming. Use REPEL to deflect shots.",
    introToast: "Helios Net: Reactor drift detected. Hostile gunners inbound."
  }),
  Object.freeze({
    id: "chapter_3",
    start: 128,
    end: 999,
    label: "Sector C - Core Breach",
    objective: "Break the Core Tyrant cycle before meltdown.",
    introToast: "Nox: Last corridor. Burn surge on telegraphed windows."
  })
]);

const STORY_BEATS = Object.freeze([
  Object.freeze({ at: 6, key: "radio_01", tone: "neutral", message: "ARC-12: Two scout vectors approaching from lane north." }),
  Object.freeze({ at: 24, key: "radio_02", tone: "warn", message: "Helios Net: Meteor wake active. Maintain orbit discipline." }),
  Object.freeze({ at: 44, key: "radio_03", tone: "good", message: "Nox: Good chain. Hold attract and burst on contact." }),
  Object.freeze({ at: 72, key: "radio_04", tone: "warn", message: "ARC-12: Shooter wing entering lane delta. REPEL their fire." }),
  Object.freeze({ at: 96, key: "radio_05", tone: "danger", message: "Helios Net: Warden signature acquired. Brace for lock field." }),
  Object.freeze({ at: 138, key: "radio_06", tone: "warn", message: "ARC-12: Core shell cracking. Expect multi-pattern volleys." }),
  Object.freeze({ at: 168, key: "radio_07", tone: "danger", message: "Nox: Final push. Surge through the overload slam." })
]);

const WAVE_PATTERNS = Object.freeze({
  chapter_1: Object.freeze([
    Object.freeze({ lanes: [0, 3], roles: ["chaser", "chaser"] }),
    Object.freeze({ lanes: [1, 5], roles: ["chaser", "chaser"] }),
    Object.freeze({ lanes: [2, 4, 6], roles: ["chaser", "chaser", "shooter"] }),
    Object.freeze({ lanes: [7, 0], roles: ["shooter", "chaser"] })
  ]),
  chapter_2: Object.freeze([
    Object.freeze({ lanes: [0, 2, 5], roles: ["shooter", "chaser", "anchor"] }),
    Object.freeze({ lanes: [1, 4, 7], roles: ["shooter", "chaser", "shooter"] }),
    Object.freeze({ lanes: [3, 6], roles: ["anchor", "shooter"] }),
    Object.freeze({ lanes: [0, 2, 4, 6], roles: ["chaser", "shooter", "chaser", "anchor"] })
  ]),
  chapter_3: Object.freeze([
    Object.freeze({ lanes: [0, 1, 4], roles: ["berserker", "shooter", "anchor"] }),
    Object.freeze({ lanes: [2, 3, 6], roles: ["berserker", "berserker", "shooter"] }),
    Object.freeze({ lanes: [5, 7, 1, 3], roles: ["anchor", "berserker", "shooter", "berserker"] }),
    Object.freeze({ lanes: [0, 2, 4, 6], roles: ["berserker", "shooter", "berserker", "anchor"] })
  ])
});

const LANE_SPAWN_POINTS = Object.freeze([
  Object.freeze({ x: 0.5, y: -0.02 }),
  Object.freeze({ x: 1.02, y: 0.2 }),
  Object.freeze({ x: 1.02, y: 0.5 }),
  Object.freeze({ x: 1.02, y: 0.8 }),
  Object.freeze({ x: 0.5, y: 1.02 }),
  Object.freeze({ x: -0.02, y: 0.8 }),
  Object.freeze({ x: -0.02, y: 0.5 }),
  Object.freeze({ x: -0.02, y: 0.2 })
]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toRuntimePolarity(polarity) {
  if (polarity === "north") {
    return "attract";
  }
  if (polarity === "south") {
    return "repel";
  }
  return "off";
}

export class CanvasGame {
  constructor(canvas, runtime) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.runtime = runtime;

    this.vfx = new EnhancedVFX();
    this.audio = new AudioCueSystem();
    this.backgroundImage = null;
    this.backgroundImageUrl = "";
    this.enemyPortraitImage = null;
    this.enemyPortraitUrl = "";
    this.playerImage = null;
    this.playerImageUrl = "";
    this.hazardImage = null;
    this.hazardImageUrl = "";
    this.chapterBackgroundUrls = [];

    this.player = null;
    this.hazards = [];
    this.enemyProjectiles = [];

    this.paused = false;
    this.gameOver = false;

    this.keys = { left: false, right: false, forward: false, reverse: false, magnet: false };
    this.magnetPolarity = "neutral";
    this.magnetHeat = 0;
    this.magnetLocked = false;
    this.magnetLockTimer = 0;
    this.heatRatePerSecond = 36;
    this.coolRatePerSecond = 26;
    this.lockDurationSeconds = 2;
    this.surgeActive = false;
    this.surgeTimer = 0;
    this.surgeCooldown = 0;
    this.surgeDuration = 2;
    this.surgeCooldownTime = 6;
    this.surgeDamageMult = 2;
    this.lastBossPhase = 0;
    this.surgeHintAnnounced = false;

    this.score = 0;
    this.waveLabel = "1";
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.lastDamageAt = -999;
    this.lastSpawnAt = 0;
    this.wavePatternCursor = 0;
    this.storyBeatCursor = 0;
    this.chapterIndex = 0;
    this.lastAnnouncedChapter = -1;
    this.passiveHeatPerSecond = 0;
    this.lastSpawnAt = 0;
    this.wavePatternCursor = 0;
    this.storyBeatCursor = 0;
    this.chapterIndex = 0;
    this.lastAnnouncedChapter = -1;
    this.passiveHeatPerSecond = 0;

    this.miniboss = null;
    this.minibossSpawned = false;
    this.minibossDefeated = false;

    this.boss = null;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.bossPhase = 0;

    this.playerDamage = 1;
    this.magnetForceMultiplier = 1;
    this.difficulty = DEFAULT_DIFFICULTY;
    this.difficultyProfile = DIFFICULTY_PROFILES[DEFAULT_DIFFICULTY];
    this.tuningDefaults = Object.freeze({
      heatRatePerSecond: 36,
      coolRatePerSecond: 26,
      lockDurationSeconds: 2,
      surgeDuration: 2,
      surgeCooldownTime: 6
    });

    this.waitingForUpgrade = false;
    this.upgradeChoices = [];
    this.onUpgradeReady = null;

    this.setupInput();
  }

  setupInput() {
    if (typeof window === "undefined") {
      return;
    }

    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      if (key === "arrowleft" || key === "a") {
        this.keys.left = true;
        if (key === "arrowleft") {
          event.preventDefault();
        }
        return;
      }
      if (key === "arrowright" || key === "d") {
        this.keys.right = true;
        if (key === "arrowright") {
          event.preventDefault();
        }
        return;
      }
      if (key === "arrowup" || key === "w") {
        this.keys.forward = true;
        if (key === "arrowup") {
          event.preventDefault();
        }
        return;
      }
      if (key === "arrowdown" || key === "s") {
        this.keys.reverse = true;
        if (key === "arrowdown") {
          event.preventDefault();
        }
        return;
      }
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
        this.startSurge();
        event.preventDefault();
        return;
      }
      if (event.code === "Space") {
        this.keys.magnet = true;
        this.toggleMagnetPolarity();
        event.preventDefault();
      }
    });

    window.addEventListener("keyup", (event) => {
      const key = event.key.toLowerCase();
      if (key === "arrowleft" || key === "a") {
        this.keys.left = false;
        return;
      }
      if (key === "arrowright" || key === "d") {
        this.keys.right = false;
        return;
      }
      if (key === "arrowup" || key === "w") {
        this.keys.forward = false;
        return;
      }
      if (key === "arrowdown" || key === "s") {
        this.keys.reverse = false;
        return;
      }
      if (event.code === "Space") {
        this.keys.magnet = false;
      }
    });
  }

  setUpgradeHandler(handler) {
    this.onUpgradeReady = typeof handler === "function" ? handler : null;
  }

  resolveDifficultyProfile(level) {
    const normalized = String(level || DEFAULT_DIFFICULTY).toLowerCase();
    if (normalized === "casual" || normalized === "insane") {
      return {
        difficulty: normalized,
        profile: DIFFICULTY_PROFILES[normalized]
      };
    }

    return {
      difficulty: DEFAULT_DIFFICULTY,
      profile: DIFFICULTY_PROFILES[DEFAULT_DIFFICULTY]
    };
  }

  applyDifficultyTuning() {
    const profile = this.difficultyProfile || DIFFICULTY_PROFILES[DEFAULT_DIFFICULTY];
    this.heatRatePerSecond = this.tuningDefaults.heatRatePerSecond * profile.heatRateScale;
    this.coolRatePerSecond = this.tuningDefaults.coolRatePerSecond * profile.coolRateScale;
    this.lockDurationSeconds = this.tuningDefaults.lockDurationSeconds * profile.lockDurationScale;
    this.surgeDuration = profile.surgeDuration || this.tuningDefaults.surgeDuration;
    this.surgeCooldownTime = profile.surgeCooldown || this.tuningDefaults.surgeCooldownTime;
  }

  setDifficulty(level) {
    const resolved = this.resolveDifficultyProfile(level);
    this.difficulty = resolved.difficulty;
    this.difficultyProfile = resolved.profile;
    this.applyDifficultyTuning();

    if (this.player) {
      const nextMaxHp = resolved.profile.playerHp;
      this.player.maxHp = nextMaxHp;
      this.player.hp = Math.min(this.player.hp, nextMaxHp);
    }

    return this.difficulty;
  }

  loadVisualImage(url) {
    const source = String(url || "").trim();
    if (!source || typeof Image === "undefined") {
      return null;
    }

    const image = new Image();
    image.decoding = "async";
    image.src = source;
    return image;
  }

  setVisualAssets(assets = {}) {
    const backdropArt = String(assets.backdropArt || "").trim();
    const enemyArt = String(assets.enemyArt || backdropArt).trim();
    const playerArt = String(assets.playerArt || assets.titleArt || backdropArt).trim();
    const hazardArt = String(assets.enemyArt || assets.backdropArt || "").trim();
    const gallery = Array.isArray(assets.gallery)
      ? assets.gallery.map((item) => String(item || "").trim()).filter((item) => item.length > 0)
      : [];

    const deduped = [];
    for (const candidate of [backdropArt, ...gallery]) {
      if (!candidate) {
        continue;
      }
      if (!deduped.includes(candidate)) {
        deduped.push(candidate);
      }
    }
    this.chapterBackgroundUrls = deduped.slice(0, 4);

    if (backdropArt !== this.backgroundImageUrl) {
      this.backgroundImageUrl = backdropArt;
      this.backgroundImage = this.loadVisualImage(backdropArt);
    }

    if (enemyArt !== this.enemyPortraitUrl) {
      this.enemyPortraitUrl = enemyArt;
      this.enemyPortraitImage = this.loadVisualImage(enemyArt);
    }

    if (playerArt !== this.playerImageUrl) {
      this.playerImageUrl = playerArt;
      this.playerImage = this.loadVisualImage(playerArt);
    }

    if (hazardArt !== this.hazardImageUrl) {
      this.hazardImageUrl = hazardArt;
      this.hazardImage = this.loadVisualImage(hazardArt);
    }

    this.applyChapterVisualTheme(this.chapterIndex, true);
  }

  getChapterByElapsed(seconds) {
    const elapsed = Number(seconds) || 0;
    for (let index = 0; index < STORY_CHAPTERS.length; index += 1) {
      const chapter = STORY_CHAPTERS[index];
      if (elapsed >= chapter.start && elapsed < chapter.end) {
        return { chapter, index };
      }
    }
    const fallbackIndex = STORY_CHAPTERS.length - 1;
    return { chapter: STORY_CHAPTERS[fallbackIndex], index: fallbackIndex };
  }

  applyChapterVisualTheme(chapterIndex, force = false) {
    if (!Array.isArray(this.chapterBackgroundUrls) || this.chapterBackgroundUrls.length === 0) {
      return;
    }

    const normalized = Math.max(0, Number(chapterIndex) || 0);
    const selected = this.chapterBackgroundUrls[normalized % this.chapterBackgroundUrls.length];
    if (!selected) {
      return;
    }

    if (!force && selected === this.backgroundImageUrl) {
      return;
    }

    this.backgroundImageUrl = selected;
    this.backgroundImage = this.loadVisualImage(selected);
  }

  pushToast(key, message, tone = "neutral") {
    if (!this.runtime || typeof this.runtime.pushNarrativeToast !== "function") {
      return;
    }
    this.runtime.pushNarrativeToast({ key, message, tone });
  }

  setObjective(message) {
    if (!this.runtime || typeof this.runtime.setObjective !== "function") {
      return;
    }
    this.runtime.setObjective(message);
  }

  updateStoryBeats() {
    while (this.storyBeatCursor < STORY_BEATS.length) {
      const beat = STORY_BEATS[this.storyBeatCursor];
      if (this.elapsed < beat.at) {
        break;
      }

      this.pushToast(beat.key, beat.message, beat.tone);
      this.storyBeatCursor += 1;
    }
  }

  updateChapterState() {
    const state = this.getChapterByElapsed(this.elapsed);
    if (state.index === this.chapterIndex && this.lastAnnouncedChapter === state.index) {
      return;
    }

    this.chapterIndex = state.index;
    this.lastAnnouncedChapter = state.index;
    this.applyChapterVisualTheme(this.chapterIndex);
    this.setObjective(`${state.chapter.label}: ${state.chapter.objective}`);
    this.pushToast(`${state.chapter.id}_intro`, state.chapter.introToast, "warn");
  }

  init() {
    const profile = this.difficultyProfile || DIFFICULTY_PROFILES[DEFAULT_DIFFICULTY];
    this.player = new Player(this.canvas.width * 0.5, this.canvas.height * 0.5);
    this.player.maxHp = profile.playerHp;
    this.player.hp = profile.playerHp;

    this.hazards = [];
    this.enemyProjectiles = [];

    this.paused = false;
    this.gameOver = false;

    this.keys.left = false;
    this.keys.right = false;
    this.keys.forward = false;
    this.keys.reverse = false;
    this.keys.magnet = false;

    this.magnetPolarity = "neutral";
    this.magnetHeat = 0;
    this.magnetLocked = false;
    this.magnetLockTimer = 0;
    this.applyDifficultyTuning();
    this.surgeActive = false;
    this.surgeTimer = 0;
    this.surgeCooldown = 0;
    this.surgeHintAnnounced = false;

    this.score = 0;
    this.waveLabel = "1";
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.lastDamageAt = -999;

    this.miniboss = null;
    this.minibossSpawned = false;
    this.minibossDefeated = false;

    this.boss = null;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.bossPhase = 0;

    this.playerDamage = 1;
    this.magnetForceMultiplier = 1;

    this.waitingForUpgrade = false;
    this.upgradeChoices = [];

    this.vfx.screenShake = 0;
    this.vfx.shakeDuration = 0;
    this.vfx.hitFlash = 0;
    this.vfx.hitStop = 0;
    this.vfx.particles = [];
    this.vfx.shockwaves = [];

    this.audio.enable();
    this.applyChapterVisualTheme(0, true);
    this.updateChapterState();
    this.syncRuntimeState();
  }

  toggleMagnetPolarity() {
    if (this.paused || this.gameOver || this.magnetLocked) {
      return false;
    }

    if (this.magnetPolarity === "neutral") {
      this.magnetPolarity = "north";
    } else if (this.magnetPolarity === "north") {
      this.magnetPolarity = "south";
    } else {
      this.magnetPolarity = "north";
    }

    this.magnetHeat = clamp(this.magnetHeat + 5, 0, 100);
    this.audio.playCue("shoot");
    return true;
  }

  startSurge() {
    if (this.paused || this.gameOver || !this.player || this.waitingForUpgrade) {
      return false;
    }

    if (this.surgeActive || this.surgeCooldown > 0) {
      return false;
    }

    this.surgeActive = true;
    this.surgeTimer = this.surgeDuration;
    this.surgeCooldown = this.surgeCooldownTime;
    this.magnetHeat = clamp(this.magnetHeat - 20, 0, 100);
    this.player.invulnerable = Math.max(this.player.invulnerable, 0.25);

    const directionX = Math.cos(this.player.angle) || 1;
    const directionY = Math.sin(this.player.angle) || 0;
    this.player.velocity.x += directionX * 160;
    this.player.velocity.y += directionY * 160;

    this.vfx.triggerShake(8, 0.24);
    this.vfx.spawnShockwave(this.player.position.x, this.player.position.y, "#6be895", 90);
    this.vfx.spawnParticles(this.player.position.x, this.player.position.y, 18, "#6be895", 120);
    this.audio.playCue("upgrade");
    return true;
  }

  updateSurgeState(dt) {
    if (this.surgeCooldown > 0) {
      this.surgeCooldown = Math.max(0, this.surgeCooldown - dt);
    }

    if (!this.surgeActive) {
      return;
    }

    this.surgeTimer -= dt;
    this.player.invulnerable = Math.max(this.player.invulnerable, 0.08);
    this.magnetHeat = clamp(this.magnetHeat - this.coolRatePerSecond * 1.6 * dt, 0, 100);

    if (Math.random() < 0.35) {
      this.vfx.spawnParticles(this.player.position.x, this.player.position.y, 2, "#6be895", 70);
    }

    if (this.surgeTimer <= 0) {
      this.surgeActive = false;
      this.surgeTimer = 0;
    }
  }

  update(deltaSeconds) {
    if (this.paused || this.gameOver || !this.player) {
      return;
    }

    const dt = clamp(Number(deltaSeconds) || 0, 0, 0.1);
    if (dt <= 0) {
      return;
    }

    this.elapsed += dt;
    this.updateChapterState();
    this.updateStoryBeats();

    this.player.input = {
      left: this.keys.left,
      right: this.keys.right,
      boost: this.keys.forward,
      reverse: this.keys.reverse
    };
    this.player.update(dt, this.canvas.width, this.canvas.height);

    this.updateMagnetState(dt);
    this.updateSurgeState(dt);

    const canSimulate = this.vfx.update(dt);
    if (canSimulate) {
      this.updateSpawns(dt);
      this.updateHazards(dt);
      this.updateEnemyProjectiles(dt);
      this.handleProjectileCollisions();
      this.handleHazardCollisions();
    }

    this.hazards = this.hazards.filter((hazard) => hazard.active);
    this.enemyProjectiles = this.enemyProjectiles.filter((projectile) => projectile.active);
    this.updateWaveAndBossPhase();
    this.syncRuntimeState();

    if (this.player.hp <= 0) {
      this.gameOver = true;
    }
  }

  updateMagnetState(dt) {
    if (this.magnetLocked) {
      this.magnetLockTimer -= dt;
      this.magnetHeat = clamp(this.magnetHeat - this.coolRatePerSecond * dt, 0, 100);
      if (this.magnetLockTimer <= 0) {
        this.magnetLocked = false;
        this.magnetHeat = 0;
      }
      return;
    }

    if (this.keys.magnet && this.magnetPolarity !== "neutral") {
      this.magnetHeat = clamp(this.magnetHeat + this.heatRatePerSecond * dt, 0, 100);
      if (this.magnetHeat >= 100) {
        this.magnetLocked = true;
        this.magnetLockTimer = this.lockDurationSeconds;
        this.keys.magnet = false;
        this.vfx.triggerShake(6, 0.2);
        this.vfx.spawnParticles(this.player.position.x, this.player.position.y, 12, "#ff5f6d", 90);
        this.audio.playCue("overheat");
      }
    } else {
      this.magnetHeat = clamp(this.magnetHeat - this.coolRatePerSecond * dt, 0, 100);
    }
  }

  updateSpawns(dt) {
    if (!this.minibossSpawned && this.elapsed >= MINIBOSS_TIME) {
      this.minibossSpawned = true;
      this.miniboss = this.spawnSpecialHazard("miniboss");
      this.miniboss.role = "warden";
      this.hazards.push(this.miniboss);
      this.pushToast("warden_spawn", "ARC-12: Warden in lane. Break its guard with Surge.", "danger");
    }

    if (!this.bossSpawned && this.elapsed >= BOSS_TIME) {
      this.bossSpawned = true;
      this.boss = this.spawnSpecialHazard("boss");
      this.boss.role = "tyrant";
      this.hazards.push(this.boss);
      this.audio.playCue("boss_spawn");
      this.pushToast("tyrant_spawn", "Helios Net: Core Tyrant online. Pattern cycle engaged.", "danger");
    }

    if (!this.minibossDefeated && this.minibossSpawned && this.miniboss && !this.miniboss.active) {
      this.minibossDefeated = true;
      if (typeof this.runtime.triggerMinibossDefeat === "function") {
        this.runtime.triggerMinibossDefeat();
      }
      this.startUpgradeSelection();
    }

    this.spawnTimer += dt;
    const spawnInterval = this.getSpawnInterval();
    if (this.spawnTimer < spawnInterval) {
      return;
    }

    const activeBasics = this.hazards.filter((hazard) => hazard.active && hazard.type === "basic").length;
    const chapter = this.getChapterByElapsed(this.elapsed).chapter;
    const capByDifficulty = this.difficulty === "insane" ? 26 : (this.difficulty === "casual" ? 16 : 21);
    if (activeBasics >= capByDifficulty) {
      this.spawnTimer = spawnInterval * 0.5;
      return;
    }

    this.spawnTimer = 0;
    const patterns = WAVE_PATTERNS[chapter.id] || WAVE_PATTERNS.chapter_1;
    const pattern = patterns[this.wavePatternCursor % patterns.length];
    this.wavePatternCursor += 1;

    if (pattern) {
      this.spawnPattern(pattern);
    }
  }

  spawnPattern(pattern) {
    if (!pattern || !Array.isArray(pattern.roles) || pattern.roles.length === 0) {
      return;
    }

    const pairCount = Math.min(pattern.roles.length, pattern.lanes.length);
    for (let index = 0; index < pairCount; index += 1) {
      const hazard = this.spawnBasicHazard(pattern.roles[index], pattern.lanes[index]);
      if (!hazard) {
        continue;
      }
      this.hazards.push(hazard);
    }
  }

  configureHazardRole(hazard, role) {
    const scoreScale = this.difficultyProfile ? this.difficultyProfile.scoreScale : 1;
    const enemySpeedScale = this.difficultyProfile ? this.difficultyProfile.enemySpeedScale : 1;
    const normalizedRole = String(role || "chaser");

    hazard.role = normalizedRole;
    hazard.roleState = {};

    if (normalizedRole === "shooter") {
      hazard.maxHp = 2;
      hazard.hp = 2;
      hazard.radius = 12;
      hazard.scoreValue = Math.round(110 * scoreScale);
      hazard.roleState.preferredDistance = 240;
      hazard.roleState.nextShotAt = this.elapsed + 0.8 + Math.random() * 0.6;
      hazard.roleState.shotCooldown = this.difficulty === "insane" ? 1.1 : 1.4;
    } else if (normalizedRole === "anchor") {
      hazard.maxHp = 3;
      hazard.hp = 3;
      hazard.radius = 15;
      hazard.scoreValue = Math.round(150 * scoreScale);
      hazard.roleState.auraRadius = 130;
      hazard.roleState.pullForce = this.difficulty === "insane" ? 170 : 140;
    } else if (normalizedRole === "berserker") {
      hazard.maxHp = 2;
      hazard.hp = 2;
      hazard.radius = 11;
      hazard.scoreValue = Math.round(130 * scoreScale);
      hazard.roleState.nextDashAt = this.elapsed + 0.9 + Math.random() * 0.8;
      hazard.roleState.dashCooldown = 1.8;
      hazard.roleState.dashStrength = 210;
    } else {
      hazard.maxHp = 1;
      hazard.hp = 1;
      hazard.radius = 10;
      hazard.scoreValue = Math.round(75 * scoreScale);
    }

    if (this.elapsed >= 120 && normalizedRole === "chaser") {
      hazard.maxHp = 2;
      hazard.hp = 2;
      hazard.scoreValue = Math.round(95 * scoreScale);
    }

    const speedVector = Math.hypot(hazard.velocity.x, hazard.velocity.y) || 1;
    const speedMultiplier = normalizedRole === "anchor"
      ? 0.55
      : (normalizedRole === "shooter" ? 0.82 : (normalizedRole === "berserker" ? 1.28 : 1.05));
    const targetSpeed = speedVector * speedMultiplier * enemySpeedScale;
    hazard.velocity.x = (hazard.velocity.x / speedVector) * targetSpeed;
    hazard.velocity.y = (hazard.velocity.y / speedVector) * targetSpeed;
  }

  getLanePoint(laneIndex = null) {
    if (Number.isFinite(laneIndex)) {
      return LANE_SPAWN_POINTS[Math.abs(Math.floor(laneIndex)) % LANE_SPAWN_POINTS.length];
    }
    const index = Math.floor(Math.random() * LANE_SPAWN_POINTS.length);
    return LANE_SPAWN_POINTS[index];
  }

  getSpawnInterval() {
    const scale = this.difficultyProfile ? this.difficultyProfile.spawnIntervalScale : 1;
    const chapter = this.getChapterByElapsed(this.elapsed).chapter.id;
    let base = 1.2;
    if (chapter === "chapter_2") {
      base = 0.92;
    } else if (chapter === "chapter_3") {
      base = 0.72;
    }

    if (this.surgeActive) {
      base += 0.08;
    }

    return Math.max(0.28, base * scale);
  }

  spawnBasicHazard(role = "chaser", laneIndex = null) {
    if (!this.player) {
      return null;
    }

    const point = this.getLanePoint(laneIndex);
    const x = point.x * this.canvas.width;
    const y = point.y * this.canvas.height;

    const dx = this.player.position.x - x;
    const dy = this.player.position.y - y;
    const length = Math.hypot(dx, dy) || 1;
    const speedScale = this.difficultyProfile ? this.difficultyProfile.enemySpeedScale : 1;
    const speed = (70 + Math.random() * 40 + Math.min(60, this.elapsed * 0.3)) * speedScale;

    const hazard = new CombatHazard(
      x,
      y,
      (dx / length) * speed,
      (dy / length) * speed,
      "basic"
    );

    this.configureHazardRole(hazard, role);

    return hazard;
  }

  spawnSpecialHazard(type) {
    const angle = Math.random() * Math.PI * 2;
    const speedScale = this.difficultyProfile ? this.difficultyProfile.enemySpeedScale : 1;
    const speed = (type === "boss" ? 85 : 70) * speedScale;
    const spawnX = this.canvas.width * (0.3 + Math.random() * 0.4);
    const spawnY = this.canvas.height * (0.2 + Math.random() * 0.3);

    const hazard = new CombatHazard(
      spawnX,
      spawnY,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      type
    );

    if (type === "miniboss") {
      const hp = Math.round(14 * (this.difficultyProfile ? this.difficultyProfile.bossHpScale : 1));
      hazard.maxHp = Math.max(8, hp);
      hazard.hp = hazard.maxHp;
      hazard.scoreValue = Math.round(1200 * (this.difficultyProfile ? this.difficultyProfile.scoreScale : 1));
    }

    if (type === "boss") {
      const hp = Math.round(24 * (this.difficultyProfile ? this.difficultyProfile.bossHpScale : 1));
      hazard.maxHp = Math.max(16, hp);
      hazard.hp = hazard.maxHp;
      hazard.scoreValue = Math.round(3500 * (this.difficultyProfile ? this.difficultyProfile.scoreScale : 1));
    }

    return hazard;
  }

  updateHazards(dt) {
    const magnetIsActive = this.isMagnetActive();
    const isAttract = this.magnetPolarity === "north";
    this.passiveHeatPerSecond = 0;

    for (const hazard of this.hazards) {
      if (!hazard.active) {
        continue;
      }

      this.applyHazardRoleBehavior(hazard, dt);

      if (magnetIsActive) {
        const dx = this.player.position.x - hazard.position.x;
        const dy = this.player.position.y - hazard.position.y;
        const distance = Math.hypot(dx, dy) || 1;

        if (distance <= 280) {
          const directionX = dx / distance;
          const directionY = dy / distance;
          const forceBase = isAttract ? 900 : -1000;
          const force = (forceBase * this.magnetForceMultiplier) / Math.max(80, distance);

          hazard.velocity.x += directionX * force * dt;
          hazard.velocity.y += directionY * force * dt;
        }
      }

      const maxSpeed = hazard.type === "boss"
        ? 190
        : (hazard.role === "berserker" ? 220 : (hazard.role === "anchor" ? 120 : 165));
      const speed = Math.hypot(hazard.velocity.x, hazard.velocity.y);
      if (speed > maxSpeed) {
        const ratio = maxSpeed / speed;
        hazard.velocity.x *= ratio;
        hazard.velocity.y *= ratio;
      }

      hazard.update(dt, this.canvas.width, this.canvas.height);
    }

    if (!this.magnetLocked && this.passiveHeatPerSecond > 0) {
      this.magnetHeat = clamp(this.magnetHeat + this.passiveHeatPerSecond * dt, 0, 100);
    }
  }

  applyHazardRoleBehavior(hazard, dt) {
    if (!hazard || !hazard.active || !hazard.role) {
      return;
    }

    const dx = this.player.position.x - hazard.position.x;
    const dy = this.player.position.y - hazard.position.y;
    const distance = Math.hypot(dx, dy) || 1;
    const nx = dx / distance;
    const ny = dy / distance;

    if (hazard.role === "shooter") {
      const desired = hazard.roleState?.preferredDistance || 240;
      const correction = distance > desired ? 50 : -42;
      hazard.velocity.x += nx * correction * dt;
      hazard.velocity.y += ny * correction * dt;

      const nextShotAt = hazard.roleState?.nextShotAt || 0;
      if (this.elapsed >= nextShotAt) {
        this.spawnEnemyProjectile(hazard);
        const cooldown = hazard.roleState?.shotCooldown || 1.4;
        hazard.roleState.nextShotAt = this.elapsed + cooldown + Math.random() * 0.35;
      }
      return;
    }

    if (hazard.role === "anchor") {
      const pullForce = hazard.roleState?.pullForce || 140;
      const auraRadius = hazard.roleState?.auraRadius || 130;
      if (distance <= auraRadius) {
        this.player.velocity.x -= nx * pullForce * dt * 0.45;
        this.player.velocity.y -= ny * pullForce * dt * 0.45;
        this.passiveHeatPerSecond += 14;
      }
      hazard.velocity.x += nx * 20 * dt;
      hazard.velocity.y += ny * 20 * dt;
      return;
    }

    if (hazard.role === "berserker") {
      const nextDashAt = hazard.roleState?.nextDashAt || 0;
      if (this.elapsed >= nextDashAt) {
        const strength = hazard.roleState?.dashStrength || 210;
        hazard.velocity.x += nx * strength;
        hazard.velocity.y += ny * strength;
        hazard.roleState.nextDashAt = this.elapsed + (hazard.roleState?.dashCooldown || 1.8);
      } else {
        hazard.velocity.x += nx * 58 * dt;
        hazard.velocity.y += ny * 58 * dt;
      }
      return;
    }

    if (hazard.role === "warden" || hazard.role === "tyrant") {
      const pulseStrength = hazard.role === "tyrant" ? 52 : 34;
      hazard.velocity.x += nx * pulseStrength * dt;
      hazard.velocity.y += ny * pulseStrength * dt;
      if (distance <= 170) {
        this.passiveHeatPerSecond += hazard.role === "tyrant" ? 12 : 8;
      }
      return;
    }

    // default chaser behavior
    hazard.velocity.x += nx * 52 * dt;
    hazard.velocity.y += ny * 52 * dt;
  }

  spawnEnemyProjectile(hazard) {
    if (!hazard || !hazard.active) {
      return;
    }

    const dx = this.player.position.x - hazard.position.x;
    const dy = this.player.position.y - hazard.position.y;
    const distance = Math.hypot(dx, dy) || 1;
    const speed = this.difficulty === "insane" ? 230 : 200;

    this.enemyProjectiles.push({
      position: { x: hazard.position.x, y: hazard.position.y },
      velocity: { x: (dx / distance) * speed, y: (dy / distance) * speed },
      radius: 4,
      ttl: 2.4,
      active: true
    });
    this.audio.playCue("shoot");
  }

  updateEnemyProjectiles(dt) {
    for (const projectile of this.enemyProjectiles) {
      if (!projectile.active) {
        continue;
      }

      projectile.ttl -= dt;
      projectile.position.x += projectile.velocity.x * dt;
      projectile.position.y += projectile.velocity.y * dt;

      if (
        projectile.ttl <= 0 ||
        projectile.position.x < -24 ||
        projectile.position.x > this.canvas.width + 24 ||
        projectile.position.y < -24 ||
        projectile.position.y > this.canvas.height + 24
      ) {
        projectile.active = false;
      }
    }
  }

  handleProjectileCollisions() {
    if (!this.player) {
      return;
    }

    const repelActive = this.isMagnetActive() && this.magnetPolarity === "south";
    for (const projectile of this.enemyProjectiles) {
      if (!projectile.active) {
        continue;
      }

      const dx = projectile.position.x - this.player.position.x;
      const dy = projectile.position.y - this.player.position.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance > this.player.radius + projectile.radius) {
        continue;
      }

      if (this.surgeActive || repelActive) {
        projectile.active = false;
        const reward = this.surgeActive ? 24 : 12;
        this.score += reward;
        if (typeof this.runtime.addScore === "function") {
          this.runtime.addScore(reward);
        }
        this.vfx.spawnParticles(projectile.position.x, projectile.position.y, 5, "#65e0ff", 90);
        this.audio.playCue("hit");
        continue;
      }

      projectile.active = false;
      this.damagePlayer(this.elapsed);
    }
  }

  handleHazardCollisions() {
    const now = this.elapsed;
    const magnetIsActive = this.isMagnetActive();
    const attractMode = magnetIsActive && this.magnetPolarity === "north";
    const surgeImpact = this.surgeActive;

    for (const hazard of this.hazards) {
      if (!hazard.active) {
        continue;
      }

      const distance = this.player.position.distance(hazard.position);
      if (distance > this.player.radius + hazard.radius) {
        continue;
      }

      if (attractMode || surgeImpact) {
        const baseDamage = this.playerDamage * (surgeImpact ? this.surgeDamageMult : 1);
        const polarity = this.magnetPolarity === "neutral" ? hazard.polarity : this.magnetPolarity;
        const wasDestroyed = hazard.takeDamage(baseDamage, polarity);
        this.vfx.triggerHitStop(hazard.type === "boss" ? 0.1 : 0.06);
        this.vfx.triggerShake(hazard.type === "boss" ? 7 : 4, 0.18);
        this.vfx.spawnParticles(
          hazard.position.x,
          hazard.position.y,
          hazard.type === "boss" ? 22 : 12,
          surgeImpact ? "#6be895" : (hazard.polarity === "north" ? "#ff5f6d" : "#65e0ff"),
          surgeImpact ? 120 : 95
        );

        this.audio.playCue(wasDestroyed ? "destroy" : "hit");

        if (wasDestroyed) {
          this.onHazardDefeated(hazard);
          continue;
        }

        const knockX = (hazard.position.x - this.player.position.x) || 1;
        const knockY = (hazard.position.y - this.player.position.y) || 1;
        const length = Math.hypot(knockX, knockY) || 1;
        const knockback = surgeImpact ? 180 : 110;
        hazard.velocity.x += (knockX / length) * knockback;
        hazard.velocity.y += (knockY / length) * knockback;
        continue;
      }

      if (magnetIsActive && this.magnetPolarity === "south") {
        const knockX = (hazard.position.x - this.player.position.x) || 1;
        const knockY = (hazard.position.y - this.player.position.y) || 1;
        const length = Math.hypot(knockX, knockY) || 1;
        hazard.velocity.x += (knockX / length) * 180;
        hazard.velocity.y += (knockY / length) * 180;
        this.vfx.spawnParticles(hazard.position.x, hazard.position.y, 6, "#65e0ff", 80);
        this.audio.playCue("shoot");
        continue;
      }

      this.damagePlayer(now);
    }
  }

  onHazardDefeated(hazard) {
    const surgeBonus = this.surgeActive ? 1.2 : 1;
    const scoreValue = Math.round(hazard.scoreValue * surgeBonus);
    this.score += scoreValue;
    if (typeof this.runtime.addScore === "function") {
      this.runtime.addScore(scoreValue);
    }

    if (hazard === this.boss) {
      this.bossDefeated = true;
      this.gameOver = true;
      if (typeof this.runtime.triggerBossDefeat === "function") {
        this.runtime.triggerBossDefeat();
      }
    }
  }

  damagePlayer(now) {
    if (!this.player || this.player.invulnerable > 0 || this.surgeActive) {
      return;
    }

    if (now - this.lastDamageAt < 0.25) {
      return;
    }

    this.lastDamageAt = now;
    this.player.hp = Math.max(0, this.player.hp - 1);
    this.player.invulnerable = 1;

    this.vfx.triggerShake(4, 0.24);
    this.vfx.triggerHitFlash(0.12);
    this.vfx.spawnParticles(this.player.position.x, this.player.position.y, 8, "#ff5f6d", 80);
    this.audio.playCue("damage");

    if (typeof this.runtime.takeDamage === "function") {
      this.runtime.takeDamage();
    }

    if (this.player.hp <= 0) {
      this.gameOver = true;
    }
  }

  startUpgradeSelection() {
    if (this.waitingForUpgrade || this.upgradeChoices.length > 0) {
      return;
    }

    this.waitingForUpgrade = true;
    this.upgradeChoices = this.rollUpgradeChoices(3);
    this.setPaused(true);

    if (typeof this.onUpgradeReady === "function") {
      this.onUpgradeReady(this.upgradeChoices.slice());
    }
  }

  rollUpgradeChoices(count) {
    const pool = UPGRADE_POOL.filter((choice) => UPGRADE_TYPES.has(choice.type));
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const current = pool[index];
      pool[index] = pool[swapIndex];
      pool[swapIndex] = current;
    }
    return pool.slice(0, Math.max(1, count));
  }

  resolveUpgrade(choiceId) {
    if (!this.waitingForUpgrade) {
      return false;
    }

    const selected = this.upgradeChoices.find((choice) => choice.id === choiceId) || this.upgradeChoices[0];
    if (!selected) {
      this.waitingForUpgrade = false;
      this.setPaused(false);
      return false;
    }

    this.applyUpgrade(selected);
    this.waitingForUpgrade = false;
    this.upgradeChoices = [];
    this.setPaused(false);

    if (typeof this.runtime.selectUpgrade === "function") {
      this.runtime.selectUpgrade(selected.id);
    }

    return true;
  }

  applyUpgrade(choice) {
    if (!this.player) {
      return;
    }

    if (choice.type === "damage") {
      this.playerDamage += Number(choice.value) || 0;
    } else if (choice.type === "magnet") {
      this.magnetForceMultiplier += Number(choice.value) || 0;
    } else if (choice.type === "cooldown") {
      this.coolRatePerSecond += 6;
    } else if (choice.type === "overheat") {
      const boost = Math.max(8, Number(choice.value) || 0);
      this.magnetHeat = Math.max(0, this.magnetHeat - boost);
      this.lockDurationSeconds = Math.max(1, this.lockDurationSeconds - 0.2);
    } else if (choice.type === "heat_per_shot") {
      this.heatRatePerSecond = Math.max(16, this.heatRatePerSecond - 4);
      this.surgeCooldownTime = Math.max(4, this.surgeCooldownTime - 0.2);
    } else if (choice.type === "health") {
      const delta = Math.max(1, Number(choice.value) || 1);
      this.player.maxHp = Math.min(5, this.player.maxHp + delta);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + delta);
    }

    this.vfx.spawnParticles(this.player.position.x, this.player.position.y, 14, "#6be895", 90);
    this.vfx.spawnShockwave(this.player.position.x, this.player.position.y, "#6be895", 70);
    this.audio.playCue("upgrade");
  }

  updateWaveAndBossPhase() {
    if (this.boss && this.boss.active) {
      const ratio = this.boss.hp / this.boss.maxHp;
      if (ratio <= 0.3) {
        this.bossPhase = 3;
      } else if (ratio <= 0.7) {
        this.bossPhase = 2;
      } else {
        this.bossPhase = 1;
      }
    } else {
      this.bossPhase = 0;
    }

    if (this.bossSpawned && !this.bossDefeated) {
      this.waveLabel = "BOSS";
      return;
    }

    if (this.minibossSpawned && !this.minibossDefeated) {
      this.waveLabel = "MINIBOSS";
      return;
    }

    const chapter = this.getChapterByElapsed(this.elapsed).chapter.id;
    const shooters = this.hazards.filter((hazard) => hazard.active && hazard.role === "shooter").length;
    const anchors = this.hazards.filter((hazard) => hazard.active && hazard.role === "anchor").length;
    const berserkers = this.hazards.filter((hazard) => hazard.active && hazard.role === "berserker").length;

    if (chapter === "chapter_1") {
      this.waveLabel = `A-${Math.min(4, Math.max(1, Math.floor(this.elapsed / 14) + 1))}`;
    } else if (chapter === "chapter_2") {
      this.waveLabel = `B S${shooters}/A${anchors}`;
    } else {
      this.waveLabel = `C B${berserkers}/S${shooters}`;
    }
  }

  isMagnetActive() {
    return this.keys.magnet && !this.magnetLocked && this.magnetPolarity !== "neutral";
  }

  getCombatSnapshot() {
    const polarityClass = this.magnetLocked
      ? "locked"
      : (this.magnetPolarity === "north" ? "attract" : (this.magnetPolarity === "south" ? "repel" : ""));

    const polarityLabel = this.magnetLocked
      ? "LOCKED"
      : (this.magnetPolarity === "north" ? "ATTRACT" : (this.magnetPolarity === "south" ? "REPEL" : "OFF"));

    return {
      hp: this.player ? this.player.hp : 0,
      score: Math.round(this.score),
      wave: this.waveLabel,
      chapter: STORY_CHAPTERS[this.chapterIndex]?.label || "",
      overheat: this.magnetHeat,
      overheatPercent: Math.round(this.magnetHeat),
      polarity: this.magnetPolarity,
      polarityLabel,
      polarityClass,
      magnetActive: this.isMagnetActive(),
      overheatLocked: this.magnetLocked,
      surgeActive: this.surgeActive,
      surgeCooldown: this.surgeCooldown,
      bossPhase: this.bossPhase,
      minibossDefeated: this.minibossDefeated,
      bossDefeated: this.bossDefeated,
      difficulty: this.difficulty
    };
  }

  syncRuntimeState() {
    if (!this.runtime || typeof this.runtime.syncCombatState !== "function" || !this.player) {
      return;
    }

    const state = this.getCombatSnapshot();
    this.runtime.syncCombatState({
      hp: this.player.hp,
      score: state.score,
      wave: state.wave,
      heat: state.overheat,
      polarity: toRuntimePolarity(state.polarity),
      magnetActive: state.magnetActive,
      overheatLocked: state.overheatLocked,
      surgeActive: state.surgeActive,
      surgeCooldown: state.surgeCooldown,
      bossPhase: state.bossPhase,
      minibossDefeated: state.minibossDefeated,
      bossDefeated: state.bossDefeated
    });
  }

  draw() {
    if (!this.player) {
      return;
    }

    const shakeOffset = this.vfx.getShakeOffset();
    this.vfx.drawBackground(this.ctx, shakeOffset);
    this.drawBackdropImage(shakeOffset);
    this.drawLaneGuides(shakeOffset);

    this.drawMagnetAura(shakeOffset);
    this.drawSurgeAura(shakeOffset);

    for (const hazard of this.hazards) {
      hazard.draw(this.ctx, shakeOffset);
    }
    this.drawEnemyProjectiles(shakeOffset);
    this.drawHazardSkinOverlay(shakeOffset);

    this.player.draw(this.ctx, shakeOffset);
    this.drawPlayerSkin(shakeOffset);
    this.vfx.draw(this.ctx, shakeOffset);
    this.drawEncounterBars();
    this.drawEncounterPortrait();

    if (this.paused) {
      this.ctx.fillStyle = "rgba(11, 19, 34, 0.72)";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.fillStyle = "#f4f7ff";
      this.ctx.font = "bold 24px sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.fillText("PAUSED", this.canvas.width / 2, this.canvas.height / 2);
      this.ctx.font = "14px sans-serif";
      this.ctx.fillText("Press P to resume", this.canvas.width / 2, this.canvas.height / 2 + 28);
    }
  }

  drawLaneGuides(shakeOffset) {
    const chapter = STORY_CHAPTERS[this.chapterIndex]?.id || "chapter_1";
    const centerX = this.canvas.width * 0.5 + shakeOffset.x * 0.2;
    const centerY = this.canvas.height * 0.5 + shakeOffset.y * 0.2;
    const color = chapter === "chapter_3" ? "rgba(255,95,109,0.18)" : (chapter === "chapter_2" ? "rgba(246,187,60,0.16)" : "rgba(101,224,255,0.14)");

    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1.4;
    this.ctx.setLineDash([8, 9]);
    for (let ring = 0; ring < 3; ring += 1) {
      const radius = 92 + ring * 66;
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    this.ctx.setLineDash([]);
    this.ctx.restore();
  }

  drawMagnetAura(shakeOffset) {
    if (!this.isMagnetActive()) {
      return;
    }

    const color = this.magnetPolarity === "north" ? "#65e0ff" : "#ff5f6d";
    const radius = this.magnetPolarity === "north" ? 54 : 44;

    this.ctx.strokeStyle = `${color}90`;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(
      this.player.position.x + shakeOffset.x,
      this.player.position.y + shakeOffset.y,
      radius,
      0,
      Math.PI * 2
    );
    this.ctx.stroke();
  }

  drawSurgeAura(shakeOffset) {
    if (!this.surgeActive || !this.player) {
      return;
    }

    const pulse = 1 + Math.sin(this.elapsed * 14) * 0.12;
    const radius = 34 * pulse;

    this.ctx.save();
    this.ctx.strokeStyle = "rgba(107, 232, 149, 0.85)";
    this.ctx.lineWidth = 2.5;
    this.ctx.beginPath();
    this.ctx.arc(
      this.player.position.x + shakeOffset.x,
      this.player.position.y + shakeOffset.y,
      radius,
      0,
      Math.PI * 2
    );
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawEnemyProjectiles(shakeOffset) {
    if (!Array.isArray(this.enemyProjectiles) || this.enemyProjectiles.length === 0) {
      return;
    }

    this.ctx.save();
    for (const projectile of this.enemyProjectiles) {
      if (!projectile.active) {
        continue;
      }

      const x = projectile.position.x + shakeOffset.x;
      const y = projectile.position.y + shakeOffset.y;
      this.ctx.fillStyle = "#f6bb3c";
      this.ctx.beginPath();
      this.ctx.arc(x, y, projectile.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = "rgba(246, 187, 60, 0.35)";
      this.ctx.beginPath();
      this.ctx.arc(x, y, projectile.radius * 2.5, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  drawHazardSkinOverlay(shakeOffset) {
    if (!this.hazardImage || !this.hazardImage.complete || this.hazardImage.naturalWidth <= 0) {
      return;
    }

    this.ctx.save();
    this.ctx.globalAlpha = this.surgeActive ? 0.28 : 0.18;
    for (const hazard of this.hazards) {
      if (!hazard.active) {
        continue;
      }
      const size = hazard.radius * 2.2;
      this.ctx.drawImage(
        this.hazardImage,
        hazard.position.x + shakeOffset.x - size * 0.5,
        hazard.position.y + shakeOffset.y - size * 0.5,
        size,
        size
      );
    }
    this.ctx.restore();
  }

  drawPlayerSkin(shakeOffset) {
    if (!this.player || !this.playerImage || !this.playerImage.complete || this.playerImage.naturalWidth <= 0) {
      return;
    }

    const radius = this.player.radius * 1.25;
    const x = this.player.position.x + shakeOffset.x;
    const y = this.player.position.y + shakeOffset.y;

    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(this.player.angle);
    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
    this.ctx.clip();
    this.ctx.globalAlpha = 0.85;
    this.ctx.drawImage(this.playerImage, -radius, -radius, radius * 2, radius * 2);
    this.ctx.restore();
  }

  drawBackdropImage(shakeOffset) {
    if (!this.backgroundImage || !this.backgroundImage.complete || this.backgroundImage.naturalWidth <= 0) {
      return;
    }

    const image = this.backgroundImage;
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    const scale = Math.max(canvasWidth / image.naturalWidth, canvasHeight / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const drawX = (canvasWidth - drawWidth) * 0.5 + shakeOffset.x * 0.35;
    const drawY = (canvasHeight - drawHeight) * 0.5 + shakeOffset.y * 0.35;

    this.ctx.save();
    this.ctx.globalAlpha = 0.2;
    this.ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

    const vignette = this.ctx.createRadialGradient(
      canvasWidth * 0.5,
      canvasHeight * 0.5,
      canvasHeight * 0.08,
      canvasWidth * 0.5,
      canvasHeight * 0.5,
      Math.max(canvasWidth, canvasHeight) * 0.7
    );
    vignette.addColorStop(0, "rgba(11, 19, 34, 0)");
    vignette.addColorStop(1, "rgba(11, 19, 34, 0.8)");
    this.ctx.fillStyle = vignette;
    this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    this.ctx.restore();
  }

  drawEncounterPortrait() {
    if (!this.enemyPortraitImage || !this.enemyPortraitImage.complete || this.enemyPortraitImage.naturalWidth <= 0) {
      return;
    }

    const minibossActive = Boolean(this.miniboss && this.miniboss.active && !this.minibossDefeated);
    const bossActive = Boolean(this.boss && this.boss.active && !this.bossDefeated);
    if (!minibossActive && !bossActive) {
      return;
    }

    const panelWidth = 110;
    const panelHeight = 72;
    const x = this.canvas.width - panelWidth - 14;
    const y = bossActive ? 52 : 18;
    const label = bossActive ? `BOSS P${Math.max(1, this.bossPhase)}` : "MINIBOSS";
    const borderColor = bossActive ? "#ff5f6d" : "#f6bb3c";

    this.ctx.save();
    this.ctx.fillStyle = "rgba(8, 14, 27, 0.82)";
    this.ctx.fillRect(x, y, panelWidth, panelHeight);

    this.ctx.drawImage(this.enemyPortraitImage, x + 3, y + 3, panelWidth - 6, panelHeight - 24);

    this.ctx.strokeStyle = borderColor;
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, panelWidth, panelHeight);

    this.ctx.fillStyle = "#f4f7ff";
    this.ctx.font = "bold 11px sans-serif";
    this.ctx.textAlign = "left";
    this.ctx.fillText(label, x + 6, y + panelHeight - 8);
    this.ctx.restore();
  }

  drawEncounterBars() {
    if (this.miniboss && this.miniboss.active && !this.minibossDefeated) {
      const progress = clamp(this.miniboss.hp / this.miniboss.maxHp, 0, 1);
      this.drawBar("MINIBOSS", progress, "#f6bb3c", 10);
    }

    if (this.boss && this.boss.active && !this.bossDefeated) {
      const progress = clamp(this.boss.hp / this.boss.maxHp, 0, 1);
      this.drawBar(`BOSS P${Math.max(1, this.bossPhase)}`, progress, "#ff5f6d", 34);
    }
  }

  drawBar(label, progress, color, y) {
    const x = 16;
    const width = this.canvas.width - 32;
    const height = 12;

    this.ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    this.ctx.fillRect(x, y, width, height);

    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, width * progress, height);

    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    this.ctx.strokeRect(x, y, width, height);

    this.ctx.fillStyle = "#f4f7ff";
    this.ctx.font = "10px sans-serif";
    this.ctx.textAlign = "left";
    this.ctx.fillText(label, x + 4, y - 3);
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    if (this.paused) {
      this.keys.magnet = false;
    }
  }

  getPlayerState() {
    if (!this.player) {
      return null;
    }

    return {
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      carryCount: 0,
      carryValue: 0,
      position: {
        x: this.player.position.x,
        y: this.player.position.y
      }
    };
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;

    if (this.player) {
      this.player.position.x = Math.min(this.player.position.x, width - 20);
      this.player.position.y = Math.min(this.player.position.y, height - 20);
    }
  }
}
