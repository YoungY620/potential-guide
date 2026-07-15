// Frame-space particle effects driven by sim events (not part of the simulation).
import type { GameEvent } from '../game/types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  ring: boolean;
}

const MAX_PARTICLES = 600;

export class FxSystem {
  private particles: Particle[] = [];
  private rngState = 12345;

  private rnd(): number {
    this.rngState = (this.rngState * 1103515245 + 12345) & 0x7fffffff;
    return this.rngState / 0x7fffffff;
  }

  private push(p: Particle): void {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push(p);
  }

  burst(x: number, y: number, count: number, color: string, speed: number, size: number, life: number): void {
    for (let i = 0; i < count; i++) {
      const a = this.rnd() * Math.PI * 2;
      const v = speed * (0.3 + this.rnd() * 0.7);
      this.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: life * (0.6 + this.rnd() * 0.4),
        maxLife: life,
        size: size * (0.6 + this.rnd() * 0.8),
        color,
        ring: false
      });
    }
  }

  ring(x: number, y: number, color: string, size: number, life: number): void {
    this.push({ x, y, vx: 0, vy: 0, life, maxLife: life, size, color, ring: true });
  }

  spawnFromEvents(events: GameEvent[]): { shake: number } {
    let shake = 0;
    for (const e of events) {
      switch (e.type) {
        case 'shot':
          this.burst(e.pos.x, e.pos.y, 2, e.team === 'player' ? '#3fd2ff' : '#9dff3f', 40, 2, 0.15);
          break;
        case 'hit':
          this.burst(e.pos.x, e.pos.y, 3, '#ffd27a', 60, 2, 0.2);
          break;
        case 'explosion':
          this.ring(e.pos.x, e.pos.y, '#ffcf8a', e.radius, 0.4);
          this.burst(e.pos.x, e.pos.y, Math.min(20, 4 + e.radius / 5), '#ff9c41', 140, 3, 0.5);
          if (e.radius >= 60) shake = Math.max(shake, 5);
          break;
        case 'death':
          this.burst(e.pos.x, e.pos.y, 10, e.team === 'enemy' ? '#a44dcc' : '#7f95b5', 110, 3, 0.6);
          break;
        case 'ability':
          this.ring(e.pos.x, e.pos.y, e.defId === 'emp' ? '#3fd2ff' : '#5cff9d', 130, 0.6);
          this.burst(e.pos.x, e.pos.y, 24, e.defId === 'emp' ? '#3fd2ff' : '#5cff9d', 180, 3, 0.6);
          shake = Math.max(shake, 4);
          break;
        case 'harvest':
          this.burst(e.pos.x, e.pos.y, 2, '#3fd2ff', 30, 1.5, 0.25);
          break;
        case 'buildComplete':
        case 'trainComplete':
          this.ring(e.pos.x, e.pos.y, '#5cff9d', 50, 0.5);
          break;
        case 'researchComplete':
          break;
        case 'alert':
          break;
      }
    }
    return { shake };
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const f = p.life / p.maxLife;
      if (p.ring) {
        const r = p.size * (1.4 - f * 0.9);
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = f * 0.8;
        ctx.lineWidth = 3 * f + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = f;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * f, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
}
