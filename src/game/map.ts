// Map definition: 128x128 tiles, deterministic layout with 3 attack lanes,
// blockers (circuit ridges), resource zones and infected decal zones.
import type { Vec2 } from './types';

export const TILE_SIZE = 32;
export const MAP_TILES = 128;
export const MAP_PX = TILE_SIZE * MAP_TILES;

export type NodeSpawn = { nodeType: 'shards' | 'flux'; tx: number; ty: number; amount: number };

export interface GameMapDef {
  width: number;
  height: number;
  blocked: Uint8Array; // 1 = static blocker (ridge), buildings add dynamic blocks in World
  playerBase: { tx: number; ty: number }; // citadel center tile
  enemySpawner: { tx: number; ty: number };
  nodes: NodeSpawn[];
  lanes: Vec2[][]; // attack routes (world px waypoints, spawner → player base)
  infected: { x: number; y: number; r: number }[]; // visual infection decals (world px)
}

export const tileIndex = (tx: number, ty: number): number => ty * MAP_TILES + tx;
export const tileToWorld = (tx: number, ty: number): Vec2 => ({
  x: tx * TILE_SIZE + TILE_SIZE / 2,
  y: ty * TILE_SIZE + TILE_SIZE / 2
});
export const worldToTile = (x: number, y: number): { tx: number; ty: number } => ({
  tx: Math.max(0, Math.min(MAP_TILES - 1, Math.floor(x / TILE_SIZE))),
  ty: Math.max(0, Math.min(MAP_TILES - 1, Math.floor(y / TILE_SIZE)))
});

function blockRect(blocked: Uint8Array, x0: number, y0: number, x1: number, y1: number): void {
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      blocked[tileIndex(tx, ty)] = 1;
    }
  }
}

export function buildMap(): GameMapDef {
  const blocked = new Uint8Array(MAP_TILES * MAP_TILES);

  // Circuit ridges shaping three lanes (north / mid / south).
  blockRect(blocked, 40, 30, 80, 41); // Ridge Alpha (upper)
  blockRect(blocked, 40, 70, 80, 81); // Ridge Beta (lower)
  // Decorative server-ruin clusters (fixed, leave corridors wide open).
  blockRect(blocked, 92, 44, 94, 46);
  blockRect(blocked, 20, 44, 22, 46);
  blockRect(blocked, 60, 96, 63, 98);
  blockRect(blocked, 100, 70, 102, 72);
  blockRect(blocked, 34, 118, 36, 120);

  const t2w = (tx: number, ty: number): Vec2 => tileToWorld(tx, ty);

  const lanes: Vec2[][] = [
    // North lane: across the top, down the left side, hit base from the north.
    [t2w(100, 16), t2w(60, 18), t2w(24, 18), t2w(14, 55), t2w(16, 96), t2w(18, 104)],
    // Mid lane: through the central gate between the ridges.
    [t2w(98, 24), t2w(92, 34), t2w(62, 54), t2w(46, 60), t2w(28, 84), t2w(20, 100)],
    // South lane: down the right edge, west along the bottom.
    [t2w(104, 24), t2w(114, 55), t2w(104, 96), t2w(64, 110), t2w(34, 110), t2w(24, 108)]
  ];

  const nodes: NodeSpawn[] = [
    // home shard field
    { nodeType: 'shards', tx: 25, ty: 99, amount: 1500 },
    { nodeType: 'shards', tx: 28, ty: 99, amount: 1500 },
    { nodeType: 'shards', tx: 31, ty: 100, amount: 1500 },
    { nodeType: 'shards', tx: 24, ty: 102, amount: 1500 },
    { nodeType: 'shards', tx: 31, ty: 103, amount: 1500 },
    { nodeType: 'shards', tx: 25, ty: 105, amount: 1500 },
    { nodeType: 'shards', tx: 28, ty: 105, amount: 1500 },
    { nodeType: 'shards', tx: 30, ty: 106, amount: 1500 },
    // home flux vents
    { nodeType: 'flux', tx: 20, ty: 114, amount: 1000 },
    { nodeType: 'flux', tx: 23, ty: 116, amount: 1000 },
    // mid expansion
    { nodeType: 'shards', tx: 58, ty: 60, amount: 1500 },
    { nodeType: 'shards', tx: 61, ty: 59, amount: 1500 },
    { nodeType: 'shards', tx: 63, ty: 61, amount: 1500 },
    { nodeType: 'shards', tx: 59, ty: 63, amount: 1500 },
    { nodeType: 'shards', tx: 62, ty: 64, amount: 1500 },
    { nodeType: 'shards', tx: 65, ty: 62, amount: 1500 },
    { nodeType: 'flux', tx: 66, ty: 57, amount: 1000 },
    { nodeType: 'flux', tx: 68, ty: 60, amount: 1000 },
    // south expansion (rich, contested)
    { nodeType: 'shards', tx: 95, ty: 99, amount: 2000 },
    { nodeType: 'shards', tx: 98, ty: 98, amount: 2000 },
    { nodeType: 'shards', tx: 101, ty: 100, amount: 2000 },
    { nodeType: 'shards', tx: 96, ty: 102, amount: 2000 },
    { nodeType: 'shards', tx: 99, ty: 103, amount: 2000 },
    { nodeType: 'shards', tx: 102, ty: 101, amount: 2000 },
    { nodeType: 'flux', tx: 104, ty: 97, amount: 1500 },
    { nodeType: 'flux', tx: 106, ty: 100, amount: 1500 }
  ];

  const infected = [
    { x: 108 * TILE_SIZE, y: 14 * TILE_SIZE, r: 340 },
    { x: 60 * TILE_SIZE, y: 18 * TILE_SIZE, r: 200 },
    { x: 62 * TILE_SIZE, y: 54 * TILE_SIZE, r: 220 },
    { x: 104 * TILE_SIZE, y: 96 * TILE_SIZE, r: 240 },
    { x: 92 * TILE_SIZE, y: 34 * TILE_SIZE, r: 160 }
  ];

  return {
    width: MAP_TILES,
    height: MAP_TILES,
    blocked,
    playerBase: { tx: 16, ty: 110 },
    enemySpawner: { tx: 108, ty: 14 },
    nodes,
    lanes,
    infected
  };
}
