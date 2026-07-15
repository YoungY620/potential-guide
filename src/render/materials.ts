// Material rendering library: multi-layer shading + procedural textures baked
// to offscreen canvases. Everything is generated at runtime — no image assets.
//
// Pipeline per sprite: silhouette path → base gradient → clipped texture layer
// (metal grain / chitin ridges / organic mottle) → panel seams → rim light &
// inner shadow → specular highlights → energy glows.

// ---------- seeded value noise ----------
type NoiseGrid = { g: Float32Array; size: number };

function makeGrid(seed: number, size: number): NoiseGrid {
  const g = new Float32Array(size * size);
  let s = seed >>> 0;
  for (let i = 0; i < g.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    g[i] = s / 0x7fffffff;
  }
  return { g, size };
}

function sampleGrid(n: NoiseGrid, x: number, y: number): number {
  const s = n.size;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const w = (v: number): number => v * v * (3 - 2 * v);
  const x0 = ((xi % s) + s) % s;
  const y0 = ((yi % s) + s) % s;
  const x1 = (x0 + 1) % s;
  const y1 = (y0 + 1) % s;
  const a = n.g[y0 * s + x0];
  const b = n.g[y0 * s + x1];
  const c = n.g[y1 * s + x0];
  const d = n.g[y1 * s + x1];
  const ux = w(xf);
  const uy = w(yf);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

// fractal brownian motion, 4 octaves
function fbm(n: NoiseGrid, x: number, y: number): number {
  return (
    sampleGrid(n, x, y) * 0.5 +
    sampleGrid(n, x * 2, y * 2) * 0.25 +
    sampleGrid(n, x * 4, y * 4) * 0.125 +
    sampleGrid(n, x * 8, y * 8) * 0.125
  );
}

export type TextureKind = 'brushed' | 'grain' | 'chitin' | 'flesh' | 'crystal';

const noiseCache = new Map<string, HTMLCanvasElement>();

// Tileable procedural texture canvas (RGBA), cached. If baked PNG material
// files were loaded via initMaterialTextures(), those take precedence.
export function noiseTexture(kind: TextureKind, seed: number, size = 256): HTMLCanvasElement {
  const fileTex = fileTextures.get(kind);
  if (fileTex) return fileTex;
  const key = `${kind}:${seed}:${size}`;
  const cached = noiseCache.get(key);
  if (cached) return cached;
  const n = makeGrid(seed, 64);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * 8;
      const v = (y / size) * 8;
      let val = 0;
      let alpha = 255;
      if (kind === 'brushed') {
        // horizontal streaks: stretch noise on x
        val = fbm(n, u * 0.3, v * 6) * 0.7 + fbm(n, u * 3, v * 24) * 0.3;
      } else if (kind === 'grain') {
        val = fbm(n, u, v);
      } else if (kind === 'chitin') {
        // ridged: 1 - |2*fbm - 1| gives hard ridges
        const f = fbm(n, u * 1.2, v * 1.2);
        val = 1 - Math.abs(2 * f - 1);
        val = val * val;
      } else if (kind === 'flesh') {
        // mottled blobs
        val = Math.min(1, fbm(n, u * 0.8, v * 0.8) * 1.3);
      } else if (kind === 'crystal') {
        // voronoi-ish facets via quantized noise
        const f = fbm(n, u, v);
        val = Math.floor(f * 6) / 6 + f * 0.15;
      }
      const o = (y * size + x) * 4;
      const c = Math.max(0, Math.min(255, Math.round(val * 255)));
      d[o] = c;
      d[o + 1] = c;
      d[o + 2] = c;
      d[o + 3] = alpha;
    }
  }
  ctx.putImageData(img, 0, 0);
  noiseCache.set(key, canvas);
  return canvas;
}

// ---------- material files (assets/materials/*.png) ----------
const TEXTURE_KINDS: TextureKind[] = ['brushed', 'grain', 'chitin', 'flesh', 'crystal'];
const fileTextures = new Map<TextureKind, HTMLCanvasElement>();

// Load baked PNG material files; missing files fall back to procedural noise.
export function initMaterialTextures(): Promise<void> {
  return Promise.all(
    TEXTURE_KINDS.map(
      (kind) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext('2d')!.drawImage(img, 0, 0);
            fileTextures.set(kind, canvas);
            resolve();
          };
          img.onerror = () => resolve(); // fallback: procedural
          img.src = `assets/materials/${kind}.png`;
        })
    )
  ).then(() => undefined);
}

// QA/bake hook: export procedurally generated textures as data URLs so the
// bake script can persist them as PNG material files.
declare global {
  interface Window {
    __exportMaterialTextures?: () => Record<string, string>;
  }
}
if (typeof window !== 'undefined') {
  window.__exportMaterialTextures = () => {
    const out: Record<string, string> = {};
    for (const kind of TEXTURE_KINDS) {
      out[kind] = noiseTexture(kind, 1).toDataURL('image/png');
    }
    return out;
  };
}

// ---------- shading helpers ----------

export function shadeColor(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

// Fill current path with a top-left lit material: base gradient + clipped texture.
export function materialFill(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  baseColor: string,
  texture: TextureKind,
  seed: number,
  texAlpha = 0.22
): void {
  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  grad.addColorStop(0, shadeColor(baseColor, 1.22));
  grad.addColorStop(0.45, baseColor);
  grad.addColorStop(1, shadeColor(baseColor, 0.62));
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = texAlpha;
  ctx.globalCompositeOperation = 'overlay';
  const tex = noiseTexture(texture, seed);
  ctx.drawImage(tex, x0, y0, x1 - x0, y1 - y0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Rim light on top-left edges, inner shadow bottom-right (call with path retained).
export function edgeLight(ctx: CanvasRenderingContext2D, width = 1.5): void {
  ctx.save();
  ctx.lineWidth = width;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.shadowColor = 'rgba(255,255,255,0.5)';
  ctx.shadowBlur = width * 2;
  ctx.shadowOffsetX = -width * 0.6;
  ctx.shadowOffsetY = -width * 0.6;
  ctx.stroke();
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowOffsetX = width * 0.8;
  ctx.shadowOffsetY = width * 0.8;
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.stroke();
  ctx.restore();
}

// Specular blob (screen blend).
export function specular(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  strength = 0.5
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,255,255,${strength})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.45, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Panel seam lines (machine plating).
export function panelSeams(
  ctx: CanvasRenderingContext2D,
  lines: number[][],
  width = 1.2
): void {
  ctx.save();
  ctx.lineWidth = width;
  ctx.strokeStyle = 'rgba(8,12,20,0.55)';
  for (const pts of lines) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke();
    // light catch below the seam
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1] + width);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1] + width);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(8,12,20,0.55)';
  }
  ctx.restore();
}

// Rivets / bolts.
export function rivets(ctx: CanvasRenderingContext2D, points: number[][], r = 1.4): void {
  for (const [x, y] of points) {
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 0, x, y, r);
    g.addColorStop(0, '#d8e2f2');
    g.addColorStop(0.6, '#5a6a86');
    g.addColorStop(1, '#1a2232');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Organic vein strokes.
export function veins(
  ctx: CanvasRenderingContext2D,
  seed: number,
  cx: number,
  cy: number,
  r: number,
  count: number,
  color: string
): void {
  let s = seed >>> 0;
  const rnd = (): number => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.1;
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const r0 = r * (0.25 + rnd() * 0.3);
    const r1 = r * (0.7 + rnd() * 0.3);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    const mx = cx + Math.cos(a + (rnd() - 0.5) * 0.8) * ((r0 + r1) / 2);
    const my = cy + Math.sin(a + (rnd() - 0.5) * 0.8) * ((r0 + r1) / 2);
    ctx.quadraticCurveTo(mx, my, cx + Math.cos(a + (rnd() - 0.5) * 0.6) * r1, cy + Math.sin(a + (rnd() - 0.5) * 0.6) * r1);
    ctx.stroke();
  }
  ctx.restore();
}

// Soft energy glow (additive), replaces the old flat glowDot.
export function energyGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(0.4, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------- sprite baking ----------
const bakeCache = new Map<string, HTMLCanvasElement>();

// Bake a sprite: run `draw` on an offscreen canvas of `size` px (sprite drawn
// centered). Returns the canvas. Cached by key.
export function bakeSprite(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, c: number) => void): HTMLCanvasElement {
  const cached = bakeCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(size / 2, size / 2);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx, size / 2);
  bakeCache.set(key, canvas);
  return canvas;
}

export function bakedSprite(key: string): HTMLCanvasElement | undefined {
  return bakeCache.get(key);
}
