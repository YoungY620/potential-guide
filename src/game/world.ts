// World state: creation, entity spawning, dynamic walk grid, supply accounting.
import { UNITS, unitDef } from './data/units';
import { BUILDINGS, buildingDef } from './data/buildings';
import { buildMap, MAP_PX, MAP_TILES, TILE_SIZE, tileIndex, worldToTile, type GameMapDef } from './map';
import { createRng, type Rng } from './rng';
import { SpatialHash } from './spatial';
import type {
  Alert,
  Building,
  Entity,
  EntityId,
  GameEvent,
  GameResult,
  PlayerState,
  ResourceNode,
  Team,
  Unit,
  Vec2
} from './types';

export interface WaveSpawn {
  atTick: number;
  lane: number;
  composition: { defId: string; count: number }[];
  adaptive: boolean;
  announced: boolean;
  label: string;
}

export interface WaveState {
  schedule: WaveSpawn[];
  adaptationPicks: number; // how many adaptive waves have resolved (for tests)
  coreSpawned: boolean;
  trickleTimer: number;
}

export interface World {
  tick: number;
  seed: number;
  rng: Rng;
  map: GameMapDef;
  grid: Uint8Array; // dynamic walk grid: ridges + building footprints (1 = blocked)
  entities: Map<EntityId, Entity>;
  nextId: number;
  players: { player: PlayerState; enemy: PlayerState };
  abilityCooldowns: Record<string, number>;
  fogVisible: Uint8Array;
  fogExplored: Uint8Array;
  waves: WaveState;
  alerts: Alert[];
  nextAlertId: number;
  events: GameEvent[];
  result: GameResult;
  hash: SpatialHash; // rebuilt each tick with all units
  threatLevel: number; // 0..4 for UI
  nextWaveEta: number; // ticks until next scheduled wave (Infinity if none)
  supplyDirty: boolean;
}

export function spawnUnit(world: World, defId: string, team: Team, pos: Vec2): Unit {
  const def = unitDef(defId);
  const hpMult =
    team === 'player' && world.players.player.upgrades.has('plating') ? 1.25 : 1;
  const unit: Unit = {
    kind: 'unit',
    id: world.nextId++,
    defId,
    team,
    pos: { ...pos },
    prevPos: { ...pos },
    angle: 0,
    hp: Math.round(def.hp * hpMult),
    maxHp: Math.round(def.hp * hpMult),
    orders: [],
    attackCooldown: 0,
    abilityCooldowns: {},
    cargoShards: 0,
    cargoFlux: 0,
    harvestNodeId: null,
    harvestTimer: 0,
    path: [],
    pathIndex: 0,
    repathCooldown: 0,
    sepX: 0,
    sepY: 0,
    stuckTicks: 0,
    stunTicks: 0,
    targetId: null
  };
  world.entities.set(unit.id, unit);
  return unit;
}

export function buildingFootprintTiles(
  defId: string,
  center: Vec2
): { tx0: number; ty0: number; tx1: number; ty1: number } {
  const def = buildingDef(defId);
  const half = (def.size * TILE_SIZE) / 2;
  const tl = worldToTile(center.x - half + 1, center.y - half + 1);
  const br = worldToTile(center.x + half - 1, center.y + half - 1);
  return { tx0: tl.tx, ty0: tl.ty, tx1: br.tx, ty1: br.ty };
}

export function blockFootprint(world: World, defId: string, center: Vec2, value: 0 | 1): void {
  const { tx0, ty0, tx1, ty1 } = buildingFootprintTiles(defId, center);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (tx >= 0 && ty >= 0 && tx < MAP_TILES && ty < MAP_TILES) {
        world.grid[tileIndex(tx, ty)] = value;
      }
    }
  }
}

export function spawnBuilding(
  world: World,
  defId: string,
  team: Team,
  center: Vec2,
  complete: boolean
): Building {
  const def = buildingDef(defId);
  const b: Building = {
    kind: 'building',
    id: world.nextId++,
    defId,
    team,
    pos: { ...center },
    prevPos: { ...center },
    hp: def.hp,
    maxHp: def.hp,
    construction: complete ? 1 : 0,
    builderId: null,
    productionQueue: [],
    research: null,
    rallyPoint: null,
    attackCooldown: 0
  };
  world.entities.set(b.id, b);
  blockFootprint(world, defId, center, 1);
  return b;
}

export function spawnNode(
  world: World,
  nodeType: 'shards' | 'flux',
  pos: Vec2,
  amount: number
): ResourceNode {
  const node: ResourceNode = {
    kind: 'node',
    id: world.nextId++,
    defId: nodeType,
    nodeType,
    team: 'neutral',
    pos: { ...pos },
    prevPos: { ...pos },
    amount,
    maxAmount: amount
  };
  world.entities.set(node.id, node);
  return node;
}

export function recomputeSupply(world: World): void {
  let used = 0;
  let cap = 0;
  for (const e of world.entities.values()) {
    if (e.kind === 'unit' && e.team === 'player') {
      used += unitDef(e.defId).supply;
    } else if (e.kind === 'building' && e.team === 'player' && e.construction >= 1) {
      cap += buildingDef(e.defId).supplyProvided ?? 0;
    }
  }
  world.players.player.supplyUsed = used;
  world.players.player.supplyCap = Math.max(cap, 0);
}

export function removeEntity(world: World, id: EntityId): void {
  const e = world.entities.get(id);
  if (!e) return;
  if (e.kind === 'building') {
    blockFootprint(world, e.defId, e.pos, 0);
  }
  world.entities.delete(id);
}

function generateSchedule(rng: Rng): WaveSpawn[] {
  const W = (
    atSec: number,
    lane: number,
    comp: [string, number][],
    adaptive = false,
    label = ''
  ): WaveSpawn => ({
    atTick: atSec * 20,
    lane,
    composition: comp.map(([defId, count]) => ({ defId, count })),
    adaptive,
    announced: false,
    label
  });
  const laneA = rng.int(0, 2);
  const laneB = rng.int(0, 2);
  return [
    W(60, laneA, [['mite', 4]], false, '侦察波'),
    W(130, laneB, [['mite', 6], ['spitter', 2]], false, '试探波'),
    W(210, rng.int(0, 2), [['mite', 8], ['spitter', 3], ['leech', 1]], false, '骚扰波'),
    W(290, rng.int(0, 2), [], true, '适应波 I'),
    W(380, rng.int(0, 2), [['mite', 10], ['spitter', 4], ['leech', 2], ['carrier', 1]], false, '突击波'),
    W(470, rng.int(0, 2), [['ravager', 1], ['mite', 6], ['spitter', 2]], false, '精英波'),
    W(550, rng.int(0, 2), [], true, '适应波 II'),
    W(630, rng.int(0, 2), [['ravager', 2], ['carrier', 1], ['spitter', 4], ['mite', 8]], false, '总攻前哨'),
    W(700, rng.int(0, 2), [['invasion_core', 1], ['ravager', 1], ['carrier', 1], ['spitter', 3], ['mite', 6]], false, '最终入侵')
  ];
}

export function createWorld(seed: number): World {
  const rng = createRng(seed);
  const map = buildMap();
  const world: World = {
    tick: 0,
    seed,
    rng,
    map,
    grid: new Uint8Array(map.blocked),
    entities: new Map(),
    nextId: 1,
    players: {
      player: {
        resources: { shards: 250, flux: 50 },
        supplyUsed: 0,
        supplyCap: 0,
        upgrades: new Set<string>()
      },
      enemy: {
        resources: { shards: 0, flux: 0 },
        supplyUsed: 0,
        supplyCap: 0,
        upgrades: new Set<string>()
      }
    },
    abilityCooldowns: {},
    fogVisible: new Uint8Array(MAP_TILES * MAP_TILES),
    fogExplored: new Uint8Array(MAP_TILES * MAP_TILES),
    waves: {
      schedule: generateSchedule(rng),
      adaptationPicks: 0,
      coreSpawned: false,
      trickleTimer: 240 * 20
    },
    alerts: [],
    nextAlertId: 1,
    events: [],
    result: null,
    hash: new SpatialHash(MAP_PX, 64),
    threatLevel: 0,
    nextWaveEta: Infinity,
    supplyDirty: false
  };

  // player base
  const basePos = {
    x: map.playerBase.tx * TILE_SIZE + TILE_SIZE / 2,
    y: map.playerBase.ty * TILE_SIZE + TILE_SIZE / 2
  };
  spawnBuilding(world, 'citadel', 'player', basePos, true);
  const splicerSpots: Vec2[] = [
    { x: basePos.x + 130, y: basePos.y - 60 },
    { x: basePos.x + 150, y: basePos.y - 20 },
    { x: basePos.x + 140, y: basePos.y + 30 },
    { x: basePos.x + 100, y: basePos.y + 70 },
    { x: basePos.x + 60, y: basePos.y + 90 },
    { x: basePos.x + 110, y: basePos.y - 100 }
  ];
  for (const p of splicerSpots) spawnUnit(world, 'splicer', 'player', p);

  // enemy spawn node
  const spawnerPos = {
    x: map.enemySpawner.tx * TILE_SIZE + TILE_SIZE / 2,
    y: map.enemySpawner.ty * TILE_SIZE + TILE_SIZE / 2
  };
  spawnBuilding(world, 'spawner', 'enemy', spawnerPos, true);

  // resource nodes
  for (const n of map.nodes) {
    spawnNode(world, n.nodeType, { x: n.tx * TILE_SIZE + 16, y: n.ty * TILE_SIZE + 16 }, n.amount);
  }

  recomputeSupply(world);
  return world;
}

export function entitiesOf(world: World): Entity[] {
  return [...world.entities.values()];
}

export { UNITS, BUILDINGS };
