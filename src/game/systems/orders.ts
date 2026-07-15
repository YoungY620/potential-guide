// Per-unit order state machine: move, attack-move, attack, harvest cycle,
// build channel, repair channel, patrol, hold, stop, and idle auto-acquire.
import { unitDef } from '../data/units';
import { buildingDef } from '../data/buildings';
import { dist, distSq } from '../types';
import type { Building, Entity, Order, ResourceNode, Unit, Vec2 } from '../types';
import { recomputeSupply, spawnBuilding, type World } from '../world';
import { acquireTargetNear, applyDamage, engage, targetRadius } from './combat';
import { computeSeparation, ensurePath, followPath, updateStuck } from './movement';

const BUILD_ARRIVE = 90;

export function pushAlert(
  world: World,
  kind: 'attack' | 'wave' | 'complete' | 'research' | 'resource',
  pos: Vec2,
  message: string
): void {
  const alert = { id: world.nextAlertId++, tick: world.tick, pos: { ...pos }, kind, message };
  world.alerts.push(alert);
  world.events.push({ type: 'alert', alert });
}

// Move toward dest using pathing. Returns true when within arriveDist.
export function moveToward(world: World, unit: Unit, dest: Vec2, arriveDist: number): boolean {
  if (dist(unit.pos, dest) <= arriveDist) return true;
  if (!ensurePath(world, unit, dest)) {
    // destination unreachable: get as close as the grid allows
    return true;
  }
  followPath(world, unit);
  return dist(unit.pos, dest) <= arriveDist;
}

function popOrder(unit: Unit): void {
  unit.orders.shift();
  unit.targetId = null;
  unit.path = [];
  unit.pathIndex = 0;
}

function nearestCitadel(world: World, unit: Unit): Building | null {
  let best: Building | null = null;
  let bestD2 = Infinity;
  for (const e of world.entities.values()) {
    if (e.kind === 'building' && e.defId === 'citadel' && e.team === unit.team && e.construction >= 1) {
      const d2 = distSq(unit.pos, e.pos);
      if (d2 < bestD2) {
        best = e;
        bestD2 = d2;
      }
    }
  }
  return best;
}

function nearestNode(world: World, unit: Unit, nodeType: 'shards' | 'flux' | null): ResourceNode | null {
  let best: ResourceNode | null = null;
  let bestD2 = Infinity;
  for (const e of world.entities.values()) {
    if (e.kind !== 'node' || e.amount <= 0) continue;
    if (nodeType && e.nodeType !== nodeType) continue;
    const d2 = distSq(unit.pos, e.pos);
    if (d2 < bestD2) {
      best = e;
      bestD2 = d2;
    }
  }
  return best;
}

function harvestCycle(world: World, unit: Unit, order: Order): void {
  const def = unitDef(unit.defId);
  const harvest = def.harvest;
  if (!harvest) {
    popOrder(unit);
    return;
  }
  const cargo = unit.cargoShards + unit.cargoFlux;
  if (cargo >= harvest.capacity) {
    // return cargo
    const citadel = nearestCitadel(world, unit);
    if (!citadel) {
      popOrder(unit);
      return;
    }
    if (moveToward(world, unit, citadel.pos, targetRadius(citadel) + 26)) {
      if (unit.cargoShards > 0) world.players.player.resources.shards += unit.cargoShards;
      if (unit.cargoFlux > 0) world.players.player.resources.flux += unit.cargoFlux;
      unit.cargoShards = 0;
      unit.cargoFlux = 0;
      world.events.push({ type: 'harvest', pos: { ...unit.pos } });
    }
    return;
  }
  let node = order.targetId !== undefined ? world.entities.get(order.targetId) : undefined;
  if (!node || node.kind !== 'node' || node.amount <= 0) {
    const prevType = node && node.kind === 'node' ? node.nodeType : null;
    const next = nearestNode(world, unit, prevType);
    if (!next) {
      popOrder(unit);
      return;
    }
    order.targetId = next.id;
    node = next;
  }
  const n = node as ResourceNode;
  if (moveToward(world, unit, n.pos, 30)) {
    unit.harvestTimer++;
    if (unit.harvestTimer >= harvest.interval) {
      unit.harvestTimer = 0;
      const space = harvest.capacity - (unit.cargoShards + unit.cargoFlux);
      const take = Math.min(harvest.amount, n.amount, space);
      if (take > 0) {
        n.amount -= take;
        if (n.nodeType === 'shards') unit.cargoShards += take;
        else unit.cargoFlux += take;
        world.events.push({ type: 'harvest', pos: { ...n.pos } });
      }
    }
  }
}

function buildCycle(world: World, unit: Unit, order: Order): void {
  if (order.targetId !== undefined) {
    const b = world.entities.get(order.targetId);
    if (!b || b.kind !== 'building' || b.construction >= 1) {
      popOrder(unit);
      return;
    }
    moveToward(world, unit, b.pos, BUILD_ARRIVE);
    return; // construction progress handled in production system
  }
  const defId = order.buildDefId!;
  const pos = order.targetPos!;
  if (moveToward(world, unit, pos, BUILD_ARRIVE)) {
    // cost was paid at issue time; only re-validate the site on arrival
    const def = buildingDef(defId);
    if (!placementValid(world, defId, pos)) {
      const res = world.players.player.resources;
      res.shards += def.cost.shards;
      res.flux += def.cost.flux;
      pushAlert(world, 'complete', pos, `无法建造 ${def.name}：位置被占用（已退款）`);
      popOrder(unit);
      return;
    }
    const b = spawnBuilding(world, defId, unit.team, pos, false);
    b.builderId = unit.id;
    order.targetId = b.id;
  }
}

function repairCycle(world: World, unit: Unit, order: Order): void {
  const def = unitDef(unit.defId);
  const rep = def.repair;
  if (!rep || order.targetId === undefined) {
    popOrder(unit);
    return;
  }
  const target = world.entities.get(order.targetId);
  if (!target || (target.kind !== 'unit' && target.kind !== 'building')) {
    popOrder(unit);
    return;
  }
  if (target.hp >= target.maxHp) {
    popOrder(unit);
    return;
  }
  if (moveToward(world, unit, target.pos, rep.range)) {
    unit.harvestTimer++;
    if (unit.harvestTimer >= rep.interval) {
      unit.harvestTimer = 0;
      target.hp = Math.min(target.maxHp, target.hp + rep.rate);
      world.events.push({ type: 'hit', pos: { ...target.pos } });
    }
  }
}

function attackMoveCycle(world: World, unit: Unit, order: Order): void {
  const def = unitDef(unit.defId);
  // validate cached target
  let target: Entity | null = null;
  if (unit.targetId !== null) {
    const t = world.entities.get(unit.targetId);
    if (t && (t.kind === 'unit' || t.kind === 'building') && t.team !== unit.team) target = t;
    else unit.targetId = null;
  }
  if (!target && def.attack && (world.tick + unit.id) % 6 === 0) {
    const found = acquireTargetNear(world, unit.pos, unit.team, def.sight, !!def.attack.prefersBuildings);
    if (found) unit.targetId = found.id;
    target = found;
  }
  if (target) {
    const inRange = engage(world, unit, target);
    if (!inRange) {
      moveToward(world, unit, target.pos, 4);
    }
    return;
  }
  const dest = order.targetPos!;
  if (moveToward(world, unit, dest, 14)) {
    if (order.type === 'patrol' && order.anchorPos) {
      const tmp = order.targetPos!;
      order.targetPos = order.anchorPos;
      order.anchorPos = tmp;
      unit.path = [];
      unit.pathIndex = 0;
    } else {
      popOrder(unit);
    }
  }
}

function attackCycle(world: World, unit: Unit, order: Order): void {
  const target = order.targetId !== undefined ? world.entities.get(order.targetId) : undefined;
  if (!target || (target.kind !== 'unit' && target.kind !== 'building')) {
    popOrder(unit);
    return;
  }
  const inRange = engage(world, unit, target);
  if (!inRange) moveToward(world, unit, target.pos, 4);
}

function holdCycle(world: World, unit: Unit): void {
  const def = unitDef(unit.defId);
  if (!def.attack) return;
  let target: Entity | null = null;
  if (unit.targetId !== null) {
    const t = world.entities.get(unit.targetId);
    if (t && (t.kind === 'unit' || t.kind === 'building') && t.team !== unit.team) target = t;
    else unit.targetId = null;
  }
  if (!target && (world.tick + unit.id) % 6 === 0) {
    const found = acquireTargetNear(world, unit.pos, unit.team, def.attack.range + 40, false);
    if (found) unit.targetId = found.id;
    target = found;
  }
  if (target) {
    if (!engage(world, unit, target)) unit.targetId = null; // no chasing on hold
  }
}

function idleCycle(world: World, unit: Unit): void {
  const def = unitDef(unit.defId);
  if (!def.attack || unit.team === 'enemy') return;
  let target: Entity | null = null;
  if (unit.targetId !== null) {
    const t = world.entities.get(unit.targetId);
    if (t && (t.kind === 'unit' || t.kind === 'building') && t.team !== unit.team) target = t;
    else unit.targetId = null;
  }
  if (!target && (world.tick + unit.id) % 8 === 0) {
    const found = acquireTargetNear(world, unit.pos, unit.team, def.sight, false);
    if (found) unit.targetId = found.id;
    target = found;
  }
  if (target) {
    const inRange = engage(world, unit, target);
    if (!inRange) moveToward(world, unit, target.pos, 4);
    // leash: give up if dragged too far from where we idled — skip for simplicity
  }
}

export function updateUnitOrders(world: World, unit: Unit): void {
  unit.attackCooldown = Math.max(0, unit.attackCooldown - 1);
  unit.repathCooldown = Math.max(0, unit.repathCooldown - 1);
  if (unit.stunTicks > 0) {
    unit.stunTicks--;
    return;
  }
  computeSeparation(world, unit);
  const order = unit.orders[0];
  const movedIntent = !!order && order.type !== 'hold' && order.type !== 'stop';
  switch (order?.type) {
    case undefined:
      idleCycle(world, unit);
      break;
    case 'move':
      if (moveToward(world, unit, order.targetPos!, 10)) popOrder(unit);
      break;
    case 'attackMove':
    case 'patrol':
      attackMoveCycle(world, unit, order);
      break;
    case 'attack':
      attackCycle(world, unit, order);
      break;
    case 'harvest':
      harvestCycle(world, unit, order);
      break;
    case 'build':
      buildCycle(world, unit, order);
      break;
    case 'repair':
      repairCycle(world, unit, order);
      break;
    case 'hold':
      holdCycle(world, unit);
      break;
    case 'stop':
      unit.orders = [];
      unit.targetId = null;
      break;
  }
  if (updateStuck(world, unit, movedIntent)) {
    const o = unit.orders[0];
    const dest = o?.targetPos ?? (o?.targetId !== undefined ? world.entities.get(o.targetId)?.pos : undefined);
    if (dest) ensurePath(world, unit, dest, true);
  }
}

// Placement validity: all footprint tiles walkable and no overlap with other buildings.
export function placementValid(world: World, defId: string, center: Vec2): boolean {
  const def = buildingDef(defId);
  const half = (def.size * 32) / 2;
  const x0 = Math.floor((center.x - half) / 32);
  const y0 = Math.floor((center.y - half) / 32);
  const x1 = Math.floor((center.x + half - 1) / 32);
  const y1 = Math.floor((center.y + half - 1) / 32);
  if (x0 < 0 || y0 < 0 || x1 >= world.map.width || y1 >= world.map.height) return false;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (world.grid[ty * world.map.width + tx] !== 0) return false;
    }
  }
  // reject overlap with resource nodes (they are not in the grid)
  for (const e of world.entities.values()) {
    if (e.kind !== 'node') continue;
    if (Math.abs(e.pos.x - center.x) < half + 16 && Math.abs(e.pos.y - center.y) < half + 16) {
      return false;
    }
  }
  return true;
}

export { recomputeSupply, applyDamage };
