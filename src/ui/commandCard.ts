// Command card model: data-driven buttons for the active selection subgroup.
import type { GameController } from '../game/controller';
import { BUILDINGS, buildingDef } from '../game/data/buildings';
import { UNITS, unitDef } from '../game/data/units';
import { UPGRADES } from '../game/data/upgrades';
import { GLOBAL_ACTION_LABELS, type GlobalAction } from '../input/keymap';
import { validatePlace, validateResearch, validateTrain } from '../game/commands';
import type { Building, Unit } from '../game/types';

export interface CardButton {
  id: string;
  label: string;
  icon: string; // icon key for the Icon component
  hotkey?: string; // display + keyboard routing
  disabled: boolean;
  reason?: string;
  progress?: number; // 0..1 (queue head / research / cooldown)
  count?: number; // queue count badge
  onClick: () => void;
}

const BUILD_MENU: string[] = ['fabricator', 'uplink', 'capacitor', 'turret'];

function orderButton(
  c: GameController,
  action: GlobalAction,
  icon: string
): CardButton {
  const key = c.bindings[action] ?? '';
  const ids = c.activeOrderIds();
  const run = (): void => {
    if (action === 'attackMove') c.pendingAction = { kind: 'attackMove' };
    else if (action === 'patrol') c.pendingAction = { kind: 'patrol' };
    else if (action === 'stop') c.stopSelected(false);
    else if (action === 'hold') c.holdSelected(false);
  };
  return {
    id: 'order:' + action,
    label: GLOBAL_ACTION_LABELS[action],
    icon,
    hotkey: key,
    disabled: ids.length === 0,
    reason: ids.length === 0 ? '目标无效' : undefined,
    onClick: run
  };
}

export function buildCommandCard(c: GameController): CardButton[] {
  const buttons: CardButton[] = [];
  const ids = c.activeOrderIds();
  if (ids.length === 0) return buttons;
  const first = c.world.entities.get(ids[0]);
  if (!first) return buttons;

  if (first.kind === 'unit') {
    const u = first as Unit;
    const def = unitDef(u.defId);
    if (def.attack) buttons.push(orderButton(c, 'attackMove', 'attack'));
    buttons.push(orderButton(c, 'stop', 'stop'));
    buttons.push(orderButton(c, 'hold', 'hold'));
    if (def.attack) buttons.push(orderButton(c, 'patrol', 'patrol'));
    // worker build menu
    if (def.harvest) {
      for (const bId of BUILD_MENU) {
        const bdef = buildingDef(bId);
        const v = validatePlace(c.world, bId, { x: -1, y: -1 });
        // placement validity is position-dependent; only surface cost/tech here
        const softReason =
          v.ok || v.reason.includes('放置') ? undefined : v.reason;
        buttons.push({
          id: 'build:' + bId,
          label: bdef.name,
          icon: 'b:' + bId,
          hotkey: bdef.hotkey,
          disabled: softReason !== undefined,
          reason: softReason,
          onClick: () => {
            const check = validatePlace(c.world, bId, c.screenToWorld(0, 0));
            if (!check.ok && !check.reason.includes('放置')) {
              c.flagInvalid(check.reason);
              return;
            }
            c.pendingAction = { kind: 'place', buildingDefId: bId };
          }
        });
      }
    }
    return buttons;
  }

  if (first.kind === 'building') {
    const b = first as Building;
    const bdef = buildingDef(b.defId);
    if (b.construction < 1) return buttons;
    for (const uId of bdef.trains ?? []) {
      const udef = unitDef(uId);
      const v = validateTrain(c.world, b.id, uId);
      const queued = b.productionQueue.filter((p) => p.defId === uId).length;
      buttons.push({
        id: 'train:' + uId,
        label: udef.name,
        icon: 'u:' + uId,
        hotkey: udef.hotkey,
        disabled: !v.ok,
        reason: v.ok ? undefined : v.reason,
        count: queued > 0 ? queued : undefined,
        progress:
          b.productionQueue[0]?.defId === uId
            ? 1 - b.productionQueue[0].remaining / b.productionQueue[0].total
            : undefined,
        onClick: () => c.cmd({ type: 'train', buildingId: b.id, unitDefId: uId })
      });
    }
    for (const upId of bdef.researches ?? []) {
      const udef = UPGRADES[upId];
      const v = validateResearch(c.world, b.id, upId);
      buttons.push({
        id: 'research:' + upId,
        label: udef.name,
        icon: 'r:' + upId,
        hotkey: udef.hotkey,
        disabled: !v.ok,
        reason: v.ok ? undefined : v.reason,
        progress: b.research?.defId === upId ? 1 - b.research.remaining / b.research.total : undefined,
        onClick: () => c.cmd({ type: 'research', buildingId: b.id, upgradeId: upId })
      });
    }
    if ((bdef.trains?.length ?? 0) > 0) {
      buttons.push({
        id: 'rally',
        label: '集结点',
        icon: 'rally',
        hotkey: 'R',
        disabled: false,
        onClick: () => {
          c.pendingAction = { kind: 'rally' };
        }
      });
    }
    return buttons;
  }

  return buttons;
}

// All unit/building hotkeys currently meaningful — used for keyboard routing
// and for conflict display in the keybindings screen.
export function activeDataHotkeys(c: GameController): { name: string; key: string }[] {
  const out: { name: string; key: string }[] = [];
  for (const u of Object.values(UNITS)) {
    if (u.hotkey && u.faction === 'warden') out.push({ name: u.name, key: u.hotkey });
  }
  for (const b of Object.values(BUILDINGS)) {
    if (b.hotkey && b.faction === 'warden') out.push({ name: b.name, key: b.hotkey });
  }
  for (const up of Object.values(UPGRADES)) {
    if (up.hotkey) out.push({ name: up.name, key: up.hotkey });
  }
  return out;
}
