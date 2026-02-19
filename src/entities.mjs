export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  add(v) {
    return new Vector2(this.x + v.x, this.y + v.y);
  }

  multiply(scalar) {
    return new Vector2(this.x * scalar, this.y * scalar);
  }

  magnitude() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize() {
    const mag = this.magnitude();
    if (mag === 0) return new Vector2(0, 0);
    return new Vector2(this.x / mag, this.y / mag);
  }

  distance(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

export class Player {
  constructor(x, y) {
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(0, 0);
    this.acceleration = new Vector2(0, 0);
    this.angle = 0;
    this.radius = 12;
    this.hp = 3;
    this.maxHp = 3;
    this.carryCount = 0;
    this.carryValue = 0;
    
    this.accelForce = 280;
    this.friction = 0.96;
    this.maxSpeed = 220;
    this.rotationSpeed = 3.5;
    this.boostForce = 520;
    this.boostCooldown = 0;
    this.boostCooldownMax = 0.08;
    this.invulnerable = 0;
    
    this.input = { left: false, right: false, boost: false, reverse: false };
  }

  update(deltaSeconds, canvasWidth, canvasHeight) {
    if (this.invulnerable > 0) {
      this.invulnerable -= deltaSeconds;
    }
    if (this.boostCooldown > 0) {
      this.boostCooldown -= deltaSeconds;
    }

    const speedFactor = Math.max(0.6, 1 - this.carryCount * 0.08);
    
    if (this.input.left) {
      this.angle -= this.rotationSpeed * deltaSeconds * speedFactor;
    }
    if (this.input.right) {
      this.angle += this.rotationSpeed * deltaSeconds * speedFactor;
    }

    const direction = new Vector2(Math.cos(this.angle), Math.sin(this.angle));
    
    if (this.input.boost && this.boostCooldown <= 0) {
      this.velocity = this.velocity.add(direction.multiply(this.boostForce * deltaSeconds));
      this.boostCooldown = this.boostCooldownMax;
    }

    if (this.input.reverse && this.boostCooldown <= 0) {
      this.velocity = this.velocity.add(direction.multiply(-this.boostForce * 0.75 * deltaSeconds));
      this.boostCooldown = this.boostCooldownMax * 0.75;
    }

    this.velocity = this.velocity.add(this.acceleration.multiply(deltaSeconds));
    this.velocity = this.velocity.multiply(this.friction);
    
    const speed = this.velocity.magnitude();
    if (speed > this.maxSpeed * speedFactor) {
      this.velocity = this.velocity.normalize().multiply(this.maxSpeed * speedFactor);
    }

    this.position = this.position.add(this.velocity.multiply(deltaSeconds));

    this.position.x = Math.max(this.radius, Math.min(canvasWidth - this.radius, this.position.x));
    this.position.y = Math.max(this.radius, Math.min(canvasHeight - this.radius, this.position.y));

    this.acceleration = new Vector2(0, 0);
  }

  draw(ctx, shakeOffset = { x: 0, y: 0 }) {
    const x = this.position.x + shakeOffset.x;
    const y = this.position.y + shakeOffset.y;
    
    if (this.invulnerable > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
      return;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.angle);

    ctx.fillStyle = "#65e0ff";
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-8, 6);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-8, -6);
    ctx.closePath();
    ctx.fill();

    if (this.boostCooldown > this.boostCooldownMax - 0.2) {
      ctx.fillStyle = "rgba(101, 224, 255, 0.4)";
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(-20, 5);
      ctx.lineTo(-20, -5);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();

    for (let i = 0; i < this.carryCount; i++) {
      const orbitAngle = Date.now() / 500 + (i * Math.PI * 2 / Math.max(1, this.carryCount));
      const orbitRadius = this.radius + 8 + i * 2;
      const sx = x + Math.cos(orbitAngle) * orbitRadius;
      const sy = y + Math.sin(orbitAngle) * orbitRadius;
      
      ctx.fillStyle = "#f6bb3c";
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export class Debris {
  constructor(x, y, value = 60) {
    this.position = new Vector2(x, y);
    this.value = value;
    this.radius = 6;
    this.collected = false;
    this.floatOffset = Math.random() * Math.PI * 2;
  }

  update(deltaSeconds) {
    this.floatOffset += deltaSeconds * 2;
  }

  draw(ctx, shakeOffset = { x: 0, y: 0 }) {
    if (this.collected) return;
    
    const x = this.position.x + shakeOffset.x;
    const y = this.position.y + shakeOffset.y + Math.sin(this.floatOffset) * 2;
    
    ctx.fillStyle = "#f6bb3c";
    ctx.beginPath();
    ctx.arc(x, y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = "#c99420";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

export class Hazard {
  constructor(x, y, vx, vy) {
    this.position = new Vector2(x, y);
    this.velocity = new Vector2(vx, vy);
    this.radius = 10;
    this.damage = 1;
    this.active = true;
    this.rotation = 0;
    this.rotationSpeed = (Math.random() - 0.5) * 4;
  }

  update(deltaSeconds, canvasWidth, canvasHeight) {
    this.position = this.position.add(this.velocity.multiply(deltaSeconds));
    this.rotation += this.rotationSpeed * deltaSeconds;

    if (this.position.x < -20 || this.position.x > canvasWidth + 20 ||
        this.position.y < -20 || this.position.y > canvasHeight + 20) {
      this.active = false;
    }
  }

  draw(ctx, shakeOffset = { x: 0, y: 0 }) {
    if (!this.active) return;
    
    const x = this.position.x + shakeOffset.x;
    const y = this.position.y + shakeOffset.y;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.rotation);
    
    ctx.fillStyle = "#ff5f6d";
    ctx.beginPath();
    ctx.moveTo(this.radius, 0);
    ctx.lineTo(-this.radius * 0.5, this.radius * 0.866);
    ctx.lineTo(-this.radius * 0.5, -this.radius * 0.866);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  }
}

export class DepositZone {
  constructor(x, y, radius = 50) {
    this.position = new Vector2(x, y);
    this.radius = radius;
    this.pulsePhase = 0;
  }

  update(deltaSeconds) {
    this.pulsePhase += deltaSeconds * 2;
  }

  contains(point) {
    return this.position.distance(point) <= this.radius;
  }

  draw(ctx, shakeOffset = { x: 0, y: 0 }, playerPosition = null) {
    const x = this.position.x + shakeOffset.x;
    const y = this.position.y + shakeOffset.y;
    const pulse = Math.sin(this.pulsePhase) * 0.1 + 1;
    
    ctx.strokeStyle = "rgba(107, 232, 149, 0.6)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(x, y, this.radius * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = "rgba(107, 232, 149, 0.15)";
    ctx.beginPath();
    ctx.arc(x, y, this.radius * 0.7, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = "#6be895";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("RECYCLER", x, y - 5);
    
    // Only show "Press E" prompt when player is inside the deposit zone
    if (playerPosition && this.contains(playerPosition)) {
      ctx.font = "bold 11px sans-serif";
      ctx.fillText("Press E to deposit", x, y + 12);
    }
  }
}
