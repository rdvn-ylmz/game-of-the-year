import { Debris, Hazard } from "./entities.mjs";

export class PhysicsSystem {
  update(entities, deltaSeconds, canvasWidth, canvasHeight) {
    for (const entity of entities) {
      if (entity.update) {
        entity.update(deltaSeconds, canvasWidth, canvasHeight);
      }
    }
  }
}

export class CollisionSystem {
  checkPlayerDebris(player, debrisList) {
    const collected = [];
    for (const debris of debrisList) {
      if (!debris.collected && player.position.distance(debris.position) <= player.radius + debris.radius + 5) {
        debris.collected = true;
        collected.push(debris);
      }
    }
    return collected;
  }

  checkPlayerHazards(player, hazards) {
    if (player.invulnerable > 0) return null;
    
    for (const hazard of hazards) {
      if (!hazard.active) continue;
      if (player.position.distance(hazard.position) <= player.radius + hazard.radius) {
        return hazard;
      }
    }
    return null;
  }
}

export class SpawnSystem {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.debrisTimer = 0;
    this.debrisInterval = 2;
    this.hazardTimer = 0;
    this.hazardInterval = 3;
    this.maxDebris = 15;
    this.maxHazards = 8;
    
    this.phaseMultiplier = 1;
  }

  setPhase(phase) {
    this.phaseMultiplier = phase;
    this.hazardInterval = Math.max(1, 3 - (phase - 1) * 0.5);
  }

  update(deltaSeconds, debrisList, hazards, depositZone) {
    this.debrisTimer += deltaSeconds;
    this.hazardTimer += deltaSeconds;

    const activeDebris = debrisList.filter(d => !d.collected).length;
    if (this.debrisTimer >= this.debrisInterval && activeDebris < this.maxDebris) {
      this.debrisTimer = 0;
      const debris = this.spawnDebris(depositZone);
      if (debris) debrisList.push(debris);
    }

    const activeHazards = hazards.filter(h => h.active).length;
    if (this.hazardTimer >= this.hazardInterval && activeHazards < this.maxHazards) {
      this.hazardTimer = 0;
      const hazard = this.spawnHazard();
      if (hazard) hazards.push(hazard);
    }

    for (let i = debrisList.length - 1; i >= 0; i--) {
      if (debrisList[i].collected) {
        debrisList.splice(i, 1);
      }
    }
    for (let i = hazards.length - 1; i >= 0; i--) {
      if (!hazards[i].active) {
        hazards.splice(i, 1);
      }
    }
  }

  spawnDebris(depositZone) {
    const margin = 30;
    let x, y, attempts = 0;
    do {
      x = margin + Math.random() * (this.canvasWidth - margin * 2);
      y = margin + Math.random() * (this.canvasHeight - margin * 2);
      attempts++;
    } while (depositZone && depositZone.position.distance({ x, y }) < depositZone.radius + 20 && attempts < 10);
    
    if (attempts >= 10) return null;
    return new Debris(x, y);
  }

  spawnHazard() {
    const side = Math.floor(Math.random() * 4);
    let x, y, vx, vy;
    const speed = 80 + Math.random() * 60 * this.phaseMultiplier;
    
    switch (side) {
      case 0: // top
        x = Math.random() * this.canvasWidth;
        y = -15;
        vx = (Math.random() - 0.5) * speed;
        vy = speed * (0.5 + Math.random() * 0.5);
        break;
      case 1: // right
        x = this.canvasWidth + 15;
        y = Math.random() * this.canvasHeight;
        vx = -speed * (0.5 + Math.random() * 0.5);
        vy = (Math.random() - 0.5) * speed;
        break;
      case 2: // bottom
        x = Math.random() * this.canvasWidth;
        y = this.canvasHeight + 15;
        vx = (Math.random() - 0.5) * speed;
        vy = -speed * (0.5 + Math.random() * 0.5);
        break;
      case 3: // left
        x = -15;
        y = Math.random() * this.canvasHeight;
        vx = speed * (0.5 + Math.random() * 0.5);
        vy = (Math.random() - 0.5) * speed;
        break;
    }
    
    return new Hazard(x, y, vx, vy);
  }
}

export class VFXSystem {
  constructor() {
    this.screenShake = 0;
    this.hitFlash = 0;
    this.particles = [];
  }

  triggerShake(intensity = 8, duration = 0.3) {
    this.screenShake = Math.max(this.screenShake, intensity);
    setTimeout(() => { this.screenShake = 0; }, duration * 1000);
  }

  triggerHitFlash(duration = 0.15) {
    this.hitFlash = 1;
    setTimeout(() => { this.hitFlash = 0; }, duration * 1000);
  }

  spawnParticles(x, y, count = 5, color = "#f6bb3c") {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 50 + Math.random() * 50;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5,
        color,
        size: 2 + Math.random() * 3
      });
    }
  }

  update(deltaSeconds) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * deltaSeconds;
      p.y += p.vy * deltaSeconds;
      p.life -= deltaSeconds;
      p.size *= 0.98;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  getShakeOffset() {
    if (this.screenShake <= 0) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * this.screenShake,
      y: (Math.random() - 0.5) * this.screenShake
    };
  }

  draw(ctx, shakeOffset) {
    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(255, 95, 109, ${this.hitFlash * 0.3})`;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life * 2;
      ctx.beginPath();
      ctx.arc(p.x + shakeOffset.x, p.y + shakeOffset.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawBackground(ctx, shakeOffset) {
    const cx = ctx.canvas.width / 2 + shakeOffset.x;
    const cy = ctx.canvas.height / 2 + shakeOffset.y;
    
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(ctx.canvas.width, ctx.canvas.height));
    gradient.addColorStop(0, "#1a2f52");
    gradient.addColorStop(1, "#0b1322");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 137.5) % ctx.canvas.width) + shakeOffset.x * (0.5 + i * 0.02);
      const sy = ((i * 213.7) % ctx.canvas.height) + shakeOffset.y * (0.5 + i * 0.02);
      const size = 0.5 + (i % 3) * 0.5;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
