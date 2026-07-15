// Fixed-step simulation entry: applies commands, runs systems in a deterministic
// order, and checks victory/defeat. 20 ticks per second, no wall-clock dependence.
import { applyCommand, type PlayerCommand } from './commands';
import { recomputeFog } from './fog';
import { updateWaves } from './ai';
import { updateProjectiles } from './systems/combat';
import { updateBuildings } from './systems/production';
import { updateUnitOrders } from './systems/orders';
import { recomputeSupply, type World } from './world';
import type { Unit } from './types';

export const TICKS_PER_SECOND = 20;

export function step(world: World, commands: PlayerCommand[]): void {
  if (world.result) return;
  world.tick++;

  for (const cmd of commands) applyCommand(world, cmd);

  // rebuild spatial hash (units only)
  world.hash.clear();
  for (const e of world.entities.values()) {
    if (e.kind === 'unit') world.hash.insert(e.id, e.pos);
  }

  updateWaves(world);

  // unit orders in deterministic id order; save prev positions first
  const units: Unit[] = [];
  for (const e of world.entities.values()) {
    if (e.kind === 'unit') units.push(e);
  }
  units.sort((a, b) => a.id - b.id);
  for (const u of units) {
    u.prevPos.x = u.pos.x;
    u.prevPos.y = u.pos.y;
  }
  for (const u of units) {
    if (world.entities.has(u.id)) updateUnitOrders(world, u);
  }

  updateBuildings(world);
  updateProjectiles(world);

  // ability cooldowns
  for (const key of Object.keys(world.abilityCooldowns)) {
    world.abilityCooldowns[key] = Math.max(0, world.abilityCooldowns[key] - 1);
  }

  if (world.supplyDirty) {
    recomputeSupply(world);
    world.supplyDirty = false;
  }

  if (world.tick % 2 === 0) recomputeFog(world);

  // prune old alerts (8s)
  while (world.alerts.length > 0 && world.tick - world.alerts[0].tick > 160) {
    world.alerts.shift();
  }

  checkResult(world);
}

function checkResult(world: World): void {
  if (world.result) return;
  let citadelAlive = false;
  let coreAlive = false;
  for (const e of world.entities.values()) {
    if (e.kind === 'building' && e.defId === 'citadel' && e.team === 'player') citadelAlive = true;
    if (e.kind === 'unit' && e.defId === 'invasion_core') coreAlive = true;
  }
  if (!citadelAlive) {
    world.result = 'defeat';
    return;
  }
  if (world.waves.coreSpawned && !coreAlive) {
    world.result = 'victory';
  }
}
