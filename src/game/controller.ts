// GameController: owns the World, runs the fixed-step loop, holds selection,
// control groups, pending targeted actions, and bridges input → commands.
import { step, TICKS_PER_SECOND } from '../game/sim';
import { applyCommand, type PlayerCommand } from '../game/commands';
import { createWorld, type World } from '../game/world';
import type { GameEvent, Order, Vec2 } from '../game/types';
import {
  centerOn,
  clampCamera,
  createCamera,
  screenToWorld,
  zoomAt,
  type Camera
} from '../input/camera';
import {
  clickSelect,
  doubleClickSelect,
  entityAt,
  filterSubgroup,
  smartOrder,
  subgroupOrder,
  unitsInRect,
  type Rect
} from '../input/selection';
import type { Bindings } from '../input/keymap';
import { DEFAULT_BINDINGS } from '../input/keymap';
import {
  loadBindings,
  loadSettings,
  saveBindings,
  saveSettings,
  type Settings
} from '../state/settings';

export type PendingAction =
  | { kind: 'attackMove' }
  | { kind: 'patrol' }
  | { kind: 'place'; buildingDefId: string }
  | { kind: 'ability'; abilityId: string }
  | { kind: 'rally' };

export type ScreenState = 'mainMenu' | 'playing' | 'paused' | 'victory' | 'defeat' | 'tutorial';

const MS_PER_TICK = 1000 / TICKS_PER_SECOND;

export class GameController {
  world: World;
  camera: Camera = createCamera();
  selection: number[] = [];
  controlGroups = new Map<number, number[]>();
  subgroupIndex = 0;
  pendingAction: PendingAction | null = null;
  screen: ScreenState = 'mainMenu';
  paused = false;
  settings: Settings;
  bindings: Bindings;
  viewport = { w: 1920, h: 1080 };
  shake = 0; // screen shake magnitude, decays per frame
  private accumulator = 0;
  private lastTime: number | null = null;
  private lastGroupTap = { group: -1, time: 0 };
  // UI-facing, set by render loop
  fps = 60;
  lastInvalidReason: string | null = null;
  lastInvalidAt = 0;

  constructor(seed: number) {
    this.world = createWorld(seed);
    this.settings = loadSettings();
    this.bindings = loadBindings();
  }

  get simTick(): number {
    return this.world.tick;
  }

  setViewport(w: number, h: number): void {
    this.viewport = { w, h };
    clampCamera(this.camera, w, h);
  }

  startGame(seed?: number): void {
    const s = seed ?? Math.floor(Math.random() * 0xffffffff);
    this.world = createWorld(s);
    this.selection = [];
    this.controlGroups.clear();
    this.subgroupIndex = 0;
    this.pendingAction = null;
    this.paused = false;
    this.accumulator = 0;
    this.lastTime = null;
    this.camera = createCamera();
    this.screen = 'playing';
  }

  restart(): void {
    this.startGame(this.world.seed);
  }

  toMainMenu(): void {
    this.screen = 'mainMenu';
    this.paused = false;
  }

  setPaused(p: boolean): void {
    if (this.screen !== 'playing' && this.screen !== 'paused') return;
    this.paused = p;
    this.screen = p ? 'paused' : 'playing';
  }

  updateSettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
  }

  updateBinding(action: string, key: string): void {
    this.bindings = { ...this.bindings, [action]: key };
    saveBindings(this.bindings);
  }

  resetBindings(): void {
    this.bindings = { ...DEFAULT_BINDINGS };
    saveBindings(this.bindings);
  }

  // ---- fixed-step loop ----
  // Returns interpolation alpha (0..1) for rendering.
  frame(nowMs: number): number {
    if (this.lastTime === null) this.lastTime = nowMs;
    let dt = nowMs - this.lastTime;
    this.lastTime = nowMs;
    if (dt > 250) dt = 250;
    if (dt < 0) dt = 0;
    const playing = this.screen === 'playing' && !this.paused && !this.world.result;
    if (playing) {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= MS_PER_TICK && steps < 8) {
        step(this.world, []);
        this.accumulator -= MS_PER_TICK;
        steps++;
      }
      if (steps === 8) this.accumulator = 0; // drop backlog after hiccup
      this.pruneSelection();
      if (this.world.result) {
        this.screen = this.world.result === 'victory' ? 'victory' : 'defeat';
      }
    }
    return playing ? this.accumulator / MS_PER_TICK : 1;
  }

  drainEvents(): GameEvent[] {
    const evts = this.world.events;
    this.world.events = [];
    return evts;
  }

  private pruneSelection(): void {
    this.selection = this.selection.filter((id) => {
      const e = this.world.entities.get(id);
      return (
        e &&
        (e.kind === 'unit' || e.kind === 'building') &&
        e.team === 'player'
      );
    });
    for (const [g, ids] of this.controlGroups) {
      const alive = ids.filter((id) => this.world.entities.has(id));
      if (alive.length === 0) this.controlGroups.delete(g);
      else this.controlGroups.set(g, alive);
    }
  }

  // ---- selection ----
  screenToWorld(sx: number, sy: number): Vec2 {
    return screenToWorld(this.camera, sx, sy, this.viewport.w, this.viewport.h);
  }

  selectAt(wx: number, wy: number, additive: boolean): void {
    this.selection = clickSelect(this.world, { x: wx, y: wy }, additive, this.selection);
    this.subgroupIndex = 0;
  }

  boxSelect(r: Rect, additive: boolean): void {
    const units = unitsInRect(this.world, r).map((u) => u.id);
    if (additive) {
      const set = new Set(this.selection);
      for (const id of units) set.add(id);
      this.selection = [...set];
    } else {
      this.selection = units;
    }
    this.subgroupIndex = 0;
  }

  doubleClickAt(wx: number, wy: number): void {
    const { w, h } = this.viewport;
    const tl = screenToWorld(this.camera, 0, 0, w, h);
    const br = screenToWorld(this.camera, w, h, w, h);
    this.selection = doubleClickSelect(this.world, { x: wx, y: wy }, {
      x0: tl.x,
      y0: tl.y,
      x1: br.x,
      y1: br.y
    });
    this.subgroupIndex = 0;
  }

  cycleSubgroup(): void {
    if (this.selection.length === 0) return;
    const groups = subgroupOrder(this.world, this.selection);
    if (groups.length === 0) return;
    this.subgroupIndex = (this.subgroupIndex + 1) % groups.length;
  }

  // The active subgroup is what receives orders (SC2-style).
  activeOrderIds(): number[] {
    if (this.selection.length === 0) return [];
    const groups = subgroupOrder(this.world, this.selection);
    if (groups.length === 0) return this.selection;
    const key = groups[this.subgroupIndex % groups.length];
    const ids = filterSubgroup(this.world, this.selection, key);
    return ids.length > 0 ? ids : this.selection;
  }

  // ---- control groups ----
  setControlGroup(index: number): void {
    if (this.selection.length > 0) {
      this.controlGroups.set(index, [...this.selection]);
    }
  }

  addToControlGroup(index: number): void {
    const existing = this.controlGroups.get(index) ?? [];
    const set = new Set(existing);
    for (const id of this.selection) set.add(id);
    this.controlGroups.set(index, [...set]);
  }

  selectControlGroup(index: number): void {
    const ids = this.controlGroups.get(index);
    if (!ids || ids.length === 0) return;
    const now = performance.now();
    if (this.lastGroupTap.group === index && now - this.lastGroupTap.time < 400) {
      // double-tap: center camera on group centroid
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (const id of ids) {
        const e = this.world.entities.get(id);
        if (e) {
          sx += e.pos.x;
          sy += e.pos.y;
          n++;
        }
      }
      if (n > 0) centerOn(this.camera, sx / n, sy / n, this.viewport.w, this.viewport.h);
    }
    this.lastGroupTap = { group: index, time: now };
    this.selection = ids.filter((id) => this.world.entities.has(id));
    this.subgroupIndex = 0;
  }

  // ---- orders ----
  issue(order: Order, append: boolean): void {
    const ids = this.activeOrderIds();
    if (ids.length === 0) return;
    applyCommand(this.world, { type: 'order', unitIds: ids, order, append });
  }

  rightClickAt(wx: number, wy: number, append: boolean): void {
    if (this.pendingAction) {
      this.confirmPendingAt(wx, wy, append);
      return;
    }
    const ids = this.activeOrderIds();
    if (ids.length === 0) return;
    const target = entityAt(this.world, { x: wx, y: wy });
    for (const id of ids) {
      const e = this.world.entities.get(id);
      if (!e || e.kind !== 'unit') continue;
      const order = smartOrder(this.world, e, target, { x: wx, y: wy });
      if (order) {
        applyCommand(this.world, { type: 'order', unitIds: [id], order, append });
      }
    }
  }

  confirmPendingAt(wx: number, wy: number, append: boolean): void {
    const pending = this.pendingAction;
    if (!pending) return;
    const ids = this.activeOrderIds();
    if (pending.kind === 'attackMove') {
      this.issue({ type: 'attackMove', targetPos: { x: wx, y: wy } }, append);
    } else if (pending.kind === 'patrol') {
      this.issue({ type: 'patrol', targetPos: { x: wx, y: wy } }, append);
    } else if (pending.kind === 'place') {
      const res = applyCommand(this.world, {
        type: 'placeBuilding',
        builderIds: ids,
        buildingDefId: pending.buildingDefId,
        pos: { x: wx, y: wy }
      });
      if (!res.ok) {
        this.flagInvalid(res.reason);
        return; // keep placement mode so the player can retry
      }
    } else if (pending.kind === 'ability') {
      const res = applyCommand(this.world, {
        type: 'castAbility',
        abilityId: pending.abilityId,
        target: { x: wx, y: wy }
      });
      if (!res.ok) {
        this.flagInvalid(res.reason);
        return;
      }
    } else if (pending.kind === 'rally') {
      for (const id of this.selection) {
        applyCommand(this.world, { type: 'setRally', buildingId: id, pos: { x: wx, y: wy } });
      }
    }
    if (!append) this.pendingAction = null;
  }

  cancelPending(): void {
    this.pendingAction = null;
  }

  stopSelected(append: boolean): void {
    this.issue({ type: 'stop' }, append);
  }

  holdSelected(append: boolean): void {
    this.issue({ type: 'hold' }, append);
  }

  locateAlert(): void {
    const alerts = this.world.alerts;
    if (alerts.length === 0) return;
    const latest = alerts[alerts.length - 1];
    centerOn(this.camera, latest.pos.x, latest.pos.y, this.viewport.w, this.viewport.h);
  }

  flagInvalid(reason: string): void {
    this.lastInvalidReason = reason;
    this.lastInvalidAt = performance.now();
  }

  zoomBy(sx: number, sy: number, delta: number): void {
    zoomAt(this.camera, sx, sy, this.viewport.w, this.viewport.h, delta);
  }

  addShake(amount: number): void {
    if (this.settings.reduceShake) return;
    this.shake = Math.min(14, this.shake + amount);
  }

  // convenience for command card buttons
  cmd(c: PlayerCommand): void {
    const res = applyCommand(this.world, c);
    if (!res.ok) this.flagInvalid(res.reason);
  }
}
