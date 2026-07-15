// User settings with localStorage persistence (survives app restart).
import { DEFAULT_BINDINGS, type Bindings } from '../input/keymap';

export interface Settings {
  masterVolume: number; // 0..1
  sfxVolume: number; // 0..1
  musicVolume: number; // 0..1
  uiScale: number; // 0.8..1.4
  colorblind: 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia';
  edgeScroll: boolean;
  reduceShake: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  masterVolume: 0.8,
  sfxVolume: 0.9,
  musicVolume: 0.5,
  uiScale: 1,
  colorblind: 'none',
  edgeScroll: true,
  reduceShake: false
};

const SETTINGS_KEY = 'aidrts.settings.v1';
const BINDINGS_KEY = 'aidrts.bindings.v1';

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadSettings(): Settings {
  const s = storage();
  if (!s) return { ...DEFAULT_SETTINGS };
  try {
    const raw = s.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export function loadBindings(): Bindings {
  const s = storage();
  if (!s) return { ...DEFAULT_BINDINGS };
  try {
    const raw = s.getItem(BINDINGS_KEY);
    if (!raw) return { ...DEFAULT_BINDINGS };
    return { ...DEFAULT_BINDINGS, ...(JSON.parse(raw) as Partial<Bindings>) };
  } catch {
    return { ...DEFAULT_BINDINGS };
  }
}

export function saveBindings(bindings: Bindings): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(BINDINGS_KEY, JSON.stringify(bindings));
  } catch {
    /* ignore */
  }
}
