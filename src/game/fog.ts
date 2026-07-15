// Fog of war: per-tile visibility recomputed from player units/buildings each tick,
// explored mask persists. Enemy visibility is not simulated (single player).
import { MAP_TILES, TILE_SIZE, tileIndex } from './map';
import { buildingDef } from './data/buildings';
import { unitDef } from './data/units';
import type { World } from './world';

export function recomputeFog(world: World): void {
  world.fogVisible.fill(0);
  const stamp = (x: number, y: number, sightPx: number): void => {
    const radiusTiles = Math.ceil(sightPx / TILE_SIZE);
    const ctx = Math.floor(x / TILE_SIZE);
    const cty = Math.floor(y / TILE_SIZE);
    const r2 = sightPx * sightPx;
    for (let ty = cty - radiusTiles; ty <= cty + radiusTiles; ty++) {
      if (ty < 0 || ty >= MAP_TILES) continue;
      for (let tx = ctx - radiusTiles; tx <= ctx + radiusTiles; tx++) {
        if (tx < 0 || tx >= MAP_TILES) continue;
        const dx = tx * TILE_SIZE + TILE_SIZE / 2 - x;
        const dy = ty * TILE_SIZE + TILE_SIZE / 2 - y;
        if (dx * dx + dy * dy <= r2) {
          const idx = tileIndex(tx, ty);
          world.fogVisible[idx] = 1;
          world.fogExplored[idx] = 1;
        }
      }
    }
  };
  for (const e of world.entities.values()) {
    if (e.kind === 'node' || e.kind === 'projectile' || e.team !== 'player') continue;
    if (e.kind === 'unit') {
      stamp(e.pos.x, e.pos.y, unitDef(e.defId).sight);
    } else if (e.kind === 'building' && e.construction >= 1) {
      stamp(e.pos.x, e.pos.y, buildingDef(e.defId).sight);
    }
  }
}

export function isVisible(world: World, x: number, y: number): boolean {
  const tx = Math.floor(x / TILE_SIZE);
  const ty = Math.floor(y / TILE_SIZE);
  if (tx < 0 || ty < 0 || tx >= MAP_TILES || ty >= MAP_TILES) return false;
  return world.fogVisible[tileIndex(tx, ty)] === 1;
}
