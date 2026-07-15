// Procedural terrain: circuit-board aesthetic rendered once to an offscreen
// canvas, plus per-frame animated data-flow overlays along the attack lanes.
import { createRng } from '../game/rng';
import { MAP_PX, TILE_SIZE, type GameMapDef } from '../game/map';

export class Terrain {
  private base: HTMLCanvasElement;
  private scale: number;

  constructor(map: GameMapDef) {
    this.scale = 2048 / MAP_PX; // offscreen at 2048²
    this.base = document.createElement('canvas');
    this.base.width = 2048;
    this.base.height = 2048;
    const ctx = this.base.getContext('2d')!;
    ctx.scale(this.scale, this.scale);
    this.paint(ctx, map);
  }

  private paint(ctx: CanvasRenderingContext2D, map: GameMapDef): void {
    // substrate
    const grad = ctx.createLinearGradient(0, 0, MAP_PX, MAP_PX);
    grad.addColorStop(0, '#121d30');
    grad.addColorStop(0.5, '#142136');
    grad.addColorStop(1, '#111a2a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, MAP_PX, MAP_PX);

    // fine grid
    ctx.strokeStyle = 'rgba(80, 120, 170, 0.16)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 128; i++) {
      const p = i * TILE_SIZE;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, MAP_PX);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(MAP_PX, p);
      ctx.stroke();
    }

    // circuit traces (deterministic decoration)
    const rng = createRng(1337);
    ctx.lineWidth = 2;
    for (let i = 0; i < 260; i++) {
      const sx = Math.floor(rng.next() * 128) * TILE_SIZE + 16;
      const sy = Math.floor(rng.next() * 128) * TILE_SIZE + 16;
      const hue = rng.next() < 0.5 ? '63, 210, 255' : '255, 156, 65';
      ctx.strokeStyle = `rgba(${hue}, ${0.1 + rng.next() * 0.14})`;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      let x = sx;
      let y = sy;
      const segments = 2 + Math.floor(rng.next() * 4);
      for (let s = 0; s < segments; s++) {
        const dir = Math.floor(rng.next() * 4);
        const len = (1 + Math.floor(rng.next() * 4)) * TILE_SIZE;
        if (dir === 0) x += len;
        else if (dir === 1) x -= len;
        else if (dir === 2) y += len;
        else y -= len;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      // node pad at trace end
      ctx.fillStyle = `rgba(${hue}, ${0.1 + rng.next() * 0.12})`;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // infected zones: semi-organic data blight
    for (const zone of map.infected) {
      const g = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, zone.r);
      g.addColorStop(0, 'rgba(120, 40, 160, 0.4)');
      g.addColorStop(0.6, 'rgba(90, 30, 130, 0.22)');
      g.addColorStop(1, 'rgba(70, 20, 100, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, zone.r, 0, Math.PI * 2);
      ctx.fill();
      // veins
      const vrng = createRng(Math.floor(zone.x + zone.y));
      ctx.strokeStyle = 'rgba(157, 255, 63, 0.10)';
      ctx.lineWidth = 2;
      for (let v = 0; v < 10; v++) {
        const a = vrng.next() * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(zone.x, zone.y);
        let px = zone.x;
        let py = zone.y;
        for (let s = 0; s < 4; s++) {
          const rr = (zone.r / 4) * (s + 1) * (0.7 + vrng.next() * 0.5);
          const aa = a + (vrng.next() - 0.5) * 0.9;
          px = zone.x + Math.cos(aa) * rr;
          py = zone.y + Math.sin(aa) * rr;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }

    // ridges: raised circuit walls
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        if (map.blocked[ty * map.width + tx] !== 1) continue;
        const x = tx * TILE_SIZE;
        const y = ty * TILE_SIZE;
        ctx.fillStyle = '#22314e';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#31466e';
        ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 6);
        ctx.fillStyle = 'rgba(63, 210, 255, 0.45)';
        ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, 2);
      }
    }

    // lane underlay glow
    ctx.strokeStyle = 'rgba(63, 210, 255, 0.05)';
    ctx.lineWidth = 60;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const lane of map.lanes) {
      ctx.beginPath();
      ctx.moveTo(lane[0].x, lane[0].y);
      for (let i = 1; i < lane.length; i++) ctx.lineTo(lane[i].x, lane[i].y);
      ctx.stroke();
    }
  }

  // Draw the visible region of the static base (clamped to map bounds).
  draw(ctx: CanvasRenderingContext2D, cam: { x: number; y: number; zoom: number }, vw: number, vh: number): void {
    const w = vw / cam.zoom;
    const h = vh / cam.zoom;
    const sx = cam.x - w / 2;
    const sy = cam.y - h / 2;
    const cx0 = Math.max(0, sx);
    const cy0 = Math.max(0, sy);
    const cx1 = Math.min(MAP_PX, sx + w);
    const cy1 = Math.min(MAP_PX, sy + h);
    const dw = cx1 - cx0;
    const dh = cy1 - cy0;
    if (dw <= 0 || dh <= 0) return;
    ctx.drawImage(
      this.base,
      cx0 * this.scale,
      cy0 * this.scale,
      dw * this.scale,
      dh * this.scale,
      cx0,
      cy0,
      dw,
      dh
    );
  }

  // Animated data-flow packets running along lanes (called per frame, world space).
  drawFlow(ctx: CanvasRenderingContext2D, map: GameMapDef, timeSec: number): void {
    ctx.save();
    for (const lane of map.lanes) {
      // total length
      let total = 0;
      const segs: number[] = [];
      for (let i = 1; i < lane.length; i++) {
        const l = Math.hypot(lane[i].x - lane[i - 1].x, lane[i].y - lane[i - 1].y);
        segs.push(l);
        total += l;
      }
      const packets = Math.floor(total / 220);
      for (let p = 0; p < packets; p++) {
        const t = ((timeSec * 90 + p * 220) % total) / total;
        let d = t * total;
        let i = 0;
        while (i < segs.length - 1 && d > segs[i]) {
          d -= segs[i];
          i++;
        }
        const a = lane[i];
        const b = lane[i + 1];
        const f = segs[i] > 0 ? d / segs[i] : 0;
        const x = a.x + (b.x - a.x) * f;
        const y = a.y + (b.y - a.y) * f;
        ctx.fillStyle = 'rgba(63, 210, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
