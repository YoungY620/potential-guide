import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { GameController } from '../game/controller';
import { initMaterialTextures } from '../render/materials';
import { Renderer, type InputView } from '../render/renderer';
import { Minimap } from '../render/minimap';
import { audio, type SoundId } from '../audio/audio';
import { panCamera } from '../input/camera';
import { findActionForKey, normalizeKey } from '../input/keymap';
import { ABILITIES } from '../game/data/abilities';
import type { GameEvent } from '../game/types';
import { buildCommandCard } from './commandCard';
import { recomputeFog } from '../game/fog';
import { Hud } from './hud/Hud';
import { MainMenu } from './screens/MainMenu';
import { PauseMenu } from './screens/PauseMenu';
import { EndScreen } from './screens/EndScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { KeybindingsScreen } from './screens/KeybindingsScreen';
import { TutorialOverlay, TUTORIAL_SEED } from './screens/TutorialOverlay';

const EVENT_SOUNDS: [GameEvent['type'], SoundId][] = [
  ['shot', 'shot'],
  ['explosion', 'explosion'],
  ['buildComplete', 'buildComplete'],
  ['trainComplete', 'trainComplete'],
  ['researchComplete', 'upgrade'],
  ['harvest', 'harvest']
];

export function App() {
  const controller = useMemo(() => new GameController(12345), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const minimapRef = useRef<Minimap | null>(null);
  const inputRef = useRef<{
    mouse: { x: number; y: number; inside: boolean };
    dragStart: { x: number; y: number } | null;
    dragRect: { x0: number; y0: number; x1: number; y1: number } | null;
    keys: { left: boolean; right: boolean; up: boolean; down: boolean };
    lastFrame: number;
  }>({
    mouse: { x: 0, y: 0, inside: false },
    dragStart: null,
    dragRect: null,
    keys: { left: false, right: false, up: false, down: false },
    lastFrame: 0
  });
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [modal, setModal] = useState<'none' | 'settings' | 'keys'>('none');
  const [rebinder, setRebinder] = useState<((key: string) => void) | null>(null);

  // ---- main loop ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = (): void => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      controller.setViewport(w, h);
      rendererRef.current?.resize(w, h);
    };
    resize();
    window.addEventListener('resize', resize);
    // Load baked PNG material files first (procedural fallback if absent),
    // then create the renderer so sprites bake with the final textures.
    let disposed = false;
    void initMaterialTextures().then(() => {
      if (disposed) return;
      rendererRef.current = new Renderer(canvas, controller);
      rendererRef.current.resize(window.innerWidth, window.innerHeight);
      minimapRef.current = new Minimap(controller);
    });

    let raf = 0;
    let lastHud = 0;
    let lastFpsLog = 0;
    const FPS_LOG = window.location.search.includes('fpslog');
    const loop = (now: number): void => {
      raf = requestAnimationFrame(loop);
      const c = controller;
      const inp = inputRef.current;
      const dt = inp.lastFrame === 0 ? 0.016 : Math.min(0.1, (now - inp.lastFrame) / 1000);
      inp.lastFrame = now;
      if (dt > 0) c.fps = c.fps * 0.95 + (1 / dt) * 0.05;
      const playing = c.screen === 'playing' || c.screen === 'tutorial' || c.screen === 'paused';
      if (playing && !c.paused) {
        panCamera(c.camera, c.viewport.w, c.viewport.h, dt, inp.keys, inp.mouse, c.settings.edgeScroll);
      }
      const alpha = c.frame(now);
      const events = c.drainEvents();
      for (const e of events) {
        if (e.type === 'alert') audio.play('alert', 300);
        for (const [type, sound] of EVENT_SOUNDS) {
          if (e.type === type) audio.play(sound);
        }
      }
      const mouseWorld = c.screenToWorld(inp.mouse.x, inp.mouse.y);
      const view: InputView = {
        mouseWorld,
        mouseScreen: inp.mouse,
        dragRect: inp.dragRect,
        hoverId: null
      };
      rendererRef.current?.render(c, alpha, view, events);
      const mmCanvas = minimapCanvasRef.current;
      if (mmCanvas && minimapRef.current && playing) {
        minimapRef.current.render(mmCanvas.getContext('2d')!, c, mmCanvas.width);
      }
      if (now - lastHud > 120) {
        lastHud = now;
        bump();
      }
      if (FPS_LOG && now - lastFpsLog > 10000) {
        lastFpsLog = now;
        const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
          ?.usedJSHeapSize;
        console.log(
          `[fps] ${c.fps.toFixed(0)} fps, entities=${c.world.entities.size}, tick=${c.world.tick}` +
            (heap !== undefined ? `, heap=${(heap / 1048576).toFixed(1)}MB` : '')
        );
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- mouse ----
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      audio.resume();
      audio.startMusic();
      const c = controller;
      if (c.screen !== 'playing' && c.screen !== 'tutorial') return;
      const inp = inputRef.current;
      const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const w = c.screenToWorld(sx, sy);
      if (e.button === 0) {
        if (c.pendingAction) {
          c.confirmPendingAt(w.x, w.y, e.shiftKey);
          audio.play('click');
          bump();
          return;
        }
        inp.dragStart = { x: sx, y: sy };
      } else if (e.button === 2) {
        if (c.pendingAction) {
          c.cancelPending();
          audio.play('click');
        } else {
          c.rightClickAt(w.x, w.y, e.shiftKey);
          audio.play('move', 120);
        }
        bump();
      }
    },
    [controller]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const c = controller;
      const inp = inputRef.current;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      inp.mouse.x = sx;
      inp.mouse.y = sy;
      inp.mouse.inside = true;
      if (inp.dragStart) {
        const w0 = c.screenToWorld(inp.dragStart.x, inp.dragStart.y);
        const w1 = c.screenToWorld(sx, sy);
        inp.dragRect = { x0: w0.x, y0: w0.y, x1: w1.x, y1: w1.y };
      }
    },
    [controller]
  );

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const c = controller;
      if (c.screen !== 'playing' && c.screen !== 'tutorial') return;
      const inp = inputRef.current;
      if (e.button !== 0 || !inp.dragStart) return;
      const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const dx = sx - inp.dragStart.x;
      const dy = sy - inp.dragStart.y;
      const w = c.screenToWorld(sx, sy);
      if (Math.hypot(dx, dy) < 6) {
        c.selectAt(w.x, w.y, e.shiftKey);
      } else if (inp.dragRect) {
        c.boxSelect(inp.dragRect, e.shiftKey);
      }
      inp.dragStart = null;
      inp.dragRect = null;
      if (c.selection.length > 0) audio.play('select', 100);
      bump();
    },
    [controller]
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const c = controller;
      if (c.screen !== 'playing' && c.screen !== 'tutorial') return;
      const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
      const w = c.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      c.doubleClickAt(w.x, w.y);
      if (c.selection.length > 0) audio.play('select', 100);
      bump();
    },
    [controller]
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const c = controller;
      const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
      c.zoomBy(e.clientX - rect.left, e.clientY - rect.top, e.deltaY);
    },
    [controller]
  );

  // ---- keyboard ----
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const c = controller;
      if (rebinder) {
        e.preventDefault();
        const key = normalizeKey(e);
        if (key !== 'ESCAPE') rebinder(key);
        setRebinder(null);
        bump();
        return;
      }
      const key = normalizeKey(e);
      const inp = inputRef.current;
      if (key === 'ARROWLEFT') inp.keys.left = true;
      else if (key === 'ARROWRIGHT') inp.keys.right = true;
      else if (key === 'ARROWUP') inp.keys.up = true;
      else if (key === 'ARROWDOWN') inp.keys.down = true;
      if (key === 'TAB') e.preventDefault();
      if (key === 'SPACE') e.preventDefault();
      if (modal !== 'none') {
        if (key === 'ESCAPE') setModal('none');
        return;
      }
      if (c.screen !== 'playing' && c.screen !== 'tutorial' && c.screen !== 'paused') return;

      // control groups: ctrl/shift+digit, digit select
      if (/^[0-9]$/.test(key)) {
        const group = key === '0' ? 9 : Number(key) - 1;
        if (e.ctrlKey || e.metaKey) {
          c.setControlGroup(group);
          audio.play('click');
        } else if (e.shiftKey) {
          c.addToControlGroup(group);
          audio.play('click');
        } else {
          c.selectControlGroup(group);
          audio.play('select', 80);
        }
        bump();
        return;
      }

      const action = findActionForKey(c.bindings, key);
      if (action) {
        switch (action) {
          case 'attackMove':
            if (c.selection.length > 0) c.pendingAction = { kind: 'attackMove' };
            break;
          case 'patrol':
            if (c.selection.length > 0) c.pendingAction = { kind: 'patrol' };
            break;
          case 'stop':
            c.stopSelected(e.shiftKey);
            break;
          case 'hold':
            c.holdSelected(e.shiftKey);
            break;
          case 'cancel':
            if (c.pendingAction) c.cancelPending();
            else if (c.selection.length > 0) c.selection = [];
            else c.setPaused(!c.paused);
            break;
          case 'locateAlert':
            c.locateAlert();
            break;
          case 'pause':
            c.setPaused(!c.paused);
            break;
          case 'menu':
            c.setPaused(true);
            break;
          case 'subgroupNext':
            c.cycleSubgroup();
            break;
        }
        bump();
        return;
      }

      // tactical abilities (data-driven hotkeys)
      for (const ab of Object.values(ABILITIES)) {
        if (ab.hotkey === key && c.selection.length >= 0) {
          c.pendingAction = { kind: 'ability', abilityId: ab.id };
          bump();
          return;
        }
      }

      // command-card data hotkeys (train/build/research/rally)
      if (c.selection.length > 0) {
        const card = buildCommandCard(c);
        const btn = card.find((b) => b.hotkey === key);
        if (btn) {
          if (btn.disabled) {
            c.flagInvalid(btn.reason ?? '不可用');
            audio.play('error');
          } else {
            btn.onClick();
            audio.play('click');
          }
          bump();
          return;
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      const key = normalizeKey(e);
      const inp = inputRef.current;
      if (key === 'ARROWLEFT') inp.keys.left = false;
      else if (key === 'ARROWRIGHT') inp.keys.right = false;
      else if (key === 'ARROWUP') inp.keys.up = false;
      else if (key === 'ARROWDOWN') inp.keys.down = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [controller, modal, rebinder]);

  const inGame = controller.screen !== 'mainMenu';

  // QA hook: ?autostart jumps straight into a game (used by screenshot capture).
  // ?demo additionally spawns two armies clashing in view for visual/perf checks.
  useEffect(() => {
    const q = window.location.search;
    if (q.includes('autostart') && controller.screen === 'mainMenu') {
      controller.startGame(12345);
      if (q.includes('demo')) {
        import('../game/world').then(({ spawnUnit }) => {
          const w = controller.world;
          const big = q.includes('demo200');
          const playerN = big ? 80 : 40;
          const enemyN = big ? 120 : 60;
          for (let i = 0; i < playerN; i++) {
            const def = ['sentinel', 'bulwark', 'arccaster', 'patchwright'][i % 4];
            const u = spawnUnit(w, def, 'player', {
              x: 900 + (i % 10) * 36,
              y: 3200 + Math.floor(i / 10) * 40
            });
            u.orders = [{ type: 'attackMove', targetPos: { x: 1400, y: 2600 } }];
          }
          for (let i = 0; i < enemyN; i++) {
            const def = ['mite', 'spitter', 'leech', 'carrier', 'ravager'][i % 5];
            const u = spawnUnit(w, def, 'enemy', {
              x: 1500 + (i % 10) * 36,
              y: 2500 + Math.floor(i / 10) * 40
            });
            u.orders = [{ type: 'attackMove', targetPos: { x: 900, y: 3200 } }];
          }
          // reveal the demo area and center the camera on it
          controller.camera.x = 1150;
          controller.camera.y = 2900;
          recomputeFog(w);
        });
      }
      if (q.includes('zoom')) {
        controller.camera.zoom = 1.4;
      }
      if (q.includes('base')) {
        controller.camera.x = 528;
        controller.camera.y = 3536;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative' }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseLeave={() => {
        inputRef.current.mouse.inside = false;
      }}
      onMouseEnter={(e) => {
        // record real coordinates — a stale (0,0) would trigger permanent edge scroll
        inputRef.current.mouse.x = e.clientX;
        inputRef.current.mouse.y = e.clientY;
        inputRef.current.mouse.inside = true;
      }}
      onMouseMove={onMouseMove}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', cursor: controller.pendingAction ? 'crosshair' : 'default' }}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel}
      />
      {inGame && (
        <Hud
          controller={controller}
          minimapCanvasRef={minimapCanvasRef}
          onOpenSettings={() => setModal('settings')}
          onOpenKeys={() => setModal('keys')}
        />
      )}
      {controller.screen === 'tutorial' && <TutorialOverlay controller={controller} />}
      {controller.screen === 'mainMenu' && (
        <MainMenu
          controller={controller}
          onOpenSettings={() => setModal('settings')}
          onOpenKeys={() => setModal('keys')}
        />
      )}
      {controller.screen === 'paused' && (
        <PauseMenu
          controller={controller}
          onOpenSettings={() => setModal('settings')}
          onOpenKeys={() => setModal('keys')}
          onClose={() => controller.setPaused(false)}
        />
      )}
      {(controller.screen === 'victory' || controller.screen === 'defeat') && (
        <EndScreen controller={controller} />
      )}
      {modal === 'settings' && <SettingsScreen controller={controller} onClose={() => setModal('none')} />}
      {modal === 'keys' && (
        <KeybindingsScreen
          controller={controller}
          onClose={() => setModal('none')}
          rebinder={rebinder}
          setRebinder={setRebinder}
        />
      )}
    </div>
  );
}

export { TUTORIAL_SEED };
