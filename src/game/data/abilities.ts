// Data-driven tactical ability definitions (player-cast, global command card).
export interface AbilityDef {
  id: string;
  name: string;
  desc: string;
  cost: { shards: number; flux: number };
  cooldown: number; // ticks
  radius: number; // effect radius px
  hotkey: string;
  kind: 'emp' | 'heal';
  needsVision: boolean; // target point must be visible
}

export const ABILITIES: Record<string, AbilityDef> = {
  emp: {
    id: 'emp',
    name: '电磁脉冲',
    desc: '在目标区域释放脉冲：造成 40 点伤害并瘫痪入侵体 3 秒。',
    cost: { shards: 0, flux: 75 },
    cooldown: 900, // 45s
    radius: 130,
    hotkey: 'Q',
    kind: 'emp',
    needsVision: true
  },
  nanobloom: {
    id: 'nanobloom',
    name: '纳米修复云',
    desc: '在目标区域播撒修复纳米群：立即为友军恢复 100 点生命。',
    cost: { shards: 0, flux: 75 },
    cooldown: 1200, // 60s
    radius: 130,
    hotkey: 'W',
    kind: 'heal',
    needsVision: false
  }
};

export const abilityDef = (id: string): AbilityDef => {
  const def = ABILITIES[id];
  if (!def) throw new Error(`unknown ability def: ${id}`);
  return def;
};
