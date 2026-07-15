// Building systems: construction progress, training queues, research, turret fire.
import { buildingDef } from '../data/buildings';
import { unitDef } from '../data/units';
import type { Building, Entity, Vec2 } from '../types';
import { dist } from '../types';
import { recomputeSupply, spawnUnit, type World } from '../world';
import { acquireTargetNear } from './combat';
import { pushAlert } from './orders';
import { ensurePath } from './movement';

function footprintHalf(b: Building): number {
  return (buildingDef(b.defId).size * 32) / 2;
}

function updateConstruction(world: World, b: Building): void {
  const def = buildingDef(b.defId);
  const builder = b.builderId !== null ? world.entities.get(b.builderId) : undefined;
  const builderActive =
    builder &&
    builder.kind === 'unit' &&
    builder.orders[0]?.type === 'build' &&
    dist(builder.pos, b.pos) <= footprintHalf(b) + 100;
  if (!builderActive) return;
  b.construction = Math.min(1, b.construction + 1 / def.buildTime);
  b.hp = Math.max(1, Math.round(b.maxHp * (0.1 + 0.9 * b.construction)));
  if (b.construction >= 1) {
    b.hp = b.maxHp;
    world.events.push({ type: 'buildComplete', pos: { ...b.pos }, defId: b.defId });
    pushAlert(world, 'complete', b.pos, `${def.name} 建造完成`);
    recomputeSupply(world);
  }
}

function spawnTrainedUnit(world: World, b: Building, defId: string): void {
  const half = footprintHalf(b);
  // try a ring of spawn offsets until one paths successfully
  const candidates: Vec2[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    candidates.push({ x: b.pos.x + Math.cos(a) * (half + 30), y: b.pos.y + Math.sin(a) * (half + 30) });
  }
  let unit = null;
  for (const c of candidates) {
    unit = spawnUnit(world, defId, b.team, c);
    if (ensurePath(world, unit, { x: c.x + 1, y: c.y + 1 })) break;
  }
  if (!unit) return;
  if (b.rallyPoint) {
    unit.orders = [{ type: 'move', targetPos: { ...b.rallyPoint } }];
  }
  world.events.push({ type: 'trainComplete', pos: { ...unit.pos }, defId });
  pushAlert(world, 'complete', unit.pos, `${unitDef(defId).name} 训练完成`);
  recomputeSupply(world);
}

function updateProduction(world: World, b: Building): void {
  const item = b.productionQueue[0];
  if (!item) return;
  item.remaining--;
  if (item.remaining <= 0) {
    b.productionQueue.shift();
    spawnTrainedUnit(world, b, item.defId);
  }
}

function updateResearch(world: World, b: Building): void {
  const item = b.research;
  if (!item) return;
  item.remaining--;
  if (item.remaining > 0) return;
  b.research = null;
  world.players.player.upgrades.add(item.defId);
  if (item.defId === 'plating') {
    // apply immediately to existing player units
    for (const e of world.entities.values()) {
      if (e.kind === 'unit' && e.team === 'player') {
        const base = unitDef(e.defId).hp;
        const newMax = Math.round(base * 1.25);
        e.hp += newMax - e.maxHp;
        e.maxHp = newMax;
      }
    }
  }
  world.events.push({ type: 'researchComplete', defId: item.defId });
  pushAlert(world, 'research', b.pos, `升级完成`);
}

function updateTurret(world: World, b: Building): void {
  const def = buildingDef(b.defId);
  const atk = def.attack;
  if (!atk) return;
  b.attackCooldown = Math.max(0, b.attackCooldown - 1);
  if (b.attackCooldown > 0) return;
  const target = acquireTargetNear(world, b.pos, b.team, atk.range, false);
  if (!target) return;
  b.attackCooldown = atk.cooldown;
  const p = {
    kind: 'projectile' as const,
    id: world.nextId++,
    defId: atk.projectile ?? 'rail',
    team: b.team,
    pos: { ...b.pos },
    prevPos: { ...b.pos },
    targetPos: { ...target.pos },
    targetId: target.id,
    speed: 12,
    damage: atk.damage,
    aoeRadius: atk.aoe ?? 0,
    sourceId: b.id
  };
  world.entities.set(p.id, p);
  world.events.push({ type: 'shot', pos: { ...b.pos }, defId: b.defId, team: b.team });
}

export function updateBuildings(world: World): void {
  const buildings: Building[] = [];
  for (const e of world.entities.values()) {
    if (e.kind === 'building') buildings.push(e);
  }
  buildings.sort((a, b) => a.id - b.id);
  for (const b of buildings) {
    if (!world.entities.has(b.id)) continue;
    if (b.construction < 1) {
      updateConstruction(world, b);
      continue;
    }
    if (b.team === 'player') {
      updateProduction(world, b);
      updateResearch(world, b);
    }
    if (buildingDef(b.defId).attack) updateTurret(world, b);
  }
}

export type { Entity };
