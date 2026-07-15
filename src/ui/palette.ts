// Colorblind-friendly palettes. Team/alert colors swap per setting.
import type { Settings } from '../state/settings';

export interface Palette {
  player: string;
  playerSoft: string;
  enemy: string;
  enemySoft: string;
  hpGood: string;
  hpWarn: string;
  hpBad: string;
  accent: string;
}

const BASE: Palette = {
  player: '#3fd2ff',
  playerSoft: '#9be7ff',
  enemy: '#f87171',
  enemySoft: '#ffb3b3',
  hpGood: '#4ade80',
  hpWarn: '#facc15',
  hpBad: '#f87171',
  accent: '#ff9c41'
};

export function paletteFor(mode: Settings['colorblind']): Palette {
  switch (mode) {
    case 'deuteranopia':
    case 'protanopia':
      return {
        ...BASE,
        enemy: '#ffb000',
        enemySoft: '#ffd27a',
        hpGood: '#3fd2ff',
        hpWarn: '#ffb000',
        hpBad: '#d65f00',
        accent: '#ffb000'
      };
    case 'tritanopia':
      return {
        ...BASE,
        player: '#00c8a0',
        playerSoft: '#8affe0',
        enemy: '#ff5c8a',
        enemySoft: '#ffb3c8',
        hpGood: '#00c8a0',
        hpWarn: '#ffe14d',
        hpBad: '#ff5c8a'
      };
    default:
      return BASE;
  }
}
