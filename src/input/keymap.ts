// Data-driven hotkey map with rebinding support and conflict detection.
// Keys are normalized KeyboardEvent.key values ('a'→'A', ' '→'Space', etc.).

export type GlobalAction =
  | 'attackMove'
  | 'stop'
  | 'hold'
  | 'patrol'
  | 'cancel'
  | 'locateAlert'
  | 'pause'
  | 'menu'
  | 'subgroupNext';

export const GLOBAL_ACTION_LABELS: Record<GlobalAction, string> = {
  attackMove: '攻击移动',
  stop: '停止',
  hold: '保持位置',
  patrol: '巡逻',
  cancel: '取消',
  locateAlert: '定位警报',
  pause: '暂停/继续',
  menu: '打开菜单',
  subgroupNext: '切换单位子组'
};

export const DEFAULT_BINDINGS: Record<GlobalAction, string> = {
  attackMove: 'A',
  stop: 'S',
  hold: 'H',
  patrol: 'P',
  cancel: 'ESCAPE',
  locateAlert: 'SPACE',
  pause: 'F10',
  menu: 'F9',
  subgroupNext: 'TAB'
};

export function normalizeKey(e: { key: string }): string {
  const k = e.key;
  if (k === ' ') return 'SPACE';
  if (k === 'Escape') return 'ESCAPE';
  if (k === 'Tab') return 'TAB';
  if (k.startsWith('F') && /^F\d+$/.test(k)) return k.toUpperCase();
  if (k === 'Control') return 'CTRL';
  if (k === 'Shift') return 'SHIFT';
  if (k === 'Alt') return 'ALT';
  if (k.length === 1) return k.toUpperCase();
  return k.toUpperCase();
}

export type Bindings = Record<string, string>; // action -> key

export function findActionForKey(bindings: Bindings, key: string): string | null {
  for (const [action, k] of Object.entries(bindings)) {
    if (k === key) return action;
  }
  return null;
}

export interface KeyConflict {
  key: string;
  actions: string[]; // action ids or display names sharing the key
}

// Detect keys bound to more than one action. `extra` adds context-hotkeys
// (e.g. command card buttons) as {name, key} pairs.
export function detectConflicts(
  bindings: Bindings,
  extra: { name: string; key: string }[] = []
): KeyConflict[] {
  const byKey = new Map<string, string[]>();
  for (const [action, key] of Object.entries(bindings)) {
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(GLOBAL_ACTION_LABELS[action as GlobalAction] ?? action);
    byKey.set(key, list);
  }
  for (const { name, key } of extra) {
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(name);
    byKey.set(key, list);
  }
  const conflicts: KeyConflict[] = [];
  for (const [key, actions] of byKey) {
    if (actions.length > 1) conflicts.push({ key, actions });
  }
  return conflicts;
}

// Control-group keys are fixed to digits but reported for conflict display.
export function controlGroupKey(index: number): string {
  return String((index + 1) % 10); // group 0 -> '1', ... group 9 -> '0'
}
