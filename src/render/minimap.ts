// Minimap: terrain thumbnail, resources, units, fog, camera frame, alert pings.
import type { GameController } from '../game/controller';
import { MAP_PX, MAP_TILES, TILE_SIZE } from '../game/map';
import type { Vec2 } from '../game/types';

export class Minimap {
  private thumb: HTMLCanvasElement;
  private alertPings: { x: number; y: number; t: number }[] = [];
  private lastAlertId = 0;

  constructor(controller: GameController) {
    this.thumb = document.createElement('canvas');
    this.thumb.width = MAP_TILES;
    this.thumb.height = MAP_TILES;
    const ctx = this.thumb.getContext('2d')!;
    const map = controller.world.map;
    ctx.fillStyle = '#0a1018';
    ctx.fillRect(0, 0, MAP_TILES, MAP_TILES);
    // infected zones
    for (const z of map.infected) {
      const tx = (z.x / MAP_PX) * MAP_TILES;
      const ty = (z.y / MAP_PX) * MAP_TILES;
      const r = (z.r / MAP_PX) * MAP_TILES;
      const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, r);
      g.addColorStop(0, 'rgba(120, 40, 160, 0.55)');
      g.addColorStop(1, 'rgba(120, 40, 160, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(tx, ty, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // ridges
    ctx.fillStyle = '#2a3a58';
    for (let ty = 0; ty < MAP_TILES; ty++) {
      for (let tx = 0; tx < MAP_TILES; tx++) {
        if (map.blocked[ty * MAP_TILES + tx] === 1) ctx.fillRect(tx, ty, 1, 1);
      }
    }
  }

  worldFromMinimap(mx: number, my: number, size: number): Vec2 {
    return { x: (mx / size) * MAP_PX, y: (my / size) * MAP_PX };
  }

  render(ctx: CanvasRenderingContext2D, c: GameController, size: number): void {
    const s = size / MAP_TILES;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.thumb, 0, 0, size, size);

    const world = c.world;
    const toMap = (x: number, y: number): [number, number] => [
      (x / TILE_SIZE) * s,
      (y / TILE_SIZE) * s
    ];

    // register new alerts as pings
    for (const a of world.alerts) {
      if (a.id > this.lastAlertId) {
        this.lastAlertId = a.id;
        this.alertPings.push({ x: a.pos.x, y: a.pos.y, t: performance.now() });
      }
    }

    // explored fog: dim unexplored
    ctx.fillStyle = 'rgba(2, 4, 8, 0.75)';
    for (let ty = 0; ty < MAP_TILES; ty += 1) {
      for (let tx = 0; tx < MAP_TILES; tx += 1) {
        if (world.fogExplored[ty * MAP_TILES + tx] !== 1) ctx.fillRect(tx * s, ty * s, s + 0.5, s + 0.5);
      }
    }

    // resource nodes
    for (const e of world.entities.values()) {
      if (e.kind !== 'node') continue;
      const [x, y] = toMap(e.pos.x, e.pos.y);
      const tx = Math.floor(e.pos.x / TILE_SIZE);
      const ty = Math.floor(e.pos.y / TILE_SIZE);
      if (world.fogExplored[ty * MAP_TILES + tx] !== 1) continue;
      ctx.fillStyle = e.nodeType === 'shards' ? '#3fd2ff' : '#ff9c41';
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }

    // buildings & units
    for (const e of world.entities.values()) {
      if (e.kind === 'node' || e.kind === 'projectile') continue;
      const tx = Math.floor(e.pos.x / TILE_SIZE);
      const ty = Math.floor(e.pos.y / TILE_SIZE);
      const visible = world.fogVisible[ty * MAP_TILES + tx] === 1;
      if (e.team === 'enemy' && !visible) continue;
      const [x, y] = toMap(e.pos.x, e.pos.y);
      if (e.kind === 'building') {
        ctx.fillStyle = e.team === 'player' ? '#3fd2ff' : '#ff4dd2';
        ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
      } else {
        ctx.fillStyle = e.team === 'player' ? '#9be7ff' : '#f87171';
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }

    // fog of war (unexplored darker already done; hide non-visible areas slightly)
    ctx.fillStyle = 'rgba(2, 4, 8, 0.35)';
    for (let ty = 0; ty < MAP_TILES; ty += 1) {
      for (let tx = 0; tx < MAP_TILES; tx += 1) {
        if (world.fogExplored[ty * MAP_TILES + tx] === 1 && world.fogVisible[ty * MAP_TILES + tx] !== 1) {
          ctx.fillRect(tx * s, ty * s, s + 0.5, s + 0.5);
        }
      }
    }

    // alert pings
    const now = performance.now();
    this.alertPings = this.alertPings.filter((p) => now - p.t < 6000);
    for (const p of this.alertPings) {
      const age = (now - p.t) / 1000;
      const [x, y] = toMap(p.x, p.y);
      const r = 4 + (age % 1) * 10;
      ctx.strokeStyle = `rgba(248, 113, 113, ${1 - (age % 1)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // camera frame
    const cam = c.camera;
    const vw = c.viewport.w / cam.zoom;
    const vh = c.viewport.h / cam.zoom;
    const [cx, cy] = toMap(cam.x, cam.y);
    ctx.strokeStyle = 'rgba(214, 226, 240, 0.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - (vw / TILE_SIZE / 2) * s, cy - (vh / TILE_SIZE / 2) * s, (vw / TILE_SIZE) * s, (vh / TILE_SIZE) * s);

    ctx.restore();
  }
}
