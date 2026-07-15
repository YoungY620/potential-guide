// Data-driven building definitions (player faction + enemy spawner).
import type { AttackDef, Faction } from './units';

export interface BuildingDef {
  id: string;
  name: string;
  faction: Faction;
  desc: string;
  cost: { shards: number; flux: number };
  buildTime: number; // ticks
  hp: number;
  size: number; // square footprint in tiles
  supplyProvided?: number;
  trains?: string[]; // unit defIds
  researches?: string[]; // upgrade defIds
  attack?: AttackDef;
  requires?: string[]; // completed buildings required to place
  sight: number;
  hotkey: string;
}

export const BUILDINGS: Record<string, BuildingDef> = {
  citadel: {
    id: 'citadel',
    name: '核心主堡',
    faction: 'warden',
    desc: '防线中枢。训练接续者，回收资源，提供基础容量。被摧毁即战败。',
    cost: { shards: 0, flux: 0 },
    buildTime: 0,
    hp: 2500,
    size: 5,
    supplyProvided: 15,
    trains: ['splicer'],
    sight: 420,
    hotkey: ''
  },
  fabricator: {
    id: 'fabricator',
    name: '制造厂',
    faction: 'warden',
    desc: '组装战斗与支援机体。',
    cost: { shards: 150, flux: 0 },
    buildTime: 800, // 40s
    hp: 900,
    size: 4,
    trains: ['sentinel', 'bulwark', 'arccaster', 'patchwright'],
    sight: 260,
    hotkey: 'F'
  },
  uplink: {
    id: 'uplink',
    name: '数据链塔',
    faction: 'warden',
    desc: '解锁高级机体与协议升级研究。',
    cost: { shards: 200, flux: 100 },
    buildTime: 900, // 45s
    hp: 600,
    size: 3,
    researches: ['plating', 'overclock'],
    sight: 300,
    hotkey: 'U'
  },
  capacitor: {
    id: 'capacitor',
    name: '电容塔',
    faction: 'warden',
    desc: '提供 10 点机体容量。',
    cost: { shards: 100, flux: 0 },
    buildTime: 500, // 25s
    hp: 450,
    size: 2,
    supplyProvided: 10,
    sight: 200,
    hotkey: 'C'
  },
  turret: {
    id: 'turret',
    name: '防火墙炮塔',
    faction: 'warden',
    desc: '防御建筑，自动灼烧射程内的入侵体。',
    cost: { shards: 100, flux: 25 },
    buildTime: 600, // 30s
    hp: 500,
    size: 2,
    attack: { damage: 18, range: 220, cooldown: 18, projectile: 'flame' },
    sight: 320,
    hotkey: 'T'
  },

  // ---- enemy ----
  spawner: {
    id: 'spawner',
    name: '瘟巢',
    faction: 'phage',
    desc: '入侵体的生成节点。',
    cost: { shards: 0, flux: 0 },
    buildTime: 0,
    hp: 4000,
    size: 6,
    sight: 380,
    hotkey: ''
  }
};

export const buildingDef = (id: string): BuildingDef => {
  const def = BUILDINGS[id];
  if (!def) throw new Error(`unknown building def: ${id}`);
  return def;
};
