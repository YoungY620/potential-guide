// Combat: target acquisition, firing, projectiles, damage and death.
import { unitDef } from '../data/units';
import type { AttackDef } from '../data/units';
import { buildingDef } from '../data/buildings';
import { distSq } from '../types';
import type { Entity, Projectile, Team, Unit, Vec2 } from '../types';
import { removeEntity, spawnUnit, type World } from '../world';

export function targetRadius(e: Entity): number {
  if (e.kind === 'unit') return unitDef(e.defId).radius;
  if (e.kind === 'building') return (buildingDef(e.defId).size * 32) / 2;
  return 16;
}

// Nearest enemy unit/building within sight of (pos, team). Buildings can be preferred.
export function acquireTargetNear(
  world: World,
  pos: Vec2,
  team: Team,
  sight: number,
  prefersBuildings: boolean
): Entity | null {
  let best: Entity | null = null;
  let bestD2 = sight * sight;
  world.hash.query(pos, sight, (id, _dx, _dy, d2) => {
    if (d2 > bestD2) return;
    const e = world.entities.get(id);
    if (!e || e.kind !== 'unit' || e.team === team) return;
    best = e;
    bestD2 = d2;
  });
  if (!best || prefersBuildings) {
    for (const e of world.entities.values()) {
      if (e.kind !== 'building' || e.team === team) continue;
      const d2 = distSq(pos, e.pos);
      const limit = prefersBuildings ? sight * sight : bestD2;
      if (d2 < limit && (!prefersBuildings || d2 < bestD2 || !best)) {
        if (prefersBuildings || !best || d2 < bestD2) {
          best = e;
          bestD2 = d2;
        }
      }
    }
  }
  return best;
}

function fire(world: World, unit: Unit, target: Entity): void {
  const def = unitDef(unit.defId);
  const atk = def.attack!;
  const cdMult =
    unit.team === 'player' && world.players.player.upgrades.has('overclock') ? 0.8 : 1;
  unit.attackCooldown = Math.max(1, Math.round(atk.cooldown * cdMult));
  unit.angle = Math.atan2(target.pos.y - unit.pos.y, target.pos.x - unit.pos.x);
  world.events.push({ type: 'shot', pos: { ...unit.pos }, defId: unit.defId, team: unit.team });
  if (atk.projectile) {
    const p: Projectile = {
      kind: 'projectile',
      id: world.nextId++,
      defId: atk.projectile,
      team: unit.team,
      pos: { ...unit.pos },
      prevPos: { ...unit.pos },
      targetPos: { ...target.pos },
      targetId: target.id,
      speed: 11,
      damage: atk.damage,
      aoeRadius: atk.aoe ?? 0,
      sourceId: unit.id
    };
    world.entities.set(p.id, p);
  } else {
    applyDamage(world, target, atk.damage, atk);
  }
}

export function applyDamage(
  world: World,
  target: Entity,
  baseDamage: number,
  atk?: AttackDef
): void {
  if (target.kind === 'node' || target.kind === 'projectile') return;
  let dmg = baseDamage;
  if (target.kind === 'building' && atk?.vsBuildingMult) dmg *= atk.vsBuildingMult;
  target.hp -= dmg;
  world.events.push({ type: 'hit', pos: { ...target.pos } });
  if (target.hp <= 0) killEntity(world, target);
}

export function killEntity(world: World, e: Entity): void {
  if (e.kind === 'node' || e.kind === 'projectile') return;
  world.events.push({ type: 'death', pos: { ...e.pos }, defId: e.defId, team: e.team });
  world.events.push({
    type: 'explosion',
    pos: { ...e.pos },
    radius: e.kind === 'building' ? 90 : 40
  });
  if (e.kind === 'unit') {
    const def = unitDef(e.defId);
    if (def.onDeathSpawn) {
      for (let i = 0; i < def.onDeathSpawn.count; i++) {
        const angle = (i / def.onDeathSpawn.count) * Math.PI * 2;
        const child = spawnUnit(world, def.onDeathSpawn.defId, e.team, {
          x: e.pos.x + Math.cos(angle) * 18,
          y: e.pos.y + Math.sin(angle) * 18
        });
        // inherit parent orders so spawned mites keep pushing
        child.orders = e.orders.map((o) => ({ ...o }));
      }
    }
  }
  removeEntity(world, e.id);
  world.supplyDirty = true;
}

// Chase-and-attack behavior shared by attack/attackMove/hold/idle.
// Returns true when the target is within weapon reach (caller holds position);
// false means out of range — caller should pursue if the order allows it.
export function engage(world: World, unit: Unit, target: Entity): boolean {
  const def = unitDef(unit.defId);
  const atk = def.attack;
  if (!atk) return true;
  const reach = atk.range + targetRadius(target);
  const d2 = distSq(unit.pos, target.pos);
  if (d2 <= reach * reach) {
    unit.angle = Math.atan2(target.pos.y - unit.pos.y, target.pos.x - unit.pos.x);
    if (unit.attackCooldown <= 0 && unit.stunTicks <= 0) fire(world, unit, target);
    return true;
  }
  return false;
}

export function updateProjectiles(world: World): void {
  const projectiles: Projectile[] = [];
  for (const e of world.entities.values()) {
    if (e.kind === 'projectile') projectiles.push(e);
  }
  projectiles.sort((a, b) => a.id - b.id);
  for (const p of projectiles) {
    if (!world.entities.has(p.id)) continue;
    const target = p.targetId !== null ? world.entities.get(p.targetId) : undefined;
    if (target && (target.kind === 'unit' || target.kind === 'building')) {
      p.targetPos = { ...target.pos };
    }
    p.prevPos = { ...p.pos };
    const dx = p.targetPos.x - p.pos.x;
    const dy = p.targetPos.y - p.pos.y;
    const d = Math.hypot(dx, dy);
    if (d <= Math.max(10, p.speed)) {
      impact(world, p, target ?? null);
      world.entities.delete(p.id);
      continue;
    }
    p.pos.x += (dx / d) * p.speed;
    p.pos.y += (dy / d) * p.speed;
  }
}

function impact(world: World, p: Projectile, target: Entity | null): void {
  if (p.aoeRadius > 0) {
    const victims: Entity[] = [];
    world.hash.query(p.targetPos, p.aoeRadius, (id, _dx, _dy, d2) => {
      const e = world.entities.get(id);
      if (!e || e.kind !== 'unit' || e.team === p.team) return;
      victims.push(e);
    });
    // buildings inside small aoe also take damage
    if (p.aoeRadius >= 60) {
      for (const e of world.entities.values()) {
        if (e.kind === 'building' && e.team !== p.team) {
          if (distSq(e.pos, p.targetPos) <= p.aoeRadius * p.aoeRadius) victims.push(e);
        }
      }
    }
    for (const v of victims) applyDamage(world, v, p.damage);
    world.events.push({ type: 'explosion', pos: { ...p.targetPos }, radius: p.aoeRadius });
  } else if (target && (target.kind === 'unit' || target.kind === 'building')) {
    applyDamage(world, target, p.damage);
  }
}
