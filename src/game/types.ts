export type Vec2 = { x: number; y: number };
export type EntityId = number;
export type Team = 'player' | 'enemy' | 'neutral';

export const vec = (x: number, y: number): Vec2 => ({ x, y });
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const distSq = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

export type OrderType =
  | 'move'
  | 'attackMove'
  | 'attack'
  | 'harvest'
  | 'build'
  | 'repair'
  | 'hold'
  | 'patrol'
  | 'stop';

export type Order = {
  type: OrderType;
  targetPos?: Vec2;
  targetId?: EntityId;
  // For patrol: remember the anchor (the position where patrol was issued).
  anchorPos?: Vec2;
  // For build: the building definition to construct and placement.
  buildDefId?: string;
};

export type EntityKind = 'unit' | 'building' | 'node' | 'projectile';
export type Entity = Unit | Building | ResourceNode | Projectile;

export interface Unit {
  kind: 'unit';
  id: EntityId;
  defId: string;
  team: Team;
  pos: Vec2;
  prevPos: Vec2; // for render interpolation
  angle: number;
  hp: number;
  maxHp: number;
  orders: Order[];
  attackCooldown: number; // ticks until can attack again
  abilityCooldowns: Record<string, number>;
  cargoShards: number;
  cargoFlux: number;
  harvestNodeId: EntityId | null;
  harvestTimer: number;
  path: Vec2[];
  pathIndex: number;
  repathCooldown: number;
  // separation steering scratch (not serialized)
  sepX: number;
  sepY: number;
  stuckTicks: number;
  stunTicks: number;
  targetId: EntityId | null; // cached combat target
}

export type ProductionItem = { defId: string; remaining: number; total: number };

export interface Building {
  kind: 'building';
  id: EntityId;
  defId: string;
  team: Team;
  pos: Vec2; // center
  prevPos: Vec2;
  hp: number;
  maxHp: number;
  construction: number; // 0..1, 1 = complete
  builderId: EntityId | null;
  productionQueue: ProductionItem[];
  research: ProductionItem | null;
  rallyPoint: Vec2 | null;
  attackCooldown: number;
}

export type NodeType = 'shards' | 'flux';

export interface ResourceNode {
  kind: 'node';
  id: EntityId;
  defId: NodeType; // mirrors nodeType so generic code can read defId
  nodeType: NodeType;
  team: 'neutral';
  pos: Vec2;
  prevPos: Vec2;
  amount: number;
  maxAmount: number;
}

export interface Projectile {
  kind: 'projectile';
  id: EntityId;
  defId: string; // projectile visual id
  team: Team;
  pos: Vec2;
  prevPos: Vec2;
  targetPos: Vec2;
  targetId: EntityId | null;
  speed: number;
  damage: number;
  aoeRadius: number;
  sourceId: EntityId;
}

export type AlertKind = 'attack' | 'wave' | 'complete' | 'research' | 'resource';

export interface Alert {
  id: number;
  tick: number;
  pos: Vec2;
  kind: AlertKind;
  message: string;
}

// Events are consumed each rendered frame by the renderer/audio (fx, sounds).
export type GameEvent =
  | { type: 'shot'; pos: Vec2; defId: string; team: Team }
  | { type: 'hit'; pos: Vec2 }
  | { type: 'explosion'; pos: Vec2; radius: number }
  | { type: 'death'; pos: Vec2; defId: string; team: Team }
  | { type: 'buildComplete'; pos: Vec2; defId: string }
  | { type: 'trainComplete'; pos: Vec2; defId: string }
  | { type: 'researchComplete'; defId: string }
  | { type: 'ability'; pos: Vec2; defId: string }
  | { type: 'alert'; alert: Alert }
  | { type: 'harvest'; pos: Vec2 };

export interface PlayerState {
  resources: { shards: number; flux: number };
  supplyUsed: number;
  supplyCap: number;
  upgrades: Set<string>;
}

export type GameResult = 'victory' | 'defeat' | null;
