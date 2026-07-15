// Selection logic and right-click smart-order resolution. Pure functions over World.
import { buildingDef } from '../game/data/buildings';
import { unitDef } from '../game/data/units';
import { distSq } from '../game/types';
import type { Building, Entity, Order, Unit, Vec2 } from '../game/types';
import type { World } from '../game/world';
import { targetRadius } from '../game/systems/combat';

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function entityAt(world: World, p: Vec2): Entity | null {
  // prefer units, then buildings; nearest within radius
  let best: Entity | null = null;
  let bestD2 = Infinity;
  for (const e of world.entities.values()) {
    if (e.kind === 'projectile' || e.kind === 'node') continue;
    const r = targetRadius(e) + 6;
    const d2 = distSq(e.pos, p);
    if (d2 <= r * r && d2 < bestD2) {
      best = e;
      bestD2 = d2;
    }
  }
  return best;
}

export function unitsInRect(world: World, rect: Rect): Unit[] {
  const x0 = Math.min(rect.x0, rect.x1);
  const x1 = Math.max(rect.x0, rect.x1);
  const y0 = Math.min(rect.y0, rect.y1);
  const y1 = Math.max(rect.y0, rect.y1);
  const out: Unit[] = [];
  for (const e of world.entities.values()) {
    if (e.kind !== 'unit' || e.team !== 'player') continue;
    if (e.pos.x >= x0 && e.pos.x <= x1 && e.pos.y >= y0 && e.pos.y <= y1) out.push(e);
  }
  return out.sort((a, b) => a.id - b.id);
}

// Click selection: shift adds/toggles. Returns new selection ids.
export function clickSelect(
  world: World,
  p: Vec2,
  additive: boolean,
  current: number[]
): number[] {
  const e = entityAt(world, p);
  if (!e || (e.kind !== 'unit' && e.kind !== 'building') || e.team !== 'player') {
    return additive ? current : [];
  }
  if (!additive) return [e.id];
  if (current.includes(e.id)) return current.filter((id) => id !== e.id);
  return [...current, e.id];
}

// Double-click: select all player units of same type visible in the given rect.
export function doubleClickSelect(world: World, p: Vec2, viewRect: Rect): number[] {
  const e = entityAt(world, p);
  if (!e || e.kind !== 'unit' || e.team !== 'player') {
    return e && e.team === 'player' ? [e.id] : [];
  }
  const defId = e.defId;
  const x0 = Math.min(viewRect.x0, viewRect.x1);
  const x1 = Math.max(viewRect.x0, viewRect.x1);
  const y0 = Math.min(viewRect.y0, viewRect.y1);
  const y1 = Math.max(viewRect.y0, viewRect.y1);
  const out: number[] = [];
  for (const ent of world.entities.values()) {
    if (ent.kind !== 'unit' || ent.team !== 'player' || ent.defId !== defId) continue;
    if (ent.pos.x >= x0 && ent.pos.x <= x1 && ent.pos.y >= y0 && ent.pos.y <= y1) out.push(ent.id);
  }
  return out.sort((a, b) => a - b);
}

// Resolve a right-click into an order for the given unit. Returns null if the
// unit cannot do anything with this target (UI shows invalid-target feedback).
export function smartOrder(world: World, unit: Unit, target: Entity | null, point: Vec2): Order | null {
  const def = unitDef(unit.defId);
  if (target && target.kind !== 'node' && target.kind !== 'projectile' && target.team === 'enemy') {
    if (!def.attack) return null; // workers flee instead: move there
    return { type: 'attack', targetId: target.id };
  }
  if (target && target.kind === 'node') {
    if (def.harvest) return { type: 'harvest', targetId: target.id };
    return { type: 'move', targetPos: { ...point } };
  }
  if (target && target.kind === 'building' && target.team === 'player') {
    // continue constructing own unfinished building with a worker
    if (target.construction < 1 && def.harvest) {
      return { type: 'build', targetId: target.id, buildDefId: target.defId, targetPos: { ...target.pos } };
    }
    // patchwright repairs damaged friendlies
    if (def.repair && target.hp < target.maxHp) {
      return { type: 'repair', targetId: target.id };
    }
    return { type: 'move', targetPos: { ...point } };
  }
  if (target && target.kind === 'unit' && target.team === 'player' && target.id !== unit.id) {
    if (def.repair && target.hp < target.maxHp) return { type: 'repair', targetId: target.id };
    return { type: 'move', targetPos: { ...point } };
  }
  return { type: 'move', targetPos: { ...point } };
}

// Partition a mixed selection into subgroup buckets for Tab cycling:
// combat units first, then workers, then buildings — each grouped by defId.
export function subgroupOrder(world: World, ids: number[]): string[] {
  const defs = new Set<string>();
  const rank = (defId: string, kind: string): number => {
    if (kind === 'building') return 2;
    const def = unitDef(defId);
    return def.role === 'harvester' ? 1 : 0;
  };
  const entries: { defId: string; r: number }[] = [];
  for (const id of ids) {
    const e = world.entities.get(id);
    if (!e) continue;
    const key = e.kind + ':' + e.defId;
    if (defs.has(key)) continue;
    defs.add(key);
    entries.push({ defId: key, r: rank(e.defId, e.kind) });
  }
  entries.sort((a, b) => a.r - b.r || (a.defId < b.defId ? -1 : 1));
  return entries.map((e) => e.defId);
}

export function filterSubgroup(world: World, ids: number[], subgroupKey: string): number[] {
  return ids.filter((id) => {
    const e = world.entities.get(id);
    return e && e.kind + ':' + e.defId === subgroupKey;
  });
}

export function buildingHpFrac(b: Building): number {
  return Math.max(0, Math.min(1, b.hp / b.maxHp));
}

export { buildingDef };
