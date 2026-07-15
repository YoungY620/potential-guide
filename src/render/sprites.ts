// Procedural original vector art for every unit, building and resource node.
// Two visual languages:
//  - Warden (秩序机器): angular industrial plating, steel blue + orange, cyan glows.
//  - Phage (自适应入侵体): semi-organic digital growths, violet + acid green.
// All drawing happens in local space facing +X; caller applies translate/rotate.

export type AnimState = {
  time: number; // seconds, global clock
  moving: boolean;
  attackFlash: number; // 0..1 muzzle/impact flash
  stun?: boolean;
};

const WARDEN_PLATE = '#7f95b5';
const WARDEN_DARK = '#2c3a52';
const WARDEN_LIGHT = '#aebfd9';
const WARDEN_CYAN = '#3fd2ff';
const WARDEN_ORANGE = '#ff9c41';
const PHAGE_CHITIN = '#5c2f7d';
const PHAGE_DARK = '#3a1b52';
const PHAGE_ACID = '#9dff3f';
const PHAGE_MAGENTA = '#ff4dd2';

function poly(ctx: CanvasRenderingContext2D, pts: number[][], close = true): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  circle(ctx, x, y, r);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ============ UNITS ============
export function drawUnit(ctx: CanvasRenderingContext2D, defId: string, anim: AnimState): void {
  switch (defId) {
    case 'splicer':
      return drawSplicer(ctx, anim);
    case 'sentinel':
      return drawSentinel(ctx, anim);
    case 'bulwark':
      return drawBulwark(ctx, anim);
    case 'arccaster':
      return drawArccaster(ctx, anim);
    case 'patchwright':
      return drawPatchwright(ctx, anim);
    case 'mite':
      return drawMite(ctx, anim);
    case 'spitter':
      return drawSpitter(ctx, anim);
    case 'leech':
      return drawLeech(ctx, anim);
    case 'carrier':
      return drawCarrier(ctx, anim);
    case 'ravager':
      return drawRavager(ctx, anim);
    case 'invasion_core':
      return drawInvasionCore(ctx, anim);
    default:
      // unknown: faceted gem fallback (never a plain rectangle)
      ctx.fillStyle = '#8899aa';
      poly(ctx, [[10, 0], [0, 8], [-10, 0], [0, -8]]);
      ctx.fill();
  }
}

function walkBob(anim: AnimState, amp: number, freq = 10): number {
  return anim.moving ? Math.sin(anim.time * freq) * amp : 0;
}

function drawSplicer(ctx: CanvasRenderingContext2D, a: AnimState): void {
  const bob = walkBob(a, 1.5);
  // legs
  ctx.strokeStyle = WARDEN_DARK;
  ctx.lineWidth = 2.5;
  const legSwing = a.moving ? Math.sin(a.time * 12) * 4 : 0;
  ctx.beginPath();
  ctx.moveTo(-2, 4);
  ctx.lineTo(-6 + legSwing, 10);
  ctx.moveTo(-2, -4);
  ctx.lineTo(-6 - legSwing, -10);
  ctx.stroke();
  // hex body
  ctx.fillStyle = WARDEN_PLATE;
  poly(ctx, [[9, 0], [4, 6], [-4, 6], [-8, 0], [-4, -6], [4, -6]]);
  ctx.fill();
  ctx.strokeStyle = WARDEN_DARK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // tool arm
  ctx.strokeStyle = WARDEN_ORANGE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(6, 2 + bob * 0.3);
  ctx.lineTo(12, 5 + bob * 0.3);
  ctx.stroke();
  glowDot(ctx, 12, 5 + bob * 0.3, 4, WARDEN_ORANGE, 0.7);
  // visor
  ctx.fillStyle = WARDEN_CYAN;
  ctx.fillRect(2, -2 + bob * 0.2, 4, 2.5);
}

function drawSentinel(ctx: CanvasRenderingContext2D, a: AnimState): void {
  // legs
  ctx.strokeStyle = WARDEN_DARK;
  ctx.lineWidth = 3;
  const sw = a.moving ? Math.sin(a.time * 10) * 5 : 0;
  ctx.beginPath();
  ctx.moveTo(-3, 5);
  ctx.lineTo(-5 + sw, 13);
  ctx.moveTo(-3, -5);
  ctx.lineTo(-5 - sw, -13);
  ctx.stroke();
  // torso
  ctx.fillStyle = WARDEN_PLATE;
  poly(ctx, [[8, 0], [5, 7], [-6, 8], [-9, 0], [-6, -8], [5, -7]]);
  ctx.fill();
  ctx.strokeStyle = WARDEN_DARK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // shoulder pads
  ctx.fillStyle = WARDEN_LIGHT;
  poly(ctx, [[-1, 8], [-6, 11], [-8, 7]]);
  ctx.fill();
  poly(ctx, [[-1, -8], [-6, -11], [-8, -7]]);
  ctx.fill();
  // rail barrel
  ctx.strokeStyle = WARDEN_DARK;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.lineTo(17, 0);
  ctx.stroke();
  ctx.strokeStyle = WARDEN_CYAN;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(17, 0);
  ctx.stroke();
  if (a.attackFlash > 0) glowDot(ctx, 18, 0, 8 * a.attackFlash, WARDEN_CYAN, a.attackFlash);
  // eye
  glowDot(ctx, 3, 0, 3, WARDEN_CYAN, 0.9);
}

function drawBulwark(ctx: CanvasRenderingContext2D, a: AnimState): void {
  const bob = walkBob(a, 1, 7);
  // treads
  ctx.fillStyle = WARDEN_DARK;
  ctx.fillRect(-14, 8 + bob, 24, 7);
  ctx.fillRect(-14, -15 - bob, 24, 7);
  ctx.fillStyle = '#1c2637';
  for (let i = -12; i < 10; i += 5) {
    ctx.fillRect(i, 9 + bob, 3, 5);
    ctx.fillRect(i, -14 - bob, 3, 5);
  }
  // hull slab
  ctx.fillStyle = WARDEN_PLATE;
  poly(ctx, [[14, 0], [9, 10], [-12, 12], [-16, 0], [-12, -12], [9, -10]]);
  ctx.fill();
  ctx.strokeStyle = '#101826';
  ctx.lineWidth = 2;
  ctx.stroke();
  // armor layers
  ctx.fillStyle = WARDEN_LIGHT;
  poly(ctx, [[10, 0], [6, 6], [-8, 7], [-10, 0], [-8, -7], [6, -6]]);
  ctx.fill();
  // ram
  ctx.fillStyle = WARDEN_ORANGE;
  poly(ctx, [[20, 0], [12, 5], [12, -5]]);
  ctx.fill();
  if (a.attackFlash > 0) glowDot(ctx, 20, 0, 12 * a.attackFlash, WARDEN_ORANGE, a.attackFlash);
  // core slit
  ctx.fillStyle = WARDEN_CYAN;
  ctx.fillRect(-4, -1, 8, 2);
}

function drawArccaster(ctx: CanvasRenderingContext2D, a: AnimState): void {
  const hover = Math.sin(a.time * 3) * 1.5;
  ctx.translate(0, hover);
  // hover platform
  ctx.fillStyle = WARDEN_DARK;
  poly(ctx, [[10, 0], [4, 9], [-8, 9], [-12, 0], [-8, -9], [4, -9]]);
  ctx.fill();
  ctx.strokeStyle = WARDEN_PLATE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // prongs
  ctx.strokeStyle = WARDEN_PLATE;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(2, 4);
  ctx.lineTo(14, 8);
  ctx.moveTo(2, -4);
  ctx.lineTo(14, -8);
  ctx.stroke();
  // arc coil
  const pulse = 0.6 + Math.sin(a.time * 6) * 0.3;
  glowDot(ctx, 8, 0, 7, WARDEN_CYAN, pulse);
  ctx.strokeStyle = WARDEN_CYAN;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(8, 0, 4.5, 0, Math.PI * 2);
  ctx.stroke();
  if (a.attackFlash > 0) {
    ctx.strokeStyle = `rgba(63, 210, 255, ${a.attackFlash})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, 8);
    ctx.lineTo(20 + 6 * a.attackFlash, 0);
    ctx.lineTo(14, -8);
    ctx.stroke();
  }
}

function drawPatchwright(ctx: CanvasRenderingContext2D, a: AnimState): void {
  const bob = walkBob(a, 1.4, 9);
  // rounded body
  ctx.fillStyle = WARDEN_PLATE;
  poly(ctx, [[8, 0], [5, 6], [0, 8], [-7, 5], [-9, 0], [-7, -5], [0, -8], [5, -6]]);
  ctx.fill();
  ctx.strokeStyle = WARDEN_DARK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // nano canister
  ctx.fillStyle = '#3a5b4f';
  ctx.fillRect(-6, -3 + bob * 0.2, 5, 6);
  glowDot(ctx, -3.5, 0, 5, '#5cff9d', 0.6);
  // repair arm
  ctx.strokeStyle = WARDEN_LIGHT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(5, 1);
  ctx.lineTo(12, 3 + bob * 0.4);
  ctx.stroke();
  ctx.strokeStyle = '#5cff9d';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(12, 3 + bob * 0.4);
  ctx.lineTo(15, 3 + bob * 0.4);
  ctx.stroke();
  glowDot(ctx, 15, 3 + bob * 0.4, 3.5, '#5cff9d', 0.8);
  // eye
  ctx.fillStyle = WARDEN_CYAN;
  circle(ctx, 3, -1, 1.6);
  ctx.fill();
}

// ---- Phage ----
function drawMite(ctx: CanvasRenderingContext2D, a: AnimState): void {
  const wiggle = a.moving ? Math.sin(a.time * 16) * 0.25 : 0;
  ctx.rotate(wiggle * 0.3);
  // spikes
  ctx.fillStyle = PHAGE_DARK;
  for (let i = 0; i < 5; i++) {
    const ang = -Math.PI * 0.7 + (i / 4) * Math.PI * 1.4;
    poly(ctx, [
      [Math.cos(ang) * 6, Math.sin(ang) * 6],
      [Math.cos(ang) * 13, Math.sin(ang) * 13],
      [Math.cos(ang + 0.35) * 6, Math.sin(ang + 0.35) * 6]
    ]);
    ctx.fill();
  }
  // body blob
  ctx.fillStyle = PHAGE_CHITIN;
  circle(ctx, 0, 0, 7);
  ctx.fill();
  ctx.strokeStyle = PHAGE_MAGENTA;
  ctx.lineWidth = 1;
  ctx.stroke();
  glowDot(ctx, 2, 0, 3, PHAGE_ACID, 0.9);
}

function drawSpitter(ctx: CanvasRenderingContext2D, a: AnimState): void {
  const breathe = 1 + Math.sin(a.time * 4) * 0.06;
  ctx.scale(breathe, breathe);
  // tail spikes
  ctx.fillStyle = PHAGE_DARK;
  poly(ctx, [[-6, 4], [-15, 8], [-7, 0]]);
  ctx.fill();
  poly(ctx, [[-6, -4], [-15, -8], [-7, 0]]);
  ctx.fill();
  // sac body
  ctx.fillStyle = PHAGE_CHITIN;
  circle(ctx, 0, 0, 9);
  ctx.fill();
  ctx.strokeStyle = PHAGE_DARK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // acid sacs
  glowDot(ctx, -2, 3, 4, PHAGE_ACID, 0.5 + Math.sin(a.time * 5) * 0.2);
  glowDot(ctx, -3, -4, 3, PHAGE_ACID, 0.4);
  // spout
  ctx.fillStyle = PHAGE_MAGENTA;
  poly(ctx, [[7, 3], [15, 0], [7, -3]]);
  ctx.fill();
  if (a.attackFlash > 0) glowDot(ctx, 15, 0, 7 * a.attackFlash, PHAGE_ACID, a.attackFlash);
}

function drawLeech(ctx: CanvasRenderingContext2D, a: AnimState): void {
  // segmented body
  const wob = a.moving ? Math.sin(a.time * 10) : 0;
  for (let i = 3; i >= 0; i--) {
    const off = Math.sin(a.time * 10 - i * 0.9) * (a.moving ? 2.5 : 0.6);
    ctx.fillStyle = i % 2 === 0 ? PHAGE_CHITIN : PHAGE_DARK;
    circle(ctx, -i * 7, off * (i / 3), 6 - i * 0.7);
    ctx.fill();
  }
  // head mandibles
  ctx.strokeStyle = PHAGE_ACID;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(3, 3);
  ctx.lineTo(11, 7 + wob);
  ctx.moveTo(3, -3);
  ctx.lineTo(11, -7 - wob);
  ctx.stroke();
  glowDot(ctx, 4, 0, 3, PHAGE_MAGENTA, 0.8);
}

function drawCarrier(ctx: CanvasRenderingContext2D, a: AnimState): void {
  const pulse = 1 + Math.sin(a.time * 2.5) * 0.05;
  ctx.scale(pulse, pulse);
  // back spikes
  ctx.fillStyle = PHAGE_DARK;
  for (let i = 0; i < 6; i++) {
    const ang = -Math.PI * 0.75 + (i / 5) * Math.PI * 1.5;
    poly(ctx, [
      [Math.cos(ang) * 12, Math.sin(ang) * 12],
      [Math.cos(ang) * 24, Math.sin(ang) * 24],
      [Math.cos(ang + 0.3) * 12, Math.sin(ang + 0.3) * 12]
    ]);
    ctx.fill();
  }
  // main sack
  ctx.fillStyle = PHAGE_CHITIN;
  circle(ctx, 0, 0, 16);
  ctx.fill();
  ctx.strokeStyle = PHAGE_MAGENTA;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // incubation sacs
  for (let i = 0; i < 3; i++) {
    const ang = a.time * 0.8 + (i * Math.PI * 2) / 3;
    glowDot(ctx, Math.cos(ang) * 7, Math.sin(ang) * 7, 4.5, PHAGE_ACID, 0.55);
  }
  // maw
  ctx.fillStyle = PHAGE_DARK;
  poly(ctx, [[13, 4], [20, 0], [13, -4]]);
  ctx.fill();
}

function drawRavager(ctx: CanvasRenderingContext2D, a: AnimState): void {
  const bob = walkBob(a, 2, 6);
  // massive claws
  ctx.fillStyle = PHAGE_DARK;
  const clawLift = a.attackFlash > 0 ? -6 * a.attackFlash : 0;
  poly(ctx, [[8, 12], [24, 16 + bob + clawLift], [28, 10 + clawLift], [14, 6]]);
  ctx.fill();
  poly(ctx, [[8, -12], [24, -16 - bob - clawLift], [28, -10 - clawLift], [14, -6]]);
  ctx.fill();
  // carapace
  ctx.fillStyle = PHAGE_CHITIN;
  poly(ctx, [[16, 0], [10, 14], [-8, 18], [-18, 8], [-18, -8], [-8, -18], [10, -14]]);
  ctx.fill();
  ctx.strokeStyle = PHAGE_MAGENTA;
  ctx.lineWidth = 2;
  ctx.stroke();
  // armor ridges
  ctx.strokeStyle = PHAGE_DARK;
  ctx.lineWidth = 2.5;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(-10 + i * 6, -12);
    ctx.lineTo(-6 + i * 6, 12);
    ctx.stroke();
  }
  glowDot(ctx, 8, 0, 5, PHAGE_ACID, 0.7 + Math.sin(a.time * 3) * 0.2);
  if (a.attackFlash > 0) glowDot(ctx, 26, 0, 16 * a.attackFlash, PHAGE_MAGENTA, a.attackFlash * 0.7);
}

function drawInvasionCore(ctx: CanvasRenderingContext2D, a: AnimState): void {
  const t = a.time;
  // outer ring (rotating)
  ctx.save();
  ctx.rotate(t * 0.5);
  ctx.strokeStyle = PHAGE_MAGENTA;
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  // spikes
  ctx.fillStyle = PHAGE_DARK;
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2 + t * 0.2;
    poly(ctx, [
      [Math.cos(ang) * 22, Math.sin(ang) * 22],
      [Math.cos(ang) * 40, Math.sin(ang) * 40],
      [Math.cos(ang + 0.25) * 22, Math.sin(ang + 0.25) * 22]
    ]);
    ctx.fill();
  }
  // body
  ctx.fillStyle = PHAGE_CHITIN;
  circle(ctx, 0, 0, 26);
  ctx.fill();
  ctx.strokeStyle = PHAGE_MAGENTA;
  ctx.lineWidth = 2;
  ctx.stroke();
  // inner counter-rotating ring
  ctx.save();
  ctx.rotate(-t * 0.9);
  ctx.strokeStyle = PHAGE_ACID;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  glowDot(ctx, 0, 0, 12, PHAGE_ACID, 0.6 + Math.sin(t * 4) * 0.3);
}

// ============ BUILDINGS ============
export function drawBuilding(
  ctx: CanvasRenderingContext2D,
  defId: string,
  time: number,
  construction: number,
  attackFlash: number
): void {
  if (construction < 1) {
    drawScaffold(ctx, defId, construction);
    ctx.globalAlpha = 0.45 + construction * 0.4;
  }
  switch (defId) {
    case 'citadel':
      drawCitadel(ctx, time);
      break;
    case 'fabricator':
      drawFabricator(ctx, time);
      break;
    case 'uplink':
      drawUplink(ctx, time);
      break;
    case 'capacitor':
      drawCapacitor(ctx, time);
      break;
    case 'turret':
      drawTurret(ctx, time, attackFlash);
      break;
    case 'spawner':
      drawSpawner(ctx, time);
      break;
  }
  ctx.globalAlpha = 1;
}

function drawScaffold(ctx: CanvasRenderingContext2D, defId: string, progress: number): void {
  const size = defId === 'citadel' ? 80 : defId === 'fabricator' ? 64 : defId === 'uplink' ? 48 : defId === 'spawner' ? 96 : 32;
  ctx.strokeStyle = 'rgba(63, 210, 255, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(-size / 2, -size / 2, size, size);
  ctx.setLineDash([]);
  // progress arc
  ctx.strokeStyle = WARDEN_CYAN;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, -size / 2 - 10, 8, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  ctx.stroke();
}

function drawCitadel(ctx: CanvasRenderingContext2D, t: number): void {
  // hex foundation
  ctx.fillStyle = WARDEN_DARK;
  poly(ctx, [[70, 0], [35, 60], [-35, 60], [-70, 0], [-35, -60], [35, -60]]);
  ctx.fill();
  ctx.strokeStyle = WARDEN_CYAN;
  ctx.lineWidth = 2;
  ctx.globalAlpha *= 0.9;
  ctx.stroke();
  ctx.globalAlpha /= 0.9;
  // server towers
  const towers: [number, number, number][] = [[-25, -18, 34], [5, -25, 44], [22, 12, 28]];
  for (const [x, y, h] of towers) {
    ctx.fillStyle = WARDEN_PLATE;
    ctx.fillRect(x - 10, y - h / 2, 20, h);
    ctx.fillStyle = WARDEN_DARK;
    for (let i = 0; i < 3; i++) ctx.fillRect(x - 7, y - h / 2 + 4 + i * 8, 14, 3);
    glowDot(ctx, x, y - h / 2 - 3, 4, WARDEN_CYAN, 0.5 + Math.sin(t * 2 + x) * 0.3);
  }
  // central core
  glowDot(ctx, 0, 8, 22, WARDEN_CYAN, 0.5 + Math.sin(t * 1.5) * 0.15);
  ctx.fillStyle = WARDEN_LIGHT;
  poly(ctx, [[14, 8], [7, 20], [-7, 20], [-14, 8], [-7, -4], [7, -4]]);
  ctx.fill();
  ctx.strokeStyle = WARDEN_DARK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // antenna
  ctx.strokeStyle = WARDEN_ORANGE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(30, -30);
  ctx.lineTo(38, -52);
  ctx.stroke();
  glowDot(ctx, 38, -52, 4, WARDEN_ORANGE, 0.6 + Math.sin(t * 5) * 0.4);
}

function drawFabricator(ctx: CanvasRenderingContext2D, t: number): void {
  // base
  ctx.fillStyle = WARDEN_DARK;
  poly(ctx, [[56, 20], [56, -20], [20, -34], [-56, -34], [-56, 34], [20, 34]]);
  ctx.fill();
  ctx.strokeStyle = '#101826';
  ctx.lineWidth = 2;
  ctx.stroke();
  // roof plating
  ctx.fillStyle = WARDEN_PLATE;
  poly(ctx, [[50, 16], [50, -16], [18, -28], [-50, -28], [-50, 28], [18, 28]]);
  ctx.fill();
  // chimney
  ctx.fillStyle = WARDEN_DARK;
  ctx.fillRect(-44, -22, 12, 22);
  const smoke = (t * 20) % 30;
  glowDot(ctx, -38, -24 - smoke, 6, 'rgba(150,160,180,0.5)', 0.5 * (1 - smoke / 30));
  // conveyor door
  ctx.fillStyle = '#101826';
  ctx.fillRect(28, -12, 20, 24);
  ctx.strokeStyle = WARDEN_ORANGE;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(28, -12, 20, 24);
  // crane arm
  ctx.strokeStyle = WARDEN_ORANGE;
  ctx.lineWidth = 3;
  const swing = Math.sin(t * 0.8) * 0.3;
  ctx.beginPath();
  ctx.moveTo(-10, -10);
  ctx.lineTo(-10 + Math.cos(swing) * 26, -10 - Math.sin(swing + 1.2) * 20);
  ctx.stroke();
  glowDot(ctx, 0, 0, 12, WARDEN_CYAN, 0.3);
}

function drawUplink(ctx: CanvasRenderingContext2D, t: number): void {
  // base pad
  ctx.fillStyle = WARDEN_DARK;
  poly(ctx, [[40, 0], [20, 34], [-20, 34], [-40, 0], [-20, -34], [20, -34]]);
  ctx.fill();
  // mast
  ctx.fillStyle = WARDEN_PLATE;
  poly(ctx, [[6, 0], [3, -34], [-3, -34], [-6, 0]]);
  ctx.fill();
  // dish rings
  for (let i = 0; i < 3; i++) {
    const r = 10 + i * 8 + Math.sin(t * 2 + i) * 2;
    ctx.strokeStyle = `rgba(63, 210, 255, ${0.5 - i * 0.12})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, -34, r, r * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  glowDot(ctx, 0, -38, 6, WARDEN_CYAN, 0.6 + Math.sin(t * 6) * 0.4);
  // side fins
  ctx.fillStyle = WARDEN_ORANGE;
  poly(ctx, [[10, 10], [24, 20], [10, 22]]);
  ctx.fill();
  poly(ctx, [[-10, 10], [-24, 20], [-10, 22]]);
  ctx.fill();
}

function drawCapacitor(ctx: CanvasRenderingContext2D, t: number): void {
  // pylon base
  ctx.fillStyle = WARDEN_DARK;
  poly(ctx, [[26, 0], [13, 22], [-13, 22], [-26, 0], [-13, -22], [13, -22]]);
  ctx.fill();
  ctx.strokeStyle = WARDEN_CYAN;
  ctx.lineWidth = 1;
  ctx.globalAlpha *= 0.7;
  ctx.stroke();
  ctx.globalAlpha /= 0.7;
  // crystal
  const glow = 0.5 + Math.sin(t * 3) * 0.25;
  ctx.fillStyle = WARDEN_LIGHT;
  poly(ctx, [[0, -20], [9, -4], [5, 12], [-5, 12], [-9, -4]]);
  ctx.fill();
  ctx.strokeStyle = WARDEN_CYAN;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  glowDot(ctx, 0, -4, 16, WARDEN_CYAN, glow);
  // ring
  ctx.strokeStyle = WARDEN_ORANGE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 14, 16, 5, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawTurret(ctx: CanvasRenderingContext2D, t: number, attackFlash: number): void {
  // base plate
  ctx.fillStyle = WARDEN_DARK;
  poly(ctx, [[28, 0], [14, 24], [-14, 24], [-28, 0], [-14, -24], [14, -24]]);
  ctx.fill();
  ctx.strokeStyle = WARDEN_ORANGE;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha *= 0.8;
  ctx.stroke();
  ctx.globalAlpha /= 0.8;
  // rotating head (slow scan)
  const ang = t * 0.6;
  ctx.save();
  ctx.rotate(ang);
  ctx.fillStyle = WARDEN_PLATE;
  circle(ctx, 0, 0, 12);
  ctx.fill();
  ctx.strokeStyle = '#101826';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // twin barrels
  ctx.strokeStyle = WARDEN_DARK;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(6, 4);
  ctx.lineTo(22, 4);
  ctx.moveTo(6, -4);
  ctx.lineTo(22, -4);
  ctx.stroke();
  ctx.strokeStyle = WARDEN_ORANGE;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(10, 4);
  ctx.lineTo(22, 4);
  ctx.moveTo(10, -4);
  ctx.lineTo(22, -4);
  ctx.stroke();
  ctx.restore();
  glowDot(ctx, 0, 0, 6, WARDEN_ORANGE, 0.5 + Math.sin(t * 4) * 0.2);
  if (attackFlash > 0) glowDot(ctx, Math.cos(ang) * 22, Math.sin(ang) * 22, 10 * attackFlash, WARDEN_ORANGE, attackFlash);
}

function drawSpawner(ctx: CanvasRenderingContext2D, t: number): void {
  // tendrils
  ctx.strokeStyle = PHAGE_DARK;
  ctx.lineWidth = 4;
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2;
    const wob = Math.sin(t * 2 + i * 1.3) * 10;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * 30, Math.sin(ang) * 30);
    ctx.quadraticCurveTo(
      Math.cos(ang) * 60 + wob,
      Math.sin(ang) * 60 + wob,
      Math.cos(ang) * 85,
      Math.sin(ang) * 85
    );
    ctx.stroke();
  }
  // mound
  ctx.fillStyle = PHAGE_CHITIN;
  circle(ctx, 0, 0, 48);
  ctx.fill();
  ctx.strokeStyle = PHAGE_MAGENTA;
  ctx.lineWidth = 2;
  ctx.stroke();
  // orifices
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + 0.4;
    const x = Math.cos(ang) * 26;
    const y = Math.sin(ang) * 26;
    ctx.fillStyle = PHAGE_DARK;
    circle(ctx, x, y, 8 + Math.sin(t * 3 + i) * 2);
    ctx.fill();
    glowDot(ctx, x, y, 9, PHAGE_ACID, 0.35 + Math.sin(t * 3 + i) * 0.15);
  }
  glowDot(ctx, 0, 0, 20, PHAGE_MAGENTA, 0.4 + Math.sin(t * 1.8) * 0.15);
}

// ============ RESOURCE NODES ============
export function drawNode(ctx: CanvasRenderingContext2D, nodeType: 'shards' | 'flux', frac: number, t: number): void {
  if (nodeType === 'shards') {
    // data shard cluster: cyan crystal facets
    const shards: [number, number, number, number][] = [
      [0, 0, 10, 1],
      [-9, 6, 7, 0.7],
      [8, 7, 6, 0.5]
    ];
    for (const [x, y, h, s] of shards) {
      const hh = h * (0.5 + frac * 0.5);
      ctx.fillStyle = '#1d5f7d';
      poly(ctx, [[x, y - hh * s * 2], [x + 5 * s, y], [x, y + 4 * s], [x - 5 * s, y]]);
      ctx.fill();
      ctx.strokeStyle = WARDEN_CYAN;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    glowDot(ctx, 0, 0, 14, WARDEN_CYAN, 0.25 + Math.sin(t * 2) * 0.1 + frac * 0.1);
  } else {
    // flux vent: orange energy geyser
    ctx.fillStyle = '#4d3421';
    poly(ctx, [[12, 4], [6, 10], [-6, 10], [-12, 4], [-6, -2], [6, -2]]);
    ctx.fill();
    ctx.strokeStyle = WARDEN_ORANGE;
    ctx.lineWidth = 1;
    ctx.stroke();
    const jet = 0.4 + Math.sin(t * 5) * 0.2 + frac * 0.3;
    glowDot(ctx, 0, -6, 16, WARDEN_ORANGE, jet);
    ctx.strokeStyle = `rgba(255, 156, 65, ${jet})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(Math.sin(t * 7) * 3, -16 - frac * 6);
    ctx.stroke();
  }
}

// ============ PROJECTILES ============
export function drawProjectile(ctx: CanvasRenderingContext2D, defId: string, angle: number): void {
  ctx.rotate(angle);
  switch (defId) {
    case 'rail':
      ctx.strokeStyle = WARDEN_CYAN;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(4, 0);
      ctx.stroke();
      glowDot(ctx, 4, 0, 4, WARDEN_CYAN, 0.9);
      break;
    case 'arc':
      ctx.strokeStyle = '#9be7ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(-2, -3);
      ctx.lineTo(3, 3);
      ctx.lineTo(8, 0);
      ctx.stroke();
      glowDot(ctx, 8, 0, 5, WARDEN_CYAN, 0.8);
      break;
    case 'goo':
      ctx.fillStyle = PHAGE_ACID;
      circle(ctx, 0, 0, 4);
      ctx.fill();
      glowDot(ctx, 0, 0, 7, PHAGE_ACID, 0.6);
      break;
    case 'flame':
      ctx.fillStyle = WARDEN_ORANGE;
      poly(ctx, [[8, 0], [0, 4], [-6, 0], [0, -4]]);
      ctx.fill();
      glowDot(ctx, 0, 0, 8, WARDEN_ORANGE, 0.7);
      break;
    case 'corebeam':
      ctx.fillStyle = PHAGE_MAGENTA;
      circle(ctx, 0, 0, 7);
      ctx.fill();
      glowDot(ctx, 0, 0, 14, PHAGE_MAGENTA, 0.8);
      break;
    default:
      glowDot(ctx, 0, 0, 4, '#ffffff', 0.8);
  }
}
