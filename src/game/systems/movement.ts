// Unit movement: path assignment, waypoint following, separation steering.
import { findPath } from '../pathfinding';
import { MAP_PX, worldToTile } from '../map';
import { tileIndex } from '../map';
import { unitDef } from '../data/units';
import type { Unit, Vec2 } from '../types';
import type { World } from '../world';

export function ensurePath(world: World, unit: Unit, dest: Vec2, force = false): boolean {
  if (unit.repathCooldown > 0 && !force) {
    // keep existing path if it still ends near dest
    const end = unit.path[unit.path.length - 1];
    if (end && Math.hypot(end.x - dest.x, end.y - dest.y) < 24 && unit.pathIndex < unit.path.length) {
      return true;
    }
  }
  const end = unit.path[unit.path.length - 1];
  if (
    !force &&
    end &&
    Math.hypot(end.x - dest.x, end.y - dest.y) < 24 &&
    unit.pathIndex < unit.path.length
  ) {
    return true;
  }
  const path = findPath(world.grid, unit.pos, dest);
  if (!path) return false;
  unit.path = path;
  unit.pathIndex = 0;
  unit.repathCooldown = 20;
  return true;
}

function gridBlockedAt(world: World, x: number, y: number): boolean {
  const { tx, ty } = worldToTile(x, y);
  return world.grid[tileIndex(tx, ty)] === 1;
}

// Follow current path with separation. Returns true when final waypoint reached.
export function followPath(world: World, unit: Unit): boolean {
  const def = unitDef(unit.defId);
  if (unit.pathIndex >= unit.path.length) return true;
  const wp = unit.path[unit.pathIndex];
  const dx = wp.x - unit.pos.x;
  const dy = wp.y - unit.pos.y;
  const d = Math.hypot(dx, dy);
  if (d < 10) {
    unit.pathIndex++;
    return unit.pathIndex >= unit.path.length;
  }
  let vx = (dx / d) * def.speed + unit.sepX;
  let vy = (dy / d) * def.speed + unit.sepY;
  const speed = Math.hypot(vx, vy);
  const maxSpeed = def.speed * 1.35;
  if (speed > maxSpeed) {
    vx = (vx / speed) * maxSpeed;
    vy = (vy / speed) * maxSpeed;
  }
  let nx = unit.pos.x + vx;
  let ny = unit.pos.y + vy;
  // slide along blocked tiles — but never trap a unit already inside a blocked tile
  if (!gridBlockedAt(world, unit.pos.x, unit.pos.y) && gridBlockedAt(world, nx, ny)) {
    if (!gridBlockedAt(world, nx, unit.pos.y)) {
      ny = unit.pos.y;
    } else if (!gridBlockedAt(world, unit.pos.x, ny)) {
      nx = unit.pos.x;
    } else {
      nx = unit.pos.x;
      ny = unit.pos.y;
    }
  }
  nx = Math.max(8, Math.min(MAP_PX - 8, nx));
  ny = Math.max(8, Math.min(MAP_PX - 8, ny));
  unit.angle = Math.atan2(ny - unit.pos.y, nx - unit.pos.x);
  unit.pos.x = nx;
  unit.pos.y = ny;
  return false;
}

// Separation steering: push away from nearby units. Uses last tick's hash.
export function computeSeparation(world: World, unit: Unit): void {
  const def = unitDef(unit.defId);
  unit.sepX = 0;
  unit.sepY = 0;
  const range = def.radius + 26;
  let count = 0;
  world.hash.query(unit.pos, range, (id, dx, dy, d2) => {
    if (id === unit.id || d2 < 0.01) return;
    const other = world.entities.get(id);
    if (!other || other.kind !== 'unit') return;
    const otherDef = unitDef(other.defId);
    const minD = def.radius + otherDef.radius;
    if (d2 >= minD * minD) return;
    const d = Math.sqrt(d2);
    const push = ((minD - d) / minD) * 1.4;
    unit.sepX -= (dx / d) * push;
    unit.sepY -= (dy / d) * push;
    count++;
  });
  if (count > 0) {
    const mag = Math.hypot(unit.sepX, unit.sepY);
    const cap = 1.6;
    if (mag > cap) {
      unit.sepX = (unit.sepX / mag) * cap;
      unit.sepY = (unit.sepY / mag) * cap;
    }
  }
}

// Stuck detection: call once per tick after movement intent. Returns true if stuck long enough to repath.
export function updateStuck(world: World, unit: Unit, intendsMove: boolean): boolean {
  if (!intendsMove) {
    unit.stuckTicks = 0;
    return false;
  }
  const moved = Math.hypot(unit.pos.x - unit.prevPos.x, unit.pos.y - unit.prevPos.y);
  if (moved < 0.35) {
    unit.stuckTicks++;
  } else {
    unit.stuckTicks = 0;
  }
  if (unit.stuckTicks >= 30) {
    unit.stuckTicks = 0;
    return true;
  }
  return false;
}
