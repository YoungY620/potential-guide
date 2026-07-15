// Main canvas renderer: terrain, entities with interpolation, fog of war,
// selection overlays, order markers, range previews and placement ghosts.
import type { GameController } from '../game/controller';
import type { GameEvent } from '../game/types';
import { buildingDef } from '../game/data/buildings';
import { unitDef } from '../game/data/units';
import { abilityDef } from '../game/data/abilities';
import { MAP_PX, MAP_TILES, TILE_SIZE } from '../game/map';
import { validatePlace } from '../game/commands';
import type { Building, ResourceNode, Unit } from '../game/types';
import { Terrain } from './terrain';
import { FxSystem } from './fx';
import { drawBuilding, drawNode, drawProjectile, drawUnit } from './sprites';
import { targetRadius } from '../game/systems/combat';

export interface InputView {
  mouseWorld: { x: number; y: number };
  mouseScreen: { x: number; y: number };
  dragRect: { x0: number; y0: number; x1: number; y1: number } | null; // world coords
  hoverId: number | null;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private terrain: Terrain;
  private fx = new FxSystem();
  private fogCanvas: HTMLCanvasElement;
  private fogCtx: CanvasRenderingContext2D;
  private fogImage: ImageData;
  private attackFlashes = new Map<number, number>(); // entity id → flash 0..1
  private time = 0;
  private lastFrame: number | null = null;

  constructor(canvas: HTMLCanvasElement, controller: GameController) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.terrain = new Terrain(controller.world.map);
    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = MAP_TILES;
    this.fogCanvas.height = MAP_TILES;
    this.fogCtx = this.fogCanvas.getContext('2d')!;
    this.fogImage = this.fogCtx.createImageData(MAP_TILES, MAP_TILES);
  }

  // rebuild terrain if a new game started on a fresh world
  maybeResetTerrain(controller: GameController): void {
    if (this.terrain && controller.world.tick === 0) {
      // same map layout every game; nothing to rebuild (kept for future map variants)
    }
  }

  resize(w: number, h: number): void {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  get fxSystem(): FxSystem {
    return this.fx;
  }

  render(controller: GameController, alpha: number, view: InputView, events: GameEvent[]): void {
    const now = performance.now();
    const dt = this.lastFrame === null ? 0.016 : Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.time += dt;
    this.fx.update(dt);
    // decay attack flashes
    for (const [id, v] of this.attackFlashes) {
      const nv = v - dt * 6;
      if (nv <= 0) this.attackFlashes.delete(id);
      else this.attackFlashes.set(id, nv);
    }

    const { ctx } = this;
    const cam = controller.camera;
    const vw = this.canvas.width;
    const vh = this.canvas.height;
    controller.shake = Math.max(0, controller.shake - dt * 30);
    const shakeX = controller.shake > 0 ? (Math.random() - 0.5) * controller.shake : 0;
    const shakeY = controller.shake > 0 ? (Math.random() - 0.5) * controller.shake : 0;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#04060a';
    ctx.fillRect(0, 0, vw, vh);

    // world transform
    ctx.setTransform(cam.zoom, 0, 0, cam.zoom, vw / 2 - cam.x * cam.zoom + shakeX, vh / 2 - cam.y * cam.zoom + shakeY);

    this.terrain.draw(ctx, cam, vw, vh);
    this.terrain.drawFlow(ctx, controller.world.map, this.time);

    const world = controller.world;
    const viewL = cam.x - vw / cam.zoom / 2 - 100;
    const viewR = cam.x + vw / cam.zoom / 2 + 100;
    const viewT = cam.y - vh / cam.zoom / 2 - 100;
    const viewB = cam.y + vh / cam.zoom / 2 + 100;
    const inView = (x: number, y: number): boolean => x >= viewL && x <= viewR && y >= viewT && y <= viewB;

    // events → fx + screen shake (events drained by the caller, shared with audio)
    const { shake } = this.fx.spawnFromEvents(events);
    if (shake > 0) controller.addShake(shake);

    // resource nodes (visible when explored)
    for (const e of world.entities.values()) {
      if (e.kind !== 'node' || !inView(e.pos.x, e.pos.y)) continue;
      const n = e as ResourceNode;
      if (!this.exploredAt(world, n.pos.x, n.pos.y)) continue;
      ctx.save();
      ctx.translate(n.pos.x, n.pos.y);
      drawNode(ctx, n.nodeType, n.amount / n.maxAmount, this.time);
      ctx.restore();
    }

    // buildings
    for (const e of world.entities.values()) {
      if (e.kind !== 'building' || !inView(e.pos.x, e.pos.y)) continue;
      const b = e as Building;
      const visible = this.visibleAt(world, b.pos.x, b.pos.y);
      if (b.team === 'enemy' && !visible) continue;
      ctx.save();
      ctx.translate(b.pos.x, b.pos.y);
      const flash = this.attackFlashes.get(b.id) ?? 0;
      drawBuilding(ctx, b.defId, this.time, b.construction, flash);
      ctx.restore();
      if (b.team === 'player' || visible) this.drawHpBar(ctx, b, b.pos.x, b.pos.y);
      if (b.construction < 1) this.drawConstructionBar(ctx, b);
    }

    // units (with interpolation)
    for (const e of world.entities.values()) {
      if (e.kind !== 'unit') continue;
      const u = e as Unit;
      const ix = u.prevPos.x + (u.pos.x - u.prevPos.x) * alpha;
      const iy = u.prevPos.y + (u.pos.y - u.prevPos.y) * alpha;
      if (!inView(ix, iy)) continue;
      if (u.team === 'enemy' && !this.visibleAt(world, ix, iy)) continue;
      const moving = Math.hypot(u.pos.x - u.prevPos.x, u.pos.y - u.prevPos.y) > 0.05;
      // muzzle flash heuristic: fired recently (cooldown close to max)
      const flash = this.attackFlashes.get(u.id) ?? 0;
      ctx.save();
      ctx.translate(ix, iy);
      ctx.rotate(u.angle);
      drawUnit(ctx, u.defId, { time: this.time, moving, attackFlash: flash, stun: u.stunTicks > 0 });
      ctx.restore();
      if (u.stunTicks > 0) {
        ctx.strokeStyle = 'rgba(63, 210, 255, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(ix, iy - unitDef(u.defId).radius - 6, 6, 3, this.time * 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      this.drawHpBar(ctx, u, ix, iy);
    }

    // projectiles
    for (const e of world.entities.values()) {
      if (e.kind !== 'projectile') continue;
      const ix = e.prevPos.x + (e.pos.x - e.prevPos.x) * alpha;
      const iy = e.prevPos.y + (e.pos.y - e.prevPos.y) * alpha;
      if (!inView(ix, iy)) continue;
      ctx.save();
      ctx.translate(ix, iy);
      ctx.rotate(Math.atan2(e.pos.y - e.prevPos.y, e.pos.x - e.prevPos.x));
      drawProjectile(ctx, e.defId, 0);
      ctx.restore();
    }

    this.fx.draw(ctx);

    this.drawSelectionOverlays(ctx, controller, alpha);
    this.drawOrderMarkers(ctx, controller);
    this.drawPendingOverlays(ctx, controller, view);

    // drag rectangle
    if (view.dragRect) {
      const r = view.dragRect;
      ctx.strokeStyle = 'rgba(63, 210, 255, 0.9)';
      ctx.fillStyle = 'rgba(63, 210, 255, 0.08)';
      ctx.lineWidth = 1.5 / cam.zoom;
      const x = Math.min(r.x0, r.x1);
      const y = Math.min(r.y0, r.y1);
      ctx.fillRect(x, y, Math.abs(r.x1 - r.x0), Math.abs(r.y1 - r.y0));
      ctx.strokeRect(x, y, Math.abs(r.x1 - r.x0), Math.abs(r.y1 - r.y0));
    }

    this.drawFog(ctx, controller);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }


  private visibleAt(world: GameController['world'], x: number, y: number): boolean {
    const tx = Math.floor(x / TILE_SIZE);
    const ty = Math.floor(y / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= MAP_TILES || ty >= MAP_TILES) return false;
    return world.fogVisible[ty * MAP_TILES + tx] === 1;
  }

  private exploredAt(world: GameController['world'], x: number, y: number): boolean {
    const tx = Math.floor(x / TILE_SIZE);
    const ty = Math.floor(y / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= MAP_TILES || ty >= MAP_TILES) return false;
    return world.fogExplored[ty * MAP_TILES + tx] === 1;
  }

  private drawHpBar(ctx: CanvasRenderingContext2D, e: Unit | Building, x: number, y: number): void {
    if (e.hp >= e.maxHp && e.kind === 'unit' && e.team === 'player') {
      // full-health player units: hide bar for clarity
    }
    const r = targetRadius(e);
    const w = Math.max(18, r * 2);
    const frac = Math.max(0, e.hp / e.maxHp);
    if (frac >= 0.999 && e.team === 'player' && e.kind === 'unit') return;
    const by = y - r - 8;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - w / 2, by, w, 4);
    ctx.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#facc15' : '#f87171';
    ctx.fillRect(x - w / 2, by, w * frac, 4);
  }

  private drawConstructionBar(ctx: CanvasRenderingContext2D, b: Building): void {
    const r = targetRadius(b);
    const w = r * 1.6;
    const y = b.pos.y + r + 6;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(b.pos.x - w / 2, y, w, 4);
    ctx.fillStyle = '#3fd2ff';
    ctx.fillRect(b.pos.x - w / 2, y, w * b.construction, 4);
  }

  private drawSelectionOverlays(ctx: CanvasRenderingContext2D, c: GameController, alpha: number): void {
    for (const id of c.selection) {
      const e = c.world.entities.get(id);
      if (!e || e.kind === 'node' || e.kind === 'projectile') continue;
      const r = targetRadius(e) + 4;
      const x = e.prevPos.x + (e.pos.x - e.prevPos.x) * alpha;
      const y = e.prevPos.y + (e.pos.y - e.prevPos.y) * alpha;
      ctx.strokeStyle = '#3fd2ff';
      ctx.lineWidth = 1.8 / c.camera.zoom;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2);
      ctx.stroke();
      // corner ticks
      ctx.beginPath();
      for (const a of [Math.PI * 0.2, Math.PI * 0.7, Math.PI * 1.2, Math.PI * 1.7]) {
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r * 0.75;
        ctx.moveTo(px - Math.cos(a) * 5, py - Math.sin(a) * 5);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  private drawOrderMarkers(ctx: CanvasRenderingContext2D, c: GameController): void {
    const t = this.time;
    for (const id of c.selection) {
      const e = c.world.entities.get(id);
      if (!e || e.kind !== 'unit') continue;
      const u = e as Unit;
      // rally point for selected buildings handled below
      let px = u.pos.x;
      let py = u.pos.y;
      ctx.lineWidth = 1.5 / c.camera.zoom;
      for (const o of u.orders) {
        const dest = o.targetPos ?? (o.targetId !== undefined ? c.world.entities.get(o.targetId)?.pos : undefined);
        if (!dest) continue;
        const isAttack = o.type === 'attackMove' || o.type === 'attack' || o.type === 'patrol';
        ctx.strokeStyle = isAttack ? 'rgba(248, 113, 113, 0.5)' : 'rgba(74, 222, 128, 0.5)';
        ctx.setLineDash([6 / c.camera.zoom, 6 / c.camera.zoom]);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(dest.x, dest.y);
        ctx.stroke();
        ctx.setLineDash([]);
        // destination flag
        const pulse = 3 + Math.sin(t * 6) * 1.2;
        ctx.strokeStyle = isAttack ? '#f87171' : '#4ade80';
        ctx.beginPath();
        ctx.moveTo(dest.x - 6, dest.y);
        ctx.lineTo(dest.x + 6, dest.y);
        ctx.moveTo(dest.x, dest.y - 6);
        ctx.lineTo(dest.x, dest.y + 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(dest.x, dest.y, pulse + 4, 0, Math.PI * 2);
        ctx.stroke();
        px = dest.x;
        py = dest.y;
      }
      // current path polyline (faint)
      if (u.path.length > 0 && u.pathIndex < u.path.length) {
        ctx.strokeStyle = 'rgba(214, 226, 240, 0.18)';
        ctx.lineWidth = 1 / c.camera.zoom;
        ctx.beginPath();
        ctx.moveTo(u.pos.x, u.pos.y);
        for (let i = u.pathIndex; i < u.path.length; i++) ctx.lineTo(u.path[i].x, u.path[i].y);
        ctx.stroke();
      }
    }
    // building rally points
    for (const id of c.selection) {
      const e = c.world.entities.get(id);
      if (!e || e.kind !== 'building' || !e.rallyPoint) continue;
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.6)';
      ctx.lineWidth = 1.5 / c.camera.zoom;
      ctx.setLineDash([5 / c.camera.zoom, 5 / c.camera.zoom]);
      ctx.beginPath();
      ctx.moveTo(e.pos.x, e.pos.y);
      ctx.lineTo(e.rallyPoint.x, e.rallyPoint.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(e.rallyPoint.x, e.rallyPoint.y, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawPendingOverlays(ctx: CanvasRenderingContext2D, c: GameController, view: InputView): void {
    const pending = c.pendingAction;
    if (!pending) return;
    const m = view.mouseWorld;
    if (pending.kind === 'place') {
      const defId = pending.buildingDefId;
      const ok = validatePlace(c.world, defId, m).ok;
      const def = buildingDef(defId);
      const half = (def.size * TILE_SIZE) / 2;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.translate(m.x, m.y);
      drawBuilding(ctx, defId, this.time, 1, 0);
      ctx.restore();
      ctx.fillStyle = ok ? 'rgba(74, 222, 128, 0.18)' : 'rgba(248, 113, 113, 0.22)';
      ctx.strokeStyle = ok ? '#4ade80' : '#f87171';
      ctx.lineWidth = 2 / c.camera.zoom;
      ctx.fillRect(m.x - half, m.y - half, half * 2, half * 2);
      ctx.strokeRect(m.x - half, m.y - half, half * 2, half * 2);
      // range preview for turret
      if (def.attack) {
        ctx.strokeStyle = 'rgba(255, 156, 65, 0.5)';
        ctx.beginPath();
        ctx.arc(m.x, m.y, def.attack.range, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (pending.kind === 'ability') {
      const def = abilityDef(pending.abilityId);
      ctx.strokeStyle = pending.abilityId === 'emp' ? '#3fd2ff' : '#5cff9d';
      ctx.fillStyle = pending.abilityId === 'emp' ? 'rgba(63,210,255,0.12)' : 'rgba(92,255,157,0.12)';
      ctx.lineWidth = 2 / c.camera.zoom;
      ctx.beginPath();
      ctx.arc(m.x, m.y, def.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      // attackMove / patrol target cursor
      ctx.strokeStyle = pending.kind === 'attackMove' ? '#f87171' : '#4ade80';
      ctx.lineWidth = 2 / c.camera.zoom;
      ctx.beginPath();
      ctx.moveTo(m.x - 8, m.y);
      ctx.lineTo(m.x + 8, m.y);
      ctx.moveTo(m.x, m.y - 8);
      ctx.lineTo(m.x, m.y + 8);
      ctx.stroke();
    }
  }

  private drawFog(ctx: CanvasRenderingContext2D, c: GameController): void {
    const world = c.world;
    const data = this.fogImage.data;
    for (let i = 0; i < MAP_TILES * MAP_TILES; i++) {
      const v = world.fogVisible[i];
      const ex = world.fogExplored[i];
      const o = i * 4;
      data[o] = 2;
      data[o + 1] = 4;
      data[o + 2] = 8;
      data[o + 3] = v ? 0 : ex ? 110 : 235;
    }
    this.fogCtx.putImageData(this.fogImage, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.fogCanvas, 0, 0, MAP_PX, MAP_PX);
    ctx.restore();
  }
}
