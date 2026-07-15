// Data-driven unit definitions. All stats in fixed-point sim units:
// distances in world px, times in ticks (20 ticks = 1 second).

export type Faction = 'warden' | 'phage';
export type UnitRole = 'harvester' | 'combat' | 'support';

export interface AttackDef {
  damage: number;
  range: number;
  cooldown: number; // ticks between attacks
  aoe?: number; // splash radius in px
  projectile?: string; // projectile visual id; undefined = melee/instant
  vsBuildingMult?: number; // damage multiplier vs buildings
  prefersBuildings?: boolean;
}

export interface UnitDef {
  id: string;
  name: string;
  faction: Faction;
  role: UnitRole;
  desc: string;
  cost: { shards: number; flux: number };
  supply: number;
  buildTime: number; // ticks
  hp: number;
  speed: number; // px per tick
  radius: number; // collision radius px
  sight: number; // fog reveal radius px
  attack?: AttackDef;
  repair?: { rate: number; range: number; interval: number };
  harvest?: { amount: number; interval: number; capacity: number };
  requires?: string[]; // completed building defIds required to train
  builtAt?: string; // building defId that trains this unit
  onDeathSpawn?: { defId: string; count: number };
  hotkey: string;
}

export const UNITS: Record<string, UnitDef> = {
  // ---- Warden (player, 秩序机器) ----
  splicer: {
    id: 'splicer',
    name: '接续者',
    faction: 'warden',
    role: 'harvester',
    desc: '采集数据晶片与流能的工程机体，可建造与修复建筑。',
    cost: { shards: 50, flux: 0 },
    supply: 1,
    buildTime: 240, // 12s
    hp: 60,
    speed: 2.6,
    radius: 12,
    sight: 220,
    attack: { damage: 4, range: 46, cooldown: 20 },
    harvest: { amount: 8, interval: 40, capacity: 40 },
    builtAt: 'citadel',
    hotkey: 'S'
  },
  sentinel: {
    id: 'sentinel',
    name: '哨卫',
    faction: 'warden',
    role: 'combat',
    desc: '标准防线机体，中程磁轨射击，性价比均衡。',
    cost: { shards: 100, flux: 0 },
    supply: 2,
    buildTime: 400, // 20s
    hp: 120,
    speed: 2.4,
    radius: 14,
    sight: 300,
    attack: { damage: 10, range: 150, cooldown: 16, projectile: 'rail' },
    builtAt: 'fabricator',
    hotkey: 'A'
  },
  bulwark: {
    id: 'bulwark',
    name: '壁垒',
    faction: 'warden',
    role: 'combat',
    desc: '重型近战装甲机体，以撞锤撕碎逼近的入侵体。',
    cost: { shards: 150, flux: 50 },
    supply: 3,
    buildTime: 560, // 28s
    hp: 380,
    speed: 1.7,
    radius: 20,
    sight: 260,
    attack: { damage: 26, range: 40, cooldown: 24 },
    builtAt: 'fabricator',
    hotkey: 'D'
  },
  arccaster: {
    id: 'arccaster',
    name: '弧光投射者',
    faction: 'warden',
    role: 'combat',
    desc: '远程范围伤害炮机，电弧落点成片清除弱小敌体。',
    cost: { shards: 125, flux: 100 },
    supply: 3,
    buildTime: 640, // 32s
    hp: 90,
    speed: 1.9,
    radius: 15,
    sight: 340,
    attack: { damage: 34, range: 270, cooldown: 44, aoe: 70, projectile: 'arc' },
    requires: ['uplink'],
    builtAt: 'fabricator',
    hotkey: 'F'
  },
  patchwright: {
    id: 'patchwright',
    name: '修补匠',
    faction: 'warden',
    role: 'support',
    desc: '支援机体，持续修复友军单位与建筑。',
    cost: { shards: 100, flux: 50 },
    supply: 2,
    buildTime: 480, // 24s
    hp: 100,
    speed: 2.3,
    radius: 13,
    sight: 300,
    repair: { rate: 8, range: 130, interval: 16 },
    requires: ['uplink'],
    builtAt: 'fabricator',
    hotkey: 'G'
  },

  // ---- Phage (enemy, 自适应入侵体) ----
  mite: {
    id: 'mite',
    name: '噬虫',
    faction: 'phage',
    role: 'combat',
    desc: '快速自复制的小型入侵体，成群撕咬目标。',
    cost: { shards: 0, flux: 0 },
    supply: 0,
    buildTime: 0,
    hp: 45,
    speed: 3.0,
    radius: 10,
    sight: 260,
    attack: { damage: 6, range: 28, cooldown: 14 },
    hotkey: ''
  },
  spitter: {
    id: 'spitter',
    name: '喷吐者',
    faction: 'phage',
    role: 'combat',
    desc: '远程入侵体，喷射腐蚀性数据浆。',
    cost: { shards: 0, flux: 0 },
    supply: 0,
    buildTime: 0,
    hp: 70,
    speed: 2.2,
    radius: 13,
    sight: 300,
    attack: { damage: 9, range: 130, cooldown: 20, projectile: 'goo' },
    hotkey: ''
  },
  leech: {
    id: 'leech',
    name: '噬建虫',
    faction: 'phage',
    role: 'combat',
    desc: '优先啃食建筑的入侵体，对结构造成双倍伤害。',
    cost: { shards: 0, flux: 0 },
    supply: 0,
    buildTime: 0,
    hp: 130,
    speed: 2.0,
    radius: 14,
    sight: 280,
    attack: { damage: 14, range: 32, cooldown: 22, vsBuildingMult: 2, prefersBuildings: true },
    hotkey: ''
  },
  carrier: {
    id: 'carrier',
    name: '母巢虫',
    faction: 'phage',
    role: 'combat',
    desc: '厚重的孵化躯壳，死亡时破裂释放三只噬虫。',
    cost: { shards: 0, flux: 0 },
    supply: 0,
    buildTime: 0,
    hp: 300,
    speed: 1.5,
    radius: 20,
    sight: 280,
    attack: { damage: 8, range: 100, cooldown: 26, projectile: 'goo' },
    onDeathSpawn: { defId: 'mite', count: 3 },
    hotkey: ''
  },
  ravager: {
    id: 'ravager',
    name: '蹂躏者',
    faction: 'phage',
    role: 'combat',
    desc: '精英入侵体，巨螯砸落造成范围破坏。',
    cost: { shards: 0, flux: 0 },
    supply: 0,
    buildTime: 0,
    hp: 900,
    speed: 1.6,
    radius: 26,
    sight: 320,
    attack: { damage: 40, range: 64, cooldown: 30, aoe: 55 },
    hotkey: ''
  },
  invasion_core: {
    id: 'invasion_core',
    name: '入侵核心',
    faction: 'phage',
    role: 'combat',
    desc: '最终入侵体，吞噬网络的巨型核心。摧毁它即可获胜。',
    cost: { shards: 0, flux: 0 },
    supply: 0,
    buildTime: 0,
    hp: 3800,
    speed: 1.0,
    radius: 40,
    sight: 420,
    attack: { damage: 50, range: 180, cooldown: 40, aoe: 60, projectile: 'corebeam' },
    hotkey: ''
  }
};

export const unitDef = (id: string): UnitDef => {
  const def = UNITS[id];
  if (!def) throw new Error(`unknown unit def: ${id}`);
  return def;
};
