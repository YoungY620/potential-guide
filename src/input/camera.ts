// Camera: world-space view with pan, wheel zoom, edge scroll and minimap jumps.
import { MAP_PX } from '../game/map';
import type { Vec2 } from '../game/types';

export interface Camera {
  x: number; // center, world px
  y: number;
  zoom: number; // scale factor, 0.45..1.6
}

export function createCamera(): Camera {
  return { x: 700, y: 3400, zoom: 0.8 };
}

export function screenToWorld(cam: Camera, sx: number, sy: number, vw: number, vh: number): Vec2 {
  return {
    x: cam.x + (sx - vw / 2) / cam.zoom,
    y: cam.y + (sy - vh / 2) / cam.zoom
  };
}

export function worldToScreen(cam: Camera, wx: number, wy: number, vw: number, vh: number): Vec2 {
  return {
    x: (wx - cam.x) * cam.zoom + vw / 2,
    y: (wy - cam.y) * cam.zoom + vh / 2
  };
}

export function viewWorldSize(cam: Camera, vw: number, vh: number): { w: number; h: number } {
  return { w: vw / cam.zoom, h: vh / cam.zoom };
}

export function clampCamera(cam: Camera, vw: number, vh: number): void {
  cam.zoom = Math.max(0.45, Math.min(1.6, cam.zoom));
  const { w, h } = viewWorldSize(cam, vw, vh);
  const halfW = Math.min(w / 2, MAP_PX / 2);
  const halfH = Math.min(h / 2, MAP_PX / 2);
  cam.x = Math.max(halfW - 200, Math.min(MAP_PX - halfW + 200, cam.x));
  cam.y = Math.max(halfH - 200, Math.min(MAP_PX - halfH + 200, cam.y));
}

export function zoomAt(
  cam: Camera,
  sx: number,
  sy: number,
  vw: number,
  vh: number,
  delta: number
): void {
  const before = screenToWorld(cam, sx, sy, vw, vh);
  cam.zoom = Math.max(0.45, Math.min(1.6, cam.zoom * (delta > 0 ? 0.9 : 1.1)));
  const after = screenToWorld(cam, sx, sy, vw, vh);
  cam.x += before.x - after.x;
  cam.y += before.y - after.y;
  clampCamera(cam, vw, vh);
}

export function centerOn(cam: Camera, wx: number, wy: number, vw: number, vh: number): void {
  cam.x = wx;
  cam.y = wy;
  clampCamera(cam, vw, vh);
}

// Edge scroll + keyboard pan. mouse in screen px, dt in seconds.
export function panCamera(
  cam: Camera,
  vw: number,
  vh: number,
  dt: number,
  keys: { left: boolean; right: boolean; up: boolean; down: boolean },
  mouse: { x: number; y: number; inside: boolean },
  edgeScrollEnabled: boolean
): void {
  const speed = 1400 / cam.zoom; // world px per second
  let dx = 0;
  let dy = 0;
  if (keys.left) dx -= 1;
  if (keys.right) dx += 1;
  if (keys.up) dy -= 1;
  if (keys.down) dy += 1;
  if (edgeScrollEnabled && mouse.inside) {
    const margin = 8;
    if (mouse.x <= margin) dx -= 1;
    if (mouse.x >= vw - 1 - margin) dx += 1;
    if (mouse.y <= margin) dy -= 1;
    if (mouse.y >= vh - 1 - margin) dy += 1;
  }
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    cam.x += (dx / len) * speed * dt;
    cam.y += (dy / len) * speed * dt;
    clampCamera(cam, vw, vh);
  }
}
