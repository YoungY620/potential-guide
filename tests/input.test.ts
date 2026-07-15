import { describe, expect, it } from 'vitest';
import { GameController } from '../src/game/controller';
import { detectConflicts, DEFAULT_BINDINGS, normalizeKey } from '../src/input/keymap';
import { spawnUnit } from '../src/game/world';
import { step } from '../src/game/sim';
import type { Unit } from '../src/game/types';

function makeController(seed = 42): GameController {
  const c = new GameController(seed);
  c.startGame(seed);
  return c;
}

function firstWorker(c: GameController): Unit {
  for (const e of c.world.entities.values()) {
    if (e.kind === 'unit' && e.team === 'player') return e;
  }
  throw new Error('no worker');
}

describe('control groups (编队)', () => {
  it('creates, selects and appends to groups', () => {
    const c = makeController();
    const workers: number[] = [];
    for (const e of c.world.entities.values()) {
      if (e.kind === 'unit' && e.team === 'player') workers.push(e.id);
    }
    c.selection = workers.slice(0, 3);
    c.setControlGroup(0);
    expect(c.controlGroups.get(0)).toEqual(workers.slice(0, 3));

    // select others, shift-add to group
    c.selection = workers.slice(3, 5);
    c.addToControlGroup(0);
    expect(c.controlGroups.get(0)?.length).toBe(5);

    // select group restores selection
    c.selection = [];
    c.selectControlGroup(0);
    expect(c.selection.length).toBe(5);

    // dead units are pruned
    const victim = workers[0];
    c.world.entities.delete(victim);
    c.selectControlGroup(0);
    expect(c.selection).not.toContain(victim);
  });
});

describe('shift order queue (Shift 追加命令)', () => {
  it('appends orders and executes them sequentially', () => {
    const c = makeController();
    const w = firstWorker(c);
    c.selection = [w.id];
    const farA = { x: w.pos.x + 320, y: w.pos.y };
    const farB = { x: w.pos.x + 320, y: w.pos.y + 320 };
    c.issue({ type: 'move', targetPos: farA }, false);
    c.issue({ type: 'move', targetPos: farB }, true); // shift append
    expect(w.orders.length).toBe(2);
    // run until first order completes
    for (let i = 0; i < 20 * 30 && w.orders.length > 1; i++) step(c.world, []);
    expect(w.orders.length).toBe(1);
    expect(w.orders[0].targetPos).toEqual(farB);
  });

  it('non-append order replaces the queue', () => {
    const c = makeController();
    const w = firstWorker(c);
    c.selection = [w.id];
    c.issue({ type: 'move', targetPos: { x: 800, y: 3400 } }, false);
    c.issue({ type: 'move', targetPos: { x: 900, y: 3400 } }, true);
    c.issue({ type: 'stop' }, false);
    expect(w.orders.length).toBe(0);
  });
});

describe('pause (暂停)', () => {
  it('halts simulation and timers while paused', () => {
    const c = makeController();
    c.frame(1000);
    for (let t = 0; t < 30; t++) c.frame(1000 + t * 50 + 16);
    const tickBefore = c.world.tick;
    c.setPaused(true);
    expect(c.screen).toBe('paused');
    for (let t = 0; t < 20; t++) c.frame(3000 + t * 50);
    expect(c.world.tick).toBe(tickBefore);
    c.setPaused(false);
    for (let t = 0; t < 20; t++) c.frame(5000 + t * 50);
    expect(c.world.tick).toBeGreaterThan(tickBefore);
  });
});

describe('victory condition (胜利条件)', () => {
  it('killing the invasion core after it spawns wins the game', () => {
    const c = makeController();
    // simulate the core arriving
    const core = spawnUnit(c.world, 'invasion_core', 'enemy', { x: 2000, y: 1000 });
    c.world.waves.coreSpawned = true;
    step(c.world, []);
    expect(c.world.result).toBeNull();
    c.world.entities.delete(core.id);
    step(c.world, []);
    expect(c.world.result).toBe('victory');
  });
});

describe('hotkey conflicts (快捷键冲突)', () => {
  it('detects no conflicts in defaults and finds injected ones', () => {
    const clean = detectConflicts({ ...DEFAULT_BINDINGS });
    expect(clean.length).toBe(0);
    const clash = detectConflicts({ ...DEFAULT_BINDINGS, hold: 'A' });
    expect(clash.length).toBe(1);
    expect(clash[0].key).toBe('A');
    expect(clash[0].actions.length).toBe(2);
  });
  it('normalizes keyboard events', () => {
    expect(normalizeKey({ key: 'a' })).toBe('A');
    expect(normalizeKey({ key: ' ' })).toBe('SPACE');
    expect(normalizeKey({ key: 'Escape' })).toBe('ESCAPE');
    expect(normalizeKey({ key: 'Tab' })).toBe('TAB');
    expect(normalizeKey({ key: 'F10' })).toBe('F10');
  });
});

describe('subgroups (Tab 子组)', () => {
  it('cycles mixed selection subgroups', () => {
    const c = makeController();
    const s1 = spawnUnit(c.world, 'sentinel', 'player', { x: 700, y: 3500 });
    const s2 = spawnUnit(c.world, 'sentinel', 'player', { x: 720, y: 3500 });
    const w = firstWorker(c);
    c.selection = [w.id, s1.id, s2.id];
    const initial = c.subgroupIndex;
    c.cycleSubgroup();
    expect(c.subgroupIndex).toBe((initial + 1) % 2);
    // active order ids filter to one subgroup
    const ids = c.activeOrderIds();
    const allSame = ids.every((id) => c.world.entities.get(id)?.defId === c.world.entities.get(ids[0])?.defId);
    expect(allSame).toBe(true);
  });
});
