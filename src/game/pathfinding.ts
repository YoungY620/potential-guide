// A* pathfinding on the tile grid (8-directional, octile heuristic) with
// line-of-sight smoothing. Grid walkability comes from a Uint8Array where
// 0 = walkable, non-zero = blocked (static ridges or building footprints).
import { MAP_TILES, TILE_SIZE, tileIndex, worldToTile } from './map';
import type { Vec2 } from './types';

const DIRS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2]
];

// Binary min-heap keyed by f-score.
class Heap {
  keys: number[] = [];
  vals: number[] = [];
  get size(): number {
    return this.keys.length;
  }
  push(key: number, val: number): void {
    this.keys.push(key);
    this.vals.push(val);
    let i = this.keys.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= this.keys[i]) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): number {
    const top = this.vals[0];
    const lk = this.keys.pop()!;
    const lv = this.vals.pop()!;
    if (this.vals.length > 0) {
      this.keys[0] = lk;
      this.vals[0] = lv;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.keys.length && this.keys[l] < this.keys[m]) m = l;
        if (r < this.keys.length && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
    [this.vals[a], this.vals[b]] = [this.vals[b], this.vals[a]];
  }
}

export function isWalkable(grid: Uint8Array, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= MAP_TILES || ty >= MAP_TILES) return false;
  return grid[tileIndex(tx, ty)] === 0;
}

// Line of sight between two tile centers using a dense Bresenham walk.
function los(grid: Uint8Array, x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    if (!isWalkable(grid, x, y)) return false;
    if (x === x1 && y === y1) return true;
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    } else {
      err += dx;
      y += sy;
    }
  }
}

// Find a walkable tile near (tx,ty) via ring search. Returns input if walkable.
export function nearestWalkable(
  grid: Uint8Array,
  tx: number,
  ty: number,
  maxRadius = 12
): { tx: number; ty: number } | null {
  if (isWalkable(grid, tx, ty)) return { tx, ty };
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (isWalkable(grid, tx + dx, ty + dy)) return { tx: tx + dx, ty: ty + dy };
      }
    }
  }
  return null;
}

// A* search. Returns a world-px waypoint path (tile centers), or null if unreachable.
export function findPath(grid: Uint8Array, from: Vec2, to: Vec2): Vec2[] | null {
  const s = worldToTile(from.x, from.y);
  const e0 = worldToTile(to.x, to.y);
  const start = nearestWalkable(grid, s.tx, s.ty);
  const end = nearestWalkable(grid, e0.tx, e0.ty);
  if (!start || !end) return null;
  const startIdx = tileIndex(start.tx, start.ty);
  const endIdx = tileIndex(end.tx, end.ty);
  if (startIdx === endIdx) return [{ x: to.x, y: to.y }];

  const g = new Float32Array(MAP_TILES * MAP_TILES).fill(Infinity);
  const cameFrom = new Int32Array(MAP_TILES * MAP_TILES).fill(-1);
  const closed = new Uint8Array(MAP_TILES * MAP_TILES);
  g[startIdx] = 0;
  const heap = new Heap();
  const h = (tx: number, ty: number): number => {
    const dx = Math.abs(tx - end.tx);
    const dy = Math.abs(ty - end.ty);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  heap.push(h(start.tx, start.ty), startIdx);

  let iterations = 0;
  const maxIterations = 20000;
  while (heap.size > 0 && iterations++ < maxIterations) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === endIdx) {
      // reconstruct
      const tiles: number[] = [];
      let c = cur;
      while (c !== -1) {
        tiles.push(c);
        c = cameFrom[c];
      }
      tiles.reverse();
      // smooth: walk from start, skip waypoints while LOS holds
      const waypoints: Vec2[] = [];
      let anchor = 0;
      for (let i = 2; i < tiles.length; i++) {
        const a = tiles[anchor];
        const ax = a % MAP_TILES;
        const ay = Math.floor(a / MAP_TILES);
        const b = tiles[i];
        const bx = b % MAP_TILES;
        const by = Math.floor(b / MAP_TILES);
        if (!los(grid, ax, ay, bx, by)) {
          const t = tiles[i - 1];
          waypoints.push({
            x: (t % MAP_TILES) * TILE_SIZE + TILE_SIZE / 2,
            y: Math.floor(t / MAP_TILES) * TILE_SIZE + TILE_SIZE / 2
          });
          anchor = i - 1;
        }
      }
      waypoints.push({ x: to.x, y: to.y });
      return waypoints;
    }
    const cx = cur % MAP_TILES;
    const cy = Math.floor(cur / MAP_TILES);
    for (const [dx, dy, cost] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isWalkable(grid, nx, ny)) continue;
      if (dx !== 0 && dy !== 0) {
        // no corner cutting
        if (!isWalkable(grid, cx + dx, cy) || !isWalkable(grid, cx, cy + dy)) continue;
      }
      const nIdx = tileIndex(nx, ny);
      if (closed[nIdx]) continue;
      const ng = g[cur] + cost;
      if (ng < g[nIdx]) {
        g[nIdx] = ng;
        cameFrom[nIdx] = cur;
        heap.push(ng + h(nx, ny), nIdx);
      }
    }
  }
  return null;
}
