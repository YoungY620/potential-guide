// Player commands: validation (with UI-facing reasons) and application.
import { abilityDef } from './data/abilities';
import { buildingDef } from './data/buildings';
import { unitDef } from './data/units';
import { upgradeDef } from './data/upgrades';
import { isVisible } from './fog';
import { distSq } from './types';
import type { Building, Order, Unit, Vec2 } from './types';
import type { World } from './world';
import { placementValid } from './systems/orders';

export type PlayerCommand =
  | { type: 'order'; unitIds: number[]; order: Order; append: boolean }
  | { type: 'train'; buildingId: number; unitDefId: string }
  | { type: 'cancelTrain'; buildingId: number; index: number }
  | { type: 'research'; buildingId: number; upgradeId: string }
  | { type: 'placeBuilding'; builderIds: number[]; buildingDefId: string; pos: Vec2 }
  | { type: 'setRally'; buildingId: number; pos: Vec2 }
  | { type: 'castAbility'; abilityId: string; target: Vec2 };

export type CommandResult = { ok: true } | { ok: false; reason: string };

const fail = (reason: string): CommandResult => ({ ok: false, reason });
const ok: CommandResult = { ok: true };

export function canAfford(world: World, cost: { shards: number; flux: number }): boolean {
  const r = world.players.player.resources;
  return r.shards >= cost.shards && r.flux >= cost.flux;
}

export function pendingSupply(world: World): number {
  let pending = 0;
  for (const e of world.entities.values()) {
    if (e.kind === 'building' && e.team === 'player') {
      for (const item of e.productionQueue) pending += unitDef(item.defId).supply;
    }
  }
  return pending;
}

function hasCompleteBuilding(world: World, defId: string): boolean {
  for (const e of world.entities.values()) {
    if (e.kind === 'building' && e.team === 'player' && e.defId === defId && e.construction >= 1) {
      return true;
    }
  }
  return false;
}

export function validateTrain(world: World, buildingId: number, unitDefId: string): CommandResult {
  const e = world.entities.get(buildingId);
  if (!e || e.kind !== 'building' || e.team !== 'player') return fail('目标无效');
  if (e.construction < 1) return fail('建筑尚未完工');
  const bdef = buildingDef(e.defId);
  if (!bdef.trains?.includes(unitDefId)) return fail('目标无效');
  const udef = unitDef(unitDefId);
  for (const req of udef.requires ?? []) {
    if (!hasCompleteBuilding(world, req)) {
      return fail(`科技未解锁：需要 ${buildingDef(req).name}`);
    }
  }
  if (!canAfford(world, udef.cost)) return fail('资源不足');
  const ps = world.players.player;
  if (ps.supplyUsed + pendingSupply(world) + udef.supply > ps.supplyCap) return fail('容量不足：建造电容塔');
  if (e.productionQueue.length >= 5) return fail('队列已满');
  return ok;
}

export function validateResearch(
  world: World,
  buildingId: number,
  upgradeId: string
): CommandResult {
  const e = world.entities.get(buildingId);
  if (!e || e.kind !== 'building' || e.team !== 'player') return fail('目标无效');
  if (e.construction < 1) return fail('建筑尚未完工');
  if (!buildingDef(e.defId).researches?.includes(upgradeId)) return fail('目标无效');
  if (world.players.player.upgrades.has(upgradeId)) return fail('已完成该升级');
  if (e.research) return fail('研究进行中');
  if (!canAfford(world, upgradeDef(upgradeId).cost)) return fail('资源不足');
  return ok;
}

export function validatePlace(world: World, buildingDefId: string, pos: Vec2): CommandResult {
  const def = buildingDef(buildingDefId);
  for (const req of def.requires ?? []) {
    if (!hasCompleteBuilding(world, req)) return fail(`科技未解锁：需要 ${buildingDef(req).name}`);
  }
  if (!canAfford(world, def.cost)) return fail('资源不足');
  if (!placementValid(world, buildingDefId, pos)) return fail('目标无效：无法在此放置');
  return ok;
}

export function validateCast(world: World, abilityId: string, target: Vec2): CommandResult {
  const def = abilityDef(abilityId);
  if ((world.abilityCooldowns[abilityId] ?? 0) > 0) return fail('冷却中');
  if (!canAfford(world, def.cost)) return fail('资源不足（流能）');
  if (def.needsVision && !isVisible(world, target.x, target.y)) return fail('目标无效：需要视野');
  return ok;
}

function applyOrder(world: World, unitIds: number[], order: Order, append: boolean): void {
  for (const id of unitIds) {
    const e = world.entities.get(id);
    if (!e || e.kind !== 'unit' || e.team !== 'player') continue;
    const u = e as Unit;
    if (order.type === 'stop' && !append) {
      // stop is immediate: clear the whole queue now
      u.orders = [];
      u.targetId = null;
      u.path = [];
      u.pathIndex = 0;
      continue;
    }
    if (append) {
      u.orders.push({ ...order });
    } else {
      u.orders = [{ ...order }];
      u.targetId = null;
      u.path = [];
      u.pathIndex = 0;
      u.harvestTimer = 0;
    }
  }
}

function applyCast(world: World, abilityId: string, target: Vec2): void {
  const def = abilityDef(abilityId);
  const r = world.players.player.resources;
  r.shards -= def.cost.shards;
  r.flux -= def.cost.flux;
  world.abilityCooldowns[abilityId] = def.cooldown;
  world.events.push({ type: 'ability', pos: { ...target }, defId: abilityId });
  world.events.push({ type: 'explosion', pos: { ...target }, radius: def.radius });
  if (def.kind === 'emp') {
    const victims: Unit[] = [];
    world.hash.query(target, def.radius, (id) => {
      const e = world.entities.get(id);
      if (e && e.kind === 'unit' && e.team === 'enemy') victims.push(e);
    });
    for (const v of victims) {
      v.hp -= 40;
      v.stunTicks = 60; // 3s
      if (v.hp <= 0) {
        world.events.push({ type: 'death', pos: { ...v.pos }, defId: v.defId, team: v.team });
        world.entities.delete(v.id);
        world.supplyDirty = true;
      }
    }
  } else if (def.kind === 'heal') {
    for (const e of world.entities.values()) {
      if (e.kind === 'unit' && e.team === 'player') {
        if (distSq(e.pos, target) <= def.radius * def.radius) {
          e.hp = Math.min(e.maxHp, e.hp + 100);
        }
      }
    }
  }
}

export function applyCommand(world: World, cmd: PlayerCommand): CommandResult {
  switch (cmd.type) {
    case 'order': {
      applyOrder(world, cmd.unitIds, cmd.order, cmd.append);
      return ok;
    }
    case 'train': {
      const v = validateTrain(world, cmd.buildingId, cmd.unitDefId);
      if (!v.ok) return v;
      const b = world.entities.get(cmd.buildingId) as Building;
      const udef = unitDef(cmd.unitDefId);
      world.players.player.resources.shards -= udef.cost.shards;
      world.players.player.resources.flux -= udef.cost.flux;
      b.productionQueue.push({ defId: cmd.unitDefId, remaining: udef.buildTime, total: udef.buildTime });
      return ok;
    }
    case 'cancelTrain': {
      const e = world.entities.get(cmd.buildingId);
      if (!e || e.kind !== 'building') return fail('目标无效');
      const item = e.productionQueue[cmd.index];
      if (!item) return fail('目标无效');
      const udef = unitDef(item.defId);
      // refund proportional to remaining time
      const frac = item.remaining / item.total;
      world.players.player.resources.shards += Math.floor(udef.cost.shards * frac);
      world.players.player.resources.flux += Math.floor(udef.cost.flux * frac);
      e.productionQueue.splice(cmd.index, 1);
      return ok;
    }
    case 'research': {
      const v = validateResearch(world, cmd.buildingId, cmd.upgradeId);
      if (!v.ok) return v;
      const b = world.entities.get(cmd.buildingId) as Building;
      const udef = upgradeDef(cmd.upgradeId);
      world.players.player.resources.shards -= udef.cost.shards;
      world.players.player.resources.flux -= udef.cost.flux;
      b.research = { defId: cmd.upgradeId, remaining: udef.researchTime, total: udef.researchTime };
      return ok;
    }
    case 'placeBuilding': {
      const v = validatePlace(world, cmd.buildingDefId, cmd.pos);
      if (!v.ok) return v;
      // nearest builder takes the job
      let best: Unit | null = null;
      let bestD2 = Infinity;
      for (const id of cmd.builderIds) {
        const e = world.entities.get(id);
        if (!e || e.kind !== 'unit' || e.team !== 'player' || !unitDef(e.defId).harvest) continue;
        const d2 = distSq(e.pos, cmd.pos);
        if (d2 < bestD2) {
          best = e;
          bestD2 = d2;
        }
      }
      if (!best) return fail('目标无效：没有可用的接续者');
      // cost is deducted up-front (RTS convention); refunded if the site turns out invalid
      const def = buildingDef(cmd.buildingDefId);
      world.players.player.resources.shards -= def.cost.shards;
      world.players.player.resources.flux -= def.cost.flux;
      best.orders = [
        { type: 'build', targetPos: { ...cmd.pos }, buildDefId: cmd.buildingDefId }
      ];
      best.targetId = null;
      best.path = [];
      best.pathIndex = 0;
      return ok;
    }
    case 'setRally': {
      const e = world.entities.get(cmd.buildingId);
      if (!e || e.kind !== 'building') return fail('目标无效');
      e.rallyPoint = { ...cmd.pos };
      return ok;
    }
    case 'castAbility': {
      const v = validateCast(world, cmd.abilityId, cmd.target);
      if (!v.ok) return v;
      applyCast(world, cmd.abilityId, cmd.target);
      return ok;
    }
  }
}
