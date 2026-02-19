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

    this.player = null;
    this.hazards = [];

    this.paused = false;
    this.gameOver = false;

    this.keys = { left: false, right: false, magnet: false };
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
        return;
      }
      if (key === "arrowright" || key === "d") {
        this.keys.right = true;
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
  }

  init() {
    const profile = this.difficultyProfile || DIFFICULTY_PROFILES[DEFAULT_DIFFICULTY];
    this.player = new Player(this.canvas.width * 0.5, this.canvas.height * 0.5);
    this.player.maxHp = profile.playerHp;
    this.player.hp = profile.playerHp;

    this.hazards = [];

    this.paused = false;
    this.gameOver = false;

    this.keys.left = false;
    this.keys.right = false;
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

    this.player.input = {
      left: this.keys.left,
      right: this.keys.right,
      boost: false
    };
    this.player.update(dt, this.canvas.width, this.canvas.height);

    this.updateMagnetState(dt);
    this.updateSurgeState(dt);

    const canSimulate = this.vfx.update(dt);
    if (canSimulate) {
      this.updateSpawns(dt);
      this.updateHazards(dt);
      this.handleHazardCollisions();
    }

    this.hazards = this.hazards.filter((hazard) => hazard.active);
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
      this.hazards.push(this.miniboss);
    }

    if (!this.bossSpawned && this.elapsed >= BOSS_TIME) {
      this.bossSpawned = true;
      this.boss = this.spawnSpecialHazard("boss");
      this.hazards.push(this.boss);
      this.audio.playCue("boss_spawn");
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
    const basicCap = this.difficulty === "insane" ? 22 : (this.difficulty === "casual" ? 14 : 18);
    if (activeBasics >= basicCap) {
      this.spawnTimer = spawnInterval * 0.5;
      return;
    }

    this.spawnTimer = 0;
    this.hazards.push(this.spawnBasicHazard());

    const extraChanceBase = this.elapsed >= 120 ? 0.35 : 0.15;
    const extraChance = this.difficulty === "insane"
      ? Math.min(0.65, extraChanceBase + 0.1)
      : (this.difficulty === "casual" ? Math.max(0.05, extraChanceBase - 0.07) : extraChanceBase);
    const extraCap = this.difficulty === "insane" ? 18 : (this.difficulty === "casual" ? 10 : 14);
    if (activeBasics < extraCap && Math.random() < extraChance) {
      this.hazards.push(this.spawnBasicHazard());
    }
  }

  getSpawnInterval() {
    const scale = this.difficultyProfile ? this.difficultyProfile.spawnIntervalScale : 1;
    let base = 1.25;
    if (this.elapsed < 45) {
      base = 1.25;
    } else if (this.elapsed < 90) {
      base = 1;
    } else if (this.elapsed < 120) {
      base = 0.9;
    } else if (this.elapsed < 165) {
      base = 0.75;
    } else {
      base = 0.68;
    }
    return Math.max(0.32, base * scale);
  }

  spawnBasicHazard() {
    const margin = 30;
    const side = Math.floor(Math.random() * 4);

    let x = 0;
    let y = 0;
    if (side === 0) {
      x = margin + Math.random() * (this.canvas.width - margin * 2);
      y = -20;
    } else if (side === 1) {
      x = this.canvas.width + 20;
      y = margin + Math.random() * (this.canvas.height - margin * 2);
    } else if (side === 2) {
      x = margin + Math.random() * (this.canvas.width - margin * 2);
      y = this.canvas.height + 20;
    } else {
      x = -20;
      y = margin + Math.random() * (this.canvas.height - margin * 2);
    }

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

    if (this.elapsed >= 120) {
      hazard.maxHp = 2;
      hazard.hp = 2;
      hazard.scoreValue = Math.round(80 * (this.difficultyProfile ? this.difficultyProfile.scoreScale : 1));
    }

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

    for (const hazard of this.hazards) {
      if (!hazard.active) {
        continue;
      }

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

      const maxSpeed = hazard.type === "boss" ? 180 : 150;
      const speed = Math.hypot(hazard.velocity.x, hazard.velocity.y);
      if (speed > maxSpeed) {
        const ratio = maxSpeed / speed;
        hazard.velocity.x *= ratio;
        hazard.velocity.y *= ratio;
      }

      hazard.update(dt, this.canvas.width, this.canvas.height);
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

    if (this.elapsed < 45) {
      this.waveLabel = "1";
    } else if (this.elapsed < 90) {
      this.waveLabel = "2";
    } else if (this.elapsed < 120) {
      this.waveLabel = "3";
    } else if (this.elapsed < 165) {
      this.waveLabel = "4";
    } else {
      this.waveLabel = "BOSS";
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

    this.drawMagnetAura(shakeOffset);
    this.drawSurgeAura(shakeOffset);

    for (const hazard of this.hazards) {
      hazard.draw(this.ctx, shakeOffset);
    }
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
