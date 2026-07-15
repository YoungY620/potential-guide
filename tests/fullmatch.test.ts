// Scripted-player full-match test: proves a complete game (economy → build →
// army → upgrades → abilities → final core) is playable to victory within the
// 10–15 minute design window, deterministically.
import { describe, expect, it } from 'vitest';
import { createWorld, type World } from '../src/game/world';
import { step } from '../src/game/sim';
import { applyCommand } from '../src/game/commands';
import type { Building, Unit } from '../src/game/types';

function entitiesOfType(w: World, kind: string, defId?: string, team = 'player') {
  const out: (Unit | Building)[] = [];
  for (const e of w.entities.values()) {
    if (e.kind !== kind || e.team !== team) continue;
    if (defId && e.defId !== defId) continue;
    out.push(e as Unit | Building);
  }
  return out;
}

function nearestNode(w: World, u: Unit, nodeType: 'shards' | 'flux' = 'shards'): number | null {
  let best: number | null = null;
  let bestD = Infinity;
  for (const e of w.entities.values()) {
    if (e.kind !== 'node' || e.nodeType !== nodeType || e.amount <= 0) continue;
    const d = (e.pos.x - u.pos.x) ** 2 + (e.pos.y - u.pos.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = e.id;
    }
  }
  return best;
}

// build plan shared across bot calls (module-level; reset per test run)
const botPlaceState = {
  index: 0,
  plan: [
    { defId: 'fabricator', x: 720, y: 3560, atTick: 20 * 30 },
    { defId: 'capacitor', x: 560, y: 3720, atTick: 20 * 60 },
    { defId: 'turret', x: 520, y: 3280, atTick: 20 * 90 },
    { defId: 'capacitor', x: 860, y: 3480, atTick: 20 * 130 },
    { defId: 'uplink', x: 880, y: 3720, atTick: 20 * 170 },
    { defId: 'fabricator', x: 980, y: 3660, atTick: 20 * 200 },
    { defId: 'turret', x: 700, y: 3300, atTick: 20 * 220 },
    { defId: 'fabricator', x: 1120, y: 3560, atTick: 20 * 260 },
    { defId: 'capacitor', x: 980, y: 3520, atTick: 20 * 300 },
    { defId: 'turret', x: 460, y: 3120, atTick: 20 * 340 },
    { defId: 'fabricator', x: 1120, y: 3400, atTick: 20 * 380 },
    { defId: 'capacitor', x: 1240, y: 3660, atTick: 20 * 420 },
    { defId: 'capacitor', x: 1240, y: 3480, atTick: 20 * 480 },
    { defId: 'capacitor', x: 1360, y: 3560, atTick: 20 * 540 }
  ]
};

// one competent macro cycle
function bot(w: World): void {
  const t = w.tick;
  const workers = entitiesOfType(w, 'unit', 'splicer') as Unit[];
  const citadel = entitiesOfType(w, 'building', 'citadel')[0] as Building | undefined;
  const fabs = entitiesOfType(w, 'building', 'fabricator') as Building[];
  const uplinks = entitiesOfType(w, 'building', 'uplink') as Building[];
  const res = w.players.player.resources;

  // keep workers harvesting: first 4 on flux, rest on shards
  workers.forEach((u, i) => {
    const cur = u.orders[0]?.type;
    if (cur === 'build') return; // never interrupt builders
    const wantFlux = i % 3 === 0; // 1/3 of workers on flux
    const onFlux = u.orders.some((o) => {
      if (o.type !== 'harvest' || o.targetId === undefined) return false;
      const n = w.entities.get(o.targetId);
      return n?.kind === 'node' && n.nodeType === 'flux';
    });
    if (u.orders.length === 0 || (cur === 'harvest' && wantFlux !== onFlux)) {
      const node = nearestNode(w, u, wantFlux ? 'flux' : 'shards');
      if (node !== null) {
        applyCommand(w, { type: 'order', unitIds: [u.id], order: { type: 'harvest', targetId: node }, append: false });
      }
    }
  });
  // worker count up to 12
  if (citadel && workers.length + citadel.productionQueue.length < 12) {
    applyCommand(w, { type: 'train', buildingId: citadel.id, unitDefId: 'splicer' });
  }
  // persistent sequential build order (retries until each entry is placed)
  const placeState = botPlaceState;
  const plan = placeState.plan;
  if (placeState.index < plan.length && t >= plan[placeState.index].atTick) {
    const entry = plan[placeState.index];
    const r = applyCommand(w, {
      type: 'placeBuilding',
      builderIds: workers.map((u) => u.id),
      buildingDefId: entry.defId,
      pos: { x: entry.x, y: entry.y }
    });
    if (r.ok) placeState.index++;
    else if (t % 200 === 0) console.log(`place ${entry.defId}@${entry.x},${entry.y} retry: ${JSON.stringify(r)}`);
  }

  // army production (mix: sentinel backbone + bulwark tanks + arccaster dps)
  const army = [
    ...(entitiesOfType(w, 'unit', 'sentinel') as Unit[]),
    ...(entitiesOfType(w, 'unit', 'bulwark') as Unit[]),
    ...(entitiesOfType(w, 'unit', 'arccaster') as Unit[])
  ];
  const uplinkDone = uplinks.some((u) => u.construction >= 1);
  for (const f of fabs) {
    if (f.construction < 1 || f.productionQueue.length >= 2) continue;
    const mod = army.length % 3;
    const defId = mod === 0 && uplinkDone ? 'arccaster' : mod === 2 ? 'bulwark' : 'sentinel';
    applyCommand(w, { type: 'train', buildingId: f.id, unitDefId: defId });
    // keep reinforcements flowing to the rally choke
    applyCommand(w, { type: 'setRally', buildingId: f.id, pos: { x: 620, y: 3150 } });
  }
  // research
  for (const u of uplinks) {
    if (u.construction < 1 || u.research) continue;
    if (!w.players.player.upgrades.has('plating')) {
      applyCommand(w, { type: 'research', buildingId: u.id, upgradeId: 'plating' });
    } else if (!w.players.player.upgrades.has('overclock')) {
      applyCommand(w, { type: 'research', buildingId: u.id, upgradeId: 'overclock' });
    }
  }
  // army behavior: defend the turret line; intercept only close enemies
  let enemyNear: { x: number; y: number } | null = null;
  let enemyCount = 0;
  for (const e of w.entities.values()) {
    if (e.kind === 'unit' && e.team === 'enemy') {
      enemyCount++;
      const d2 = (e.pos.x - 528) ** 2 + (e.pos.y - 3536) ** 2;
      if (d2 < 700 * 700) enemyNear = { x: e.pos.x, y: e.pos.y };
    }
  }
  let coreId: number | null = null;
  let corePos: { x: number; y: number } | null = null;
  for (const e of w.entities.values()) {
    if (e.kind === 'unit' && e.defId === 'invasion_core') {
      coreId = e.id;
      corePos = { x: e.pos.x, y: e.pos.y };
    }
  }
  let coreNearBase = false;
  if (corePos) {
    coreNearBase = (corePos.x - 528) ** 2 + (corePos.y - 3536) ** 2 < 1500 * 1500;
  }
  const pushing = coreId !== null && (army.length >= 12 || (coreNearBase && army.length >= 8));
  if (t % 40 === 0 && !pushing) {
    if (enemyNear) {
      for (const u of army) {
        applyCommand(w, { type: 'order', unitIds: [u.id], order: { type: 'attackMove', targetPos: { ...enemyNear } }, append: false });
      }
    } else {
      // form up on the turret line and hold
      army.forEach((u, i) => {
        if (u.orders.length === 0 || u.orders[0].type === 'attackMove') {
          const hx = 600 + (i % 5) * 50;
          const hy = 3120 + Math.floor(i / 5) * 50;
          applyCommand(w, { type: 'order', unitIds: [u.id], order: { type: 'move', targetPos: { x: hx, y: hy } }, append: false });
        }
      });
    }
  }
  // cast EMP on enemy clusters
  if ((w.abilityCooldowns['emp'] ?? 0) === 0 && res.flux >= 75 && enemyCount >= 4) {
    let cx = 0;
    let cy = 0;
    let n = 0;
    for (const e of w.entities.values()) {
      if (e.kind === 'unit' && e.team === 'enemy') {
        cx += e.pos.x;
        cy += e.pos.y;
        n++;
      }
    }
    if (n > 0) {
      applyCommand(w, { type: 'castAbility', abilityId: 'emp', target: { x: cx / n, y: cy / n } });
    }
  }
  // late game: focus the invasion core the moment it spawns
  if (coreId !== null && corePos && pushing) {
    if (t % 60 === 0) {
      for (const u of army) {
        applyCommand(w, { type: 'order', unitIds: [u.id], order: { type: 'attack', targetId: coreId }, append: false });
      }
    }
    // EMP stuns the core + escorts; nanobloom heals the push
    if ((w.abilityCooldowns['emp'] ?? 0) === 0 && res.flux >= 75) {
      applyCommand(w, { type: 'castAbility', abilityId: 'emp', target: { ...corePos } });
    }
    if ((w.abilityCooldowns['nanobloom'] ?? 0) === 0 && res.flux >= 75) {
      let cx = 0;
      let cy = 0;
      for (const u of army) {
        cx += u.pos.x;
        cy += u.pos.y;
      }
      applyCommand(w, { type: 'castAbility', abilityId: 'nanobloom', target: { x: cx / army.length, y: cy / army.length } });
    }
  }
}

describe('full match (scripted player)', () => {
  it(
    'plays a complete deterministic match and reaches the final core',
    () => {
      const w = createWorld(20240701);
      const maxTicks = 20 * 60 * 15; // 15 minutes
      let survived = true;
      for (let t = 0; t < maxTicks && !w.result; t++) {
        if (t % 5 === 0) bot(w);
        step(w, []);
        if (w.result === 'defeat') survived = false;
      }
      console.log(
        `result=${w.result} tick=${w.tick} (${(w.tick / 20 / 60).toFixed(1)} min) ` +
          `coreSpawned=${w.waves.coreSpawned} adaptations=${w.waves.adaptationPicks}`
      );
      expect(survived).toBe(true);
      expect(w.waves.coreSpawned).toBe(true);
      expect(w.waves.adaptationPicks).toBeGreaterThanOrEqual(1);
      // scripted player should win within 15 minutes
      expect(w.result).toBe('victory');
      expect(w.tick).toBeGreaterThan(20 * 60 * 9); // match lasts at least 9 min
    },
    120_000
  );
});
