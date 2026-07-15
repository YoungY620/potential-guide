// Enemy wave director: scheduled waves with seeded lane choices, trickle pressure,
// and adaptive compositions that react to the player's army/turret balance.
import { buildingDef } from './data/buildings';
import { unitDef } from './data/units';
import { TILE_SIZE } from './map';
import type { Order } from './types';
import { spawnUnit, type WaveSpawn, type World } from './world';
import { pushAlert } from './systems/orders';

const LANE_NAMES = ['北线', '中线', '南线'];

function laneOrders(world: World, laneIdx: number): Order[] {
  const lane = world.map.lanes[Math.min(laneIdx, world.map.lanes.length - 1)];
  return lane.map((p) => ({ type: 'attackMove' as const, targetPos: { ...p } }));
}

// Adaptive composition: reacts to player army supply vs static defense.
export function adaptiveComposition(world: World): { defId: string; count: number }[] {
  let army = 0;
  let turrets = 0;
  for (const e of world.entities.values()) {
    if (e.kind === 'node' || e.kind === 'projectile' || e.team !== 'player') continue;
    if (e.kind === 'unit') {
      const def = unitDef(e.defId);
      if (def.role === 'combat' || def.role === 'support') army += def.supply;
    } else if (e.kind === 'building' && e.defId === 'turret' && e.construction >= 1) {
      turrets++;
    }
  }
  const second = world.waves.adaptationPicks >= 1;
  world.waves.adaptationPicks++;
  let comp: { defId: string; count: number }[];
  if (turrets * 2 > army) {
    // turtle player → building-killers and carriers
    comp = [
      { defId: 'leech', count: 3 },
      { defId: 'carrier', count: 2 },
      { defId: 'spitter', count: 2 },
      { defId: 'mite', count: 4 }
    ];
  } else if (army >= 14) {
    // big army → splash-resistant carriers + ranged
    comp = [
      { defId: 'carrier', count: 2 },
      { defId: 'spitter', count: 6 },
      { defId: 'mite', count: 8 }
    ];
  } else {
    // weak player → swarm pressure
    comp = [
      { defId: 'mite', count: 12 },
      { defId: 'spitter', count: 3 },
      { defId: 'leech', count: 1 }
    ];
  }
  if (second) {
    comp = comp.map((c) => ({ defId: c.defId, count: Math.ceil(c.count * 1.5) }));
    comp.push({ defId: 'ravager', count: 1 });
  }
  return comp;
}

function spawnWave(world: World, wave: WaveSpawn): void {
  const comp = wave.adaptive ? adaptiveComposition(world) : wave.composition;
  const spawnerPos = {
    x: world.map.enemySpawner.tx * TILE_SIZE + 16,
    y: world.map.enemySpawner.ty * TILE_SIZE + 16
  };
  const orders = laneOrders(world, wave.lane);
  // the invasion core beelines the player's citadel for a decisive finale
  let citadelPos: { x: number; y: number } | null = null;
  for (const e of world.entities.values()) {
    if (e.kind === 'building' && e.defId === 'citadel' && e.team === 'player') {
      citadelPos = { x: e.pos.x, y: e.pos.y };
    }
  }
  let i = 0;
  for (const { defId, count } of comp) {
    for (let c = 0; c < count; c++) {
      const a = (i * 2.399963) % (Math.PI * 2); // golden angle spread, deterministic per index
      // spawn outside the spawner footprint (half = 96px) so units never get trapped
      const r = 150 + (i % 5) * 26;
      const unit = spawnUnit(world, defId, 'enemy', {
        x: spawnerPos.x + Math.cos(a) * r,
        y: spawnerPos.y + Math.sin(a) * r
      });
      if (defId === 'invasion_core') {
        world.waves.coreSpawned = true;
        unit.orders = citadelPos
          ? [{ type: 'attackMove', targetPos: { ...citadelPos } }]
          : orders.map((o) => ({ ...o, targetPos: o.targetPos ? { ...o.targetPos } : undefined }));
      } else {
        unit.orders = orders.map((o) => ({ ...o, targetPos: o.targetPos ? { ...o.targetPos } : undefined }));
      }
      i++;
    }
  }
}

export function updateWaves(world: World): void {
  const w = world.waves;
  for (const s of w.schedule) {
    if (s.atTick === Infinity) continue;
    if (!s.announced && world.tick >= s.atTick - 200) {
      s.announced = true;
      const lane = world.map.lanes[Math.min(s.lane, world.map.lanes.length - 1)];
      const mid = lane[Math.floor(lane.length / 2)];
      pushAlert(world, 'wave', mid, `警告：${s.label}自${LANE_NAMES[s.lane] ?? '未知方向'}接近`);
    }
    if (world.tick >= s.atTick) {
      spawnWave(world, s);
      s.atTick = Infinity;
    }
  }
  // light trickle pressure after 4 minutes (stops once the core is out)
  if (world.tick >= 240 * 20 && !w.coreSpawned) {
    w.trickleTimer--;
    if (w.trickleTimer <= 0) {
      w.trickleTimer = 50 * 20;
      const lane = world.rng.int(0, 2);
      const spawnerPos = {
        x: world.map.enemySpawner.tx * TILE_SIZE + 16,
        y: world.map.enemySpawner.ty * TILE_SIZE + 16
      };
      const n = world.rng.int(2, 3);
      for (let k = 0; k < n; k++) {
        // spawn outside the spawner footprint (half = 96px)
        const a = world.rng.next() * Math.PI * 2;
        const r = 150 + world.rng.next() * 80;
        const unit = spawnUnit(world, 'mite', 'enemy', {
          x: spawnerPos.x + Math.cos(a) * r,
          y: spawnerPos.y + Math.sin(a) * r
        });
        unit.orders = laneOrders(world, lane);
      }
    }
  }
  // threat level for UI: next wave proximity + size
  let eta = Infinity;
  let size = 0;
  for (const s of w.schedule) {
    if (s.atTick === Infinity) continue;
    if (s.atTick < eta) {
      eta = s.atTick;
      size = s.adaptive ? 14 : s.composition.reduce((a, c) => a + c.count, 0);
    }
  }
  world.nextWaveEta = eta === Infinity ? Infinity : Math.max(0, eta - world.tick);
  if (eta === Infinity) world.threatLevel = 1;
  else if (world.nextWaveEta < 100) world.threatLevel = size >= 12 ? 4 : 3;
  else if (world.nextWaveEta < 400) world.threatLevel = 2;
  else world.threatLevel = 1;
}

export { buildingDef };
