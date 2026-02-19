import { Player, DepositZone } from "./entities.mjs";
import { PhysicsSystem, CollisionSystem, SpawnSystem, VFXSystem } from "./systems.mjs";

export class CanvasGame {
  constructor(canvas, runtime) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.runtime = runtime;
    
    this.physics = new PhysicsSystem();
    this.collision = new CollisionSystem();
    this.spawner = new SpawnSystem(canvas.width, canvas.height);
    this.vfx = new VFXSystem();
    
    this.player = null;
    this.depositZone = null;
    this.debris = [];
    this.hazards = [];
    
    this.paused = false;
    this.gameOver = false;
    
    this.keys = { left: false, right: false, boost: false };
    this.setupInput();
  }

  setupInput() {
    const keyMap = {
      "arrowleft": "left",
      "arrowright": "right", 
      "a": "left",
      "d": "right",
      " ": "boost"
    };

    window.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();
      if (keyMap[key] && !e.repeat) {
        this.keys[keyMap[key]] = true;
        if (key === " ") e.preventDefault();
      }
    });

    window.addEventListener("keyup", (e) => {
      const key = e.key.toLowerCase();
      if (keyMap[key]) {
        this.keys[keyMap[key]] = false;
      }
    });
  }

  init() {
    this.player = new Player(this.canvas.width / 2, this.canvas.height / 2);
    this.depositZone = new DepositZone(this.canvas.width * 0.8, this.canvas.height * 0.2);
    this.debris = [];
    this.hazards = [];
    this.paused = false;
    this.gameOver = false;
    this.vfx.screenShake = 0;
    this.vfx.hitFlash = 0;
    this.vfx.particles = [];
    
    for (let i = 0; i < 5; i++) {
      const d = this.spawner.spawnDebris(this.depositZone);
      if (d) this.debris.push(d);
    }
  }

  update(deltaSeconds) {
    if (this.paused || this.gameOver || !this.player) return;

    this.player.input = { ...this.keys };
    this.physics.update([this.player, ...this.debris, ...this.hazards, this.depositZone], deltaSeconds, this.canvas.width, this.canvas.height);

    const collected = this.collision.checkPlayerDebris(this.player, this.debris);
    for (const d of collected) {
      this.player.carryCount++;
      this.player.carryValue += d.value;
      this.runtime.collectScrap({ value: d.value });
      this.vfx.spawnParticles(d.position.x, d.position.y, 4, "#f6bb3c");
    }

    const hitHazard = this.collision.checkPlayerHazards(this.player, this.hazards);
    if (hitHazard) {
      hitHazard.active = false;
      this.player.hp--;
      this.player.invulnerable = 1.5;
      this.vfx.triggerShake(10, 0.3);
      this.vfx.triggerHitFlash(0.2);
      this.vfx.spawnParticles(this.player.position.x, this.player.position.y, 8, "#ff5f6d");
      this.runtime.takeDamage();
      
      if (this.player.hp <= 0) {
        this.gameOver = true;
      }
    }

    this.spawner.update(deltaSeconds, this.debris, this.hazards, this.depositZone);
    this.vfx.update(deltaSeconds);

    if (this.depositZone.contains(this.player.position)) {
      if (this.player.carryCount > 0) {
        this.vfx.spawnParticles(this.player.position.x, this.player.position.y, 6, "#6be895");
      }
    }
  }

  draw() {
    if (!this.player) return;

    const shakeOffset = this.vfx.getShakeOffset();
    
    this.vfx.drawBackground(this.ctx, shakeOffset);
    
    this.depositZone.draw(this.ctx, shakeOffset, this.player ? this.player.position : null);
    
    for (const d of this.debris) {
      d.draw(this.ctx, shakeOffset);
    }
    
    for (const h of this.hazards) {
      h.draw(this.ctx, shakeOffset);
    }
    
    this.player.draw(this.ctx, shakeOffset);
    
    this.vfx.draw(this.ctx, shakeOffset);

    if (this.paused) {
      this.ctx.fillStyle = "rgba(11, 19, 34, 0.8)";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.fillStyle = "#f4f7ff";
      this.ctx.font = "bold 24px sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.fillText("PAUSED", this.canvas.width / 2, this.canvas.height / 2);
      this.ctx.font = "14px sans-serif";
      this.ctx.fillText("Press P to resume", this.canvas.width / 2, this.canvas.height / 2 + 30);
    }
  }

  setPaused(paused) {
    this.paused = paused;
  }

  togglePause() {
    this.paused = !this.paused;
    return this.paused;
  }

  deposit() {
    if (this.player && this.depositZone.contains(this.player.position)) {
      this.runtime.depositCarry();
      this.player.carryCount = 0;
      this.player.carryValue = 0;
      this.vfx.spawnParticles(this.player.position.x, this.player.position.y, 8, "#6be895");
      return true;
    }
    return false;
  }

  forceDeposit() {
    if (this.player && this.player.carryCount > 0) {
      this.runtime.depositCarry();
      this.player.carryCount = 0;
      this.player.carryValue = 0;
      return true;
    }
    return false;
  }

  forceDamage() {
    if (this.player && this.player.hp > 0) {
      this.player.hp--;
      this.player.invulnerable = 1.5;
      this.vfx.triggerShake(10, 0.3);
      this.vfx.triggerHitFlash(0.2);
      this.vfx.spawnParticles(this.player.position.x, this.player.position.y, 8, "#ff5f6d");
      this.runtime.takeDamage();
      if (this.player.hp <= 0) {
        this.gameOver = true;
      }
      return true;
    }
    return false;
  }

  setPhase(phase) {
    this.spawner.setPhase(phase);
  }

  getPlayerState() {
    if (!this.player) return null;
    return {
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      carryCount: this.player.carryCount,
      position: { x: this.player.position.x, y: this.player.position.y }
    };
  }

  isInDepositZone() {
    return this.player && this.depositZone && this.depositZone.contains(this.player.position);
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    if (this.spawner) {
      this.spawner.canvasWidth = width;
      this.spawner.canvasHeight = height;
    }
    if (this.depositZone) {
      this.depositZone.position.x = Math.min(this.depositZone.position.x, width - 60);
      this.depositZone.position.y = Math.min(this.depositZone.position.y, height - 60);
    }
    if (this.player) {
      this.player.position.x = Math.min(this.player.position.x, width - 20);
      this.player.position.y = Math.min(this.player.position.y, height - 20);
    }
  }
}
