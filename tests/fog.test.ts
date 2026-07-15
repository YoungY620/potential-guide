import { describe, expect, it } from 'vitest';
import { createWorld } from '../src/game/world';
import { step } from '../src/game/sim';
import { MAP_TILES } from '../src/game/map';

describe('fog of war', () => {
  it('reveals tiles around the player base and keeps enemy area hidden', () => {
    const w = createWorld(42);
    for (let i = 0; i < 10; i++) step(w, []);
    // base at tile (16,110)
    const baseIdx = 110 * MAP_TILES + 16;
    expect(w.fogExplored[baseIdx]).toBe(1);
    expect(w.fogVisible[baseIdx]).toBe(1);
    // enemy spawner at tile (108,14) should be unexplored
    const enemyIdx = 14 * MAP_TILES + 108;
    expect(w.fogExplored[enemyIdx]).toBe(0);
    // count explored tiles: should be a few hundred, not zero, not everything
    let explored = 0;
    for (let i = 0; i < MAP_TILES * MAP_TILES; i++) {
      if (w.fogExplored[i] === 1) explored++;
    }
    expect(explored).toBeGreaterThan(100);
    expect(explored).toBeLessThan(MAP_TILES * MAP_TILES);
    console.log('explored tiles:', explored);
  });
});
