// Data-driven upgrade definitions, researched at the uplink.
export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  cost: { shards: number; flux: number };
  researchTime: number; // ticks
  hotkey: string;
  // effect markers consumed by the sim
  effect: { kind: 'maxHpMult'; value: number } | { kind: 'cooldownMult'; value: number };
}

export const UPGRADES: Record<string, UpgradeDef> = {
  plating: {
    id: 'plating',
    name: '复合装甲',
    desc: '所有守望机体最大生命 +25%。',
    cost: { shards: 150, flux: 150 },
    researchTime: 900, // 45s
    hotkey: 'P',
    effect: { kind: 'maxHpMult', value: 1.25 }
  },
  overclock: {
    id: 'overclock',
    name: '超频协议',
    desc: '所有守望机体攻击间隔 -20%。',
    cost: { shards: 150, flux: 150 },
    researchTime: 900,
    hotkey: 'O',
    effect: { kind: 'cooldownMult', value: 0.8 }
  }
};

export const upgradeDef = (id: string): UpgradeDef => {
  const def = UPGRADES[id];
  if (!def) throw new Error(`unknown upgrade def: ${id}`);
  return def;
};
