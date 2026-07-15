// Uniform-grid spatial hash for fast neighbor queries (separation, targeting).
import type { Vec2 } from './types';

export class SpatialHash {
  private cellSize: number;
  private cols: number;
  private buckets: Map<number, number[]> = new Map();
  private ids: number[] = [];
  private xs: number[] = [];
  private ys: number[] = [];

  constructor(worldPx: number, cellSize: number) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(worldPx / cellSize);
  }

  clear(): void {
    this.buckets.clear();
    this.ids.length = 0;
    this.xs.length = 0;
    this.ys.length = 0;
  }

  insert(id: number, pos: Vec2): void {
    const idx = this.ids.length;
    this.ids.push(id);
    this.xs.push(pos.x);
    this.ys.push(pos.y);
    const cx = Math.floor(pos.x / this.cellSize);
    const cy = Math.floor(pos.y / this.cellSize);
    const key = cy * this.cols + cx;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = [];
      this.buckets.set(key, bucket);
    }
    bucket.push(idx);
  }

  // Visit all entries within radius of pos. Callback receives id, dx, dy, distSq.
  query(pos: Vec2, radius: number, cb: (id: number, dx: number, dy: number, distSq: number) => void): void {
    const r2 = radius * radius;
    const x0 = Math.floor((pos.x - radius) / this.cellSize);
    const x1 = Math.floor((pos.x + radius) / this.cellSize);
    const y0 = Math.floor((pos.y - radius) / this.cellSize);
    const y1 = Math.floor((pos.y + radius) / this.cellSize);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const bucket = this.buckets.get(cy * this.cols + cx);
        if (!bucket) continue;
        for (const idx of bucket) {
          const dx = this.xs[idx] - pos.x;
          const dy = this.ys[idx] - pos.y;
          const d2 = dx * dx + dy * dy;
          if (d2 <= r2) cb(this.ids[idx], dx, dy, d2);
        }
      }
    }
  }
}
