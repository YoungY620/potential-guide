import { describe, expect, it } from 'vitest';
import { createWorld, spawnUnit, type World } from '../src/game/world';
import { step } from '../src/game/sim';
import { applyCommand, validateTrain } from '../src/game/commands';
import type { Unit } from '../src/game/types';

function stateHash(w: World): string {
  const parts: string[] = [String(w.tick)];
  const ids = [...w.entities.keys()].sort((a, b) => a - b);
  for (const id of ids) {
    const e = w.entities.get(id)!;
    const hp = 'hp' in e ? e.hp : 0;
    parts.push(`${id}:${e.kind}:${e.defId ?? ''}:${Math.round(e.pos.x)}:${Math.round(e.pos.y)}:${hp}`);
  }
  parts.push(`res:${w.players.player.resources.shards}:${w.players.player.resources.flux}`);
  return parts.join('|');
}

function run(w: World, ticks: number): void {
  for (let i = 0; i < ticks; i++) step(w, []);
}

function playerUnits(w: World): Unit[] {
  const out: Unit[] = [];
  for (const e of w.entities.values()) {
    if (e.kind === 'unit' && e.team === 'player') out.push(e);
  }
  return out;
}

describe('world creation', () => {
  it('spawns base, workers, spawner and nodes', () => {
    const w = createWorld(42);
    let citadels = 0;
    let spawners = 0;
    let nodes = 0;
    for (const e of w.entities.values()) {
      if (e.kind === 'building' && e.defId === 'citadel') citadels++;
      if (e.kind === 'building' && e.defId === 'spawner') spawners++;
      if (e.kind === 'node') nodes++;
    }
    expect(citadels).toBe(1);
    expect(spawners).toBe(1);
    expect(nodes).toBe(26);
    expect(playerUnits(w).length).toBe(6);
    expect(w.players.player.supplyCap).toBe(15);
  });
});

describe('determinism', () => {
  it('same seed produces identical state after 1200 ticks', () => {
    const a = createWorld(7);
    const b = createWorld(7);
    run(a, 1200);
    run(b, 1200);
    expect(stateHash(a)).toBe(stateHash(b));
  });
  it('different seeds produce different wave plans across a seed range', () => {
    const plans = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      const w = createWorld(seed);
      plans.add(w.waves.schedule.map((s) => s.lane).join(','));
    }
    expect(plans.size).toBeGreaterThan(1);
  });
});

describe('economy', () => {
  it('harvesters gather shards and return cargo', () => {
    const w = createWorld(42);
    const before = w.players.player.resources.shards;
    const units = playerUnits(w);
    // find nearest shard node
    let nodeId = 0;
    for (const e of w.entities.values()) {
      if (e.kind === 'node' && e.nodeType === 'shards') {
        nodeId = e.id;
        break;
      }
    }
    applyCommand(w, {
      type: 'order',
      unitIds: units.map((u) => u.id),
      order: { type: 'harvest', targetId: nodeId },
      append: false
    });
    run(w, 20 * 60); // one minute
    expect(w.players.player.resources.shards).toBeGreaterThan(before);
  });
});

describe('production', () => {
  it('trains a splicer from the citadel with validation', () => {
    const w = createWorld(42);
    let citadelId = 0;
    for (const e of w.entities.values()) {
      if (e.kind === 'building' && e.defId === 'citadel') citadelId = e.id;
    }
    const v = validateTrain(w, citadelId, 'splicer');
    expect(v.ok).toBe(true);
    applyCommand(w, { type: 'train', buildingId: citadelId, unitDefId: 'splicer' });
    const countBefore = playerUnits(w).length;
    run(w, 260);
    expect(playerUnits(w).length).toBe(countBefore + 1);
  });
  it('rejects training when supply blocked', () => {
    const w = createWorld(42);
    w.players.player.supplyCap = w.players.player.supplyUsed; // block
    let citadelId = 0;
    for (const e of w.entities.values()) {
      if (e.kind === 'building' && e.defId === 'citadel') citadelId = e.id;
    }
    const v = validateTrain(w, citadelId, 'splicer');
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain('容量不足');
  });
});

describe('combat', () => {
  it('attack-move engages and kills an enemy', () => {
    const w = createWorld(42);
    const s = spawnUnit(w, 'sentinel', 'player', { x: 600, y: 3400 });
    const m = spawnUnit(w, 'mite', 'enemy', { x: 700, y: 3400 });
    m.orders = []; // passive
    applyCommand(w, {
      type: 'order',
      unitIds: [s.id],
      order: { type: 'attackMove', targetPos: { x: 900, y: 3400 } },
      append: false
    });
    run(w, 20 * 30);
    expect(w.entities.has(m.id)).toBe(false);
  });
});

describe('waves', () => {
  it('spawns the first wave around 60s and adapts at least once', () => {
    const w = createWorld(42);
    run(w, 20 * 300); // through adaptive wave I at 290s
    let enemies = 0;
    for (const e of w.entities.values()) {
      if (e.kind === 'unit' && e.team === 'enemy') enemies++;
    }
    expect(enemies).toBeGreaterThan(0);
    expect(w.waves.adaptationPicks).toBeGreaterThanOrEqual(1);
  });
});

describe('defeat', () => {
  it('destroying the citadel ends the game', () => {
    const w = createWorld(42);
    for (const e of [...w.entities.values()]) {
      if (e.kind === 'building' && e.defId === 'citadel') {
        e.hp = 0;
        w.entities.delete(e.id);
      }
    }
    step(w, []);
    expect(w.result).toBe('defeat');
  });
});
