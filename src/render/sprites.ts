// Sprite pipeline v2: material-rendered sprites baked offscreen (see materials.ts).
// Static bodies are baked once; thin dynamic parts (legs, turret heads, rings,
// smoke, tendrils) are drawn per-frame on top. All original, runtime-generated.
import {
  bakeSprite,
  materialFill,
  edgeLight,
  specular,
  panelSeams,
  rivets,
  veins,
  energyGlow,
  shadeColor
} from './materials';

export type AnimState = {
  time: number;
  moving: boolean;
  attackFlash: number;
  stun?: boolean;
};

const STEEL = '#7f95b5';
const STEEL_DARK = '#2c3a52';
const STEEL_LIGHT = '#aebfd9';
const CYAN = '#3fd2ff';
const ORANGE = '#ff9c41';
const CHITIN = '#5c2f7d';
const CHITIN_DARK = '#3a1b52';
const ACID = '#9dff3f';
const MAGENTA = '#ff4dd2';
const BONE = '#cbb8a0';
const HEAL = '#5cff9d';

function poly(ctx: CanvasRenderingContext2D, pts: number[][]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function circ(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

// Bake canvas → world display size (px). Sprite drawn centered at (0,0).
function blit(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, worldSize: number): void {
  ctx.drawImage(canvas, -worldSize / 2, -worldSize / 2, worldSize, worldSize);
}

// ======================================================================
// WARDEN UNITS (秩序机器 — metal)
// ======================================================================

function bakeSplicer(): HTMLCanvasElement {
  return bakeSprite('splicer', 128, (ctx) => {
    // chassis
    poly(ctx, [[13, 0], [7, 9], [-6, 9], [-11, 0], [-6, -9], [7, -9]]);
    materialFill(ctx, -14, -12, 16, 12, STEEL, 'brushed', 11);
    edgeLight(ctx, 1.6);
    panelSeams(ctx, [[-6, -9, -6, 9], [7, -9, 7, 9]]);
    rivets(ctx, [[-3, -6], [-3, 6], [4, -6], [4, 6]], 1.2);
    // tool arm socket + arm
    ctx.fillStyle = shadeColor(STEEL_DARK, 1.3);
    circ(ctx, 9, 4, 3.2);
    ctx.fill();
    ctx.strokeStyle = shadeColor(ORANGE, 0.9);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(9, 4);
    ctx.lineTo(17, 8);
    ctx.stroke();
    energyGlow(ctx, 17, 8, 6, ORANGE, 0.8);
    // visor
    ctx.fillStyle = '#0c1622';
    ctx.fillRect(2, -4, 7, 4);
    energyGlow(ctx, 5.5, -2, 5, CYAN, 0.9);
    specular(ctx, -4, -5, 8, 0.35);
  });
}

function bakeSentinel(): HTMLCanvasElement {
  return bakeSprite('sentinel', 128, (ctx) => {
    // torso armor
    poly(ctx, [[11, 0], [7, 10], [-8, 11], [-12, 0], [-8, -11], [7, -10]]);
    materialFill(ctx, -14, -13, 14, 13, STEEL, 'brushed', 21);
    edgeLight(ctx, 1.6);
    panelSeams(ctx, [[-8, -11, -8, 11], [2, -10, 2, 10], [-2, -10, -2, 10]]);
    rivets(ctx, [[-5, -8], [-5, 8], [5, -7], [5, 7]], 1.3);
    // shoulder pads
    poly(ctx, [[-1, 10], [-7, 14], [-10, 9]]);
    materialFill(ctx, -10, 9, -1, 14, STEEL_LIGHT, 'grain', 22, 0.15);
    edgeLight(ctx, 1.2);
    poly(ctx, [[-1, -10], [-7, -14], [-10, -9]]);
    materialFill(ctx, -10, -14, -1, -9, STEEL_LIGHT, 'grain', 23, 0.15);
    edgeLight(ctx, 1.2);
    // rail barrel
    ctx.fillStyle = shadeColor(STEEL_DARK, 0.9);
    ctx.fillRect(4, -2.5, 19, 5);
    ctx.fillStyle = shadeColor(STEEL_DARK, 1.4);
    ctx.fillRect(4, -3.5, 5, 7);
    energyGlow(ctx, 15, 0, 7, CYAN, 0.55);
    ctx.strokeStyle = CYAN;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(22, 0);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // optic
    energyGlow(ctx, 4, 0, 4.5, CYAN, 0.95);
    specular(ctx, -3, -6, 9, 0.4);
  });
}

function bakeBulwark(): HTMLCanvasElement {
  return bakeSprite('bulwark', 160, (ctx) => {
    // hull slabs (three plates)
    poly(ctx, [[18, 0], [12, 13], [-15, 15], [-20, 0], [-15, -15], [12, -13]]);
    materialFill(ctx, -22, -17, 20, 17, STEEL, 'brushed', 31);
    edgeLight(ctx, 2);
    panelSeams(ctx, [[-15, -15, -15, 15], [-2, -14, -2, 14], [12, -13, 12, 13]]);
    // inner plate
    poly(ctx, [[13, 0], [8, 8], [-10, 9], [-13, 0], [-10, -9], [8, -8]]);
    materialFill(ctx, -13, -10, 13, 10, STEEL_LIGHT, 'grain', 32, 0.14);
    edgeLight(ctx, 1.4);
    rivets(ctx, [[-17, -12], [-17, 12], [-6, -13], [-6, 13], [9, -11], [9, 11]], 1.6);
    // ram
    poly(ctx, [[26, 0], [15, 7], [15, -7]]);
    materialFill(ctx, 15, -7, 26, 7, ORANGE, 'brushed', 33, 0.18);
    edgeLight(ctx, 1.4);
    // hazard strip on ram
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#1a1206';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(17, -6);
    ctx.lineTo(22, 5);
    ctx.moveTo(20, -6);
    ctx.lineTo(25, 3);
    ctx.stroke();
    ctx.restore();
    // core slit
    ctx.fillStyle = '#0c1622';
    ctx.fillRect(-6, -2, 11, 4);
    energyGlow(ctx, 0, 0, 5.5, CYAN, 0.85);
    specular(ctx, -6, -8, 10, 0.35);
  });
}

function bakeArccaster(): HTMLCanvasElement {
  return bakeSprite('arccaster', 128, (ctx) => {
    // hover platform
    poly(ctx, [[13, 0], [6, 11], [-10, 11], [-15, 0], [-10, -11], [6, -11]]);
    materialFill(ctx, -16, -13, 15, 13, STEEL_DARK, 'brushed', 41);
    edgeLight(ctx, 1.6);
    panelSeams(ctx, [[-10, -11, -10, 11], [6, -11, 6, 11]]);
    rivets(ctx, [[-7, -8], [-7, 8], [2, -9], [2, 9]], 1.2);
    // prongs
    ctx.strokeStyle = shadeColor(STEEL, 1.1);
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(3, 5);
    ctx.lineTo(18, 10);
    ctx.moveTo(3, -5);
    ctx.lineTo(18, -10);
    ctx.stroke();
    ctx.strokeStyle = shadeColor(STEEL_DARK, 0.8);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(5, 5);
    ctx.lineTo(18, 10);
    ctx.moveTo(5, -5);
    ctx.lineTo(18, -10);
    ctx.stroke();
    // arc coil
    circ(ctx, 10, 0, 6.5);
    ctx.fillStyle = '#0c1622';
    ctx.fill();
    energyGlow(ctx, 10, 0, 10, CYAN, 0.9);
    specular(ctx, -4, -6, 9, 0.3);
  });
}

function bakePatchwright(): HTMLCanvasElement {
  return bakeSprite('patchwright', 128, (ctx) => {
    poly(ctx, [[10, 0], [7, 8], [0, 10], [-9, 7], [-12, 0], [-9, -7], [0, -10], [7, -8]]);
    materialFill(ctx, -13, -11, 12, 11, STEEL, 'grain', 51, 0.18);
    edgeLight(ctx, 1.6);
    panelSeams(ctx, [[-9, -7, -9, 7], [7, -8, 7, 8]]);
    // nano canister (glass)
    const g = ctx.createLinearGradient(-8, -5, -1, 5);
    g.addColorStop(0, '#7fd6a8');
    g.addColorStop(0.5, '#2c5b44');
    g.addColorStop(1, '#14271e');
    ctx.fillStyle = g;
    ctx.fillRect(-8, -5, 7, 10);
    ctx.strokeStyle = shadeColor(STEEL_DARK, 1.2);
    ctx.lineWidth = 1;
    ctx.strokeRect(-8, -5, 7, 10);
    specular(ctx, -6.5, -2.5, 4, 0.7);
    energyGlow(ctx, -4.5, 0, 7, HEAL, 0.5);
    // repair arm
    ctx.strokeStyle = shadeColor(STEEL_LIGHT, 1);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(7, 2);
    ctx.lineTo(15, 5);
    ctx.stroke();
    energyGlow(ctx, 15, 5, 5, HEAL, 0.9);
    // optic
    energyGlow(ctx, 4, -2, 3, CYAN, 0.9);
    specular(ctx, -2, -6, 8, 0.35);
  });
}

// ======================================================================
// PHAGE UNITS (自适应入侵体 — chitin / flesh)
// ======================================================================

function bakeMite(): HTMLCanvasElement {
  return bakeSprite('mite', 96, (ctx) => {
    // spikes (bone)
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI * 0.7 + (i / 4) * Math.PI * 1.4;
      poly(ctx, [
        [Math.cos(ang) * 7, Math.sin(ang) * 7],
        [Math.cos(ang) * 15, Math.sin(ang) * 15],
        [Math.cos(ang + 0.35) * 7, Math.sin(ang + 0.35) * 7]
      ]);
      materialFill(ctx, Math.cos(ang) * 15 - 3, Math.sin(ang) * 15 - 3, Math.cos(ang) * 15 + 3, Math.sin(ang) * 15 + 3, BONE, 'grain', 61 + i, 0.15);
      edgeLight(ctx, 1);
    }
    // body
    circ(ctx, 0, 0, 8.5);
    materialFill(ctx, -8, -8, 8, 8, CHITIN, 'chitin', 66);
    edgeLight(ctx, 1.4);
    veins(ctx, 67, 0, 0, 7, 4, MAGENTA);
    energyGlow(ctx, 3, 0, 4, ACID, 0.95);
    specular(ctx, -3, -4, 6, 0.4);
  });
}

function bakeSpitter(): HTMLCanvasElement {
  return bakeSprite('spitter', 112, (ctx) => {
    // tail spikes
    poly(ctx, [[-7, 5], [-18, 10], [-8, 0]]);
    materialFill(ctx, -18, 0, -7, 10, BONE, 'grain', 71, 0.15);
    edgeLight(ctx, 1);
    poly(ctx, [[-7, -5], [-18, -10], [-8, 0]]);
    materialFill(ctx, -18, -10, -7, 0, BONE, 'grain', 72, 0.15);
    edgeLight(ctx, 1);
    // sac body
    circ(ctx, 0, 0, 11);
    materialFill(ctx, -11, -11, 11, 11, CHITIN, 'flesh', 73);
    edgeLight(ctx, 1.5);
    veins(ctx, 74, -1, 0, 9, 5, MAGENTA);
    // acid sacs
    circ(ctx, -3, 4, 3.4);
    materialFill(ctx, -6, 1, 0, 7, ACID, 'flesh', 75, 0.2);
    energyGlow(ctx, -3, 4, 5.5, ACID, 0.6);
    circ(ctx, -4, -5, 2.6);
    materialFill(ctx, -7, -8, -1, -2, ACID, 'flesh', 76, 0.2);
    energyGlow(ctx, -4, -5, 4.5, ACID, 0.5);
    // spout
    poly(ctx, [[9, 4], [19, 0], [9, -4]]);
    materialFill(ctx, 9, -4, 19, 4, MAGENTA, 'flesh', 77);
    edgeLight(ctx, 1.2);
    specular(ctx, -4, -5, 8, 0.35);
  });
}

function bakeLeech(): HTMLCanvasElement {
  return bakeSprite('leech', 128, (ctx) => {
    // segments (back to front)
    for (let i = 3; i >= 0; i--) {
      const x = -i * 8.5;
      const r = 7 - i * 0.8;
      circ(ctx, x, 0, r);
      materialFill(ctx, x - r, -r, x + r, r, i % 2 === 0 ? CHITIN : CHITIN_DARK, 'chitin', 81 + i);
      edgeLight(ctx, 1.2);
    }
    // head mandibles (bone)
    ctx.strokeStyle = shadeColor(BONE, 1.1);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(4, 4);
    ctx.lineTo(14, 9);
    ctx.moveTo(4, -4);
    ctx.lineTo(14, -9);
    ctx.stroke();
    energyGlow(ctx, 5, 0, 4, MAGENTA, 0.85);
    specular(ctx, -8, -4, 7, 0.3);
  });
}

function bakeCarrier(): HTMLCanvasElement {
  return bakeSprite('carrier', 160, (ctx) => {
    // back spikes
    for (let i = 0; i < 6; i++) {
      const ang = -Math.PI * 0.75 + (i / 5) * Math.PI * 1.5;
      poly(ctx, [
        [Math.cos(ang) * 14, Math.sin(ang) * 14],
        [Math.cos(ang) * 28, Math.sin(ang) * 28],
        [Math.cos(ang + 0.3) * 14, Math.sin(ang + 0.3) * 14]
      ]);
      materialFill(ctx, Math.cos(ang) * 28 - 4, Math.sin(ang) * 28 - 4, Math.cos(ang) * 28 + 4, Math.sin(ang) * 28 + 4, BONE, 'grain', 91 + i, 0.14);
      edgeLight(ctx, 1.2);
    }
    // main sack
    circ(ctx, 0, 0, 19);
    materialFill(ctx, -19, -19, 19, 19, CHITIN, 'flesh', 96);
    edgeLight(ctx, 2);
    veins(ctx, 97, 0, 0, 15, 8, MAGENTA);
    // incubation sacs
    for (let i = 0; i < 3; i++) {
      const ang = (i * Math.PI * 2) / 3 + 0.5;
      const x = Math.cos(ang) * 8;
      const y = Math.sin(ang) * 8;
      circ(ctx, x, y, 4.5);
      materialFill(ctx, x - 4, y - 4, x + 4, y + 4, ACID, 'flesh', 98 + i, 0.2);
      energyGlow(ctx, x, y, 6.5, ACID, 0.5);
    }
    // maw
    poly(ctx, [[16, 5], [25, 0], [16, -5]]);
    materialFill(ctx, 16, -5, 25, 5, CHITIN_DARK, 'flesh', 99);
    edgeLight(ctx, 1.2);
    specular(ctx, -6, -8, 11, 0.35);
  });
}

function bakeRavager(): HTMLCanvasElement {
  return bakeSprite('ravager', 192, (ctx) => {
    // claws (bone, big)
    poly(ctx, [[10, 15], [30, 20], [35, 12], [18, 8]]);
    materialFill(ctx, 10, 8, 35, 20, BONE, 'chitin', 101);
    edgeLight(ctx, 1.6);
    poly(ctx, [[10, -15], [30, -20], [35, -12], [18, -8]]);
    materialFill(ctx, 10, -20, 35, -8, BONE, 'chitin', 102);
    edgeLight(ctx, 1.6);
    // carapace
    poly(ctx, [[20, 0], [13, 17], [-10, 22], [-22, 10], [-22, -10], [-10, -22], [13, -17]]);
    materialFill(ctx, -24, -24, 22, 24, CHITIN, 'chitin', 103);
    edgeLight(ctx, 2.2);
    // armor ridges
    panelSeams(ctx, [
      [-14, -15, -10, 15],
      [-6, -19, -2, 19],
      [2, -17, 6, 17]
    ], 2.2);
    veins(ctx, 104, -4, 0, 18, 7, MAGENTA);
    energyGlow(ctx, 10, 0, 6.5, ACID, 0.8);
    specular(ctx, -8, -12, 13, 0.35);
  });
}

function bakeInvasionCore(): HTMLCanvasElement {
  return bakeSprite('invasion_core', 256, (ctx) => {
    // spikes (8, bone-chitin)
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      poly(ctx, [
        [Math.cos(ang) * 26, Math.sin(ang) * 26],
        [Math.cos(ang) * 46, Math.sin(ang) * 46],
        [Math.cos(ang + 0.25) * 26, Math.sin(ang + 0.25) * 26]
      ]);
      materialFill(ctx, Math.cos(ang) * 46 - 6, Math.sin(ang) * 46 - 6, Math.cos(ang) * 46 + 6, Math.sin(ang) * 46 + 6, CHITIN_DARK, 'chitin', 111 + i);
      edgeLight(ctx, 1.5);
    }
    // body sphere
    circ(ctx, 0, 0, 30);
    materialFill(ctx, -30, -30, 30, 30, CHITIN, 'flesh', 120);
    edgeLight(ctx, 2.5);
    veins(ctx, 121, 0, 0, 24, 10, MAGENTA);
    // core
    circ(ctx, 0, 0, 13);
    ctx.fillStyle = '#0e2404';
    ctx.fill();
    energyGlow(ctx, 0, 0, 22, ACID, 1);
    specular(ctx, -8, -10, 14, 0.4);
  });
}

// ======================================================================
// BUILDINGS
// ======================================================================

function bakeCitadel(): HTMLCanvasElement {
  return bakeSprite('citadel', 384, (ctx) => {
    // hex foundation
    poly(ctx, [[88, 0], [44, 76], [-44, 76], [-88, 0], [-44, -76], [44, -76]]);
    materialFill(ctx, -90, -78, 90, 78, STEEL_DARK, 'brushed', 201);
    edgeLight(ctx, 3);
    panelSeams(ctx, [[-44, -76, -44, 76], [44, -76, 44, 76], [-88, 0, 88, 0]], 2);
    rivets(ctx, [[-70, -20], [-70, 20], [70, -20], [70, 20], [0, -70], [0, 70]], 2.4);
    // server towers
    const towers: [number, number, number][] = [[-32, -22, 44], [7, -32, 56], [28, 15, 36]];
    for (const [x, y, h] of towers) {
      ctx.fillStyle = shadeColor(STEEL_DARK, 0.7);
      ctx.fillRect(x - 13, y - h / 2 + 4, 26, h);
      poly(ctx, [[x - 13, y - h / 2 + 4], [x + 13, y - h / 2 + 4], [x + 13, y + h / 2 + 4], [x - 13, y + h / 2 + 4]]);
      materialFill(ctx, x - 13, y - h / 2, x + 13, y + h / 2 + 4, STEEL, 'brushed', 202 + x);
      edgeLight(ctx, 1.6);
      // vents
      ctx.fillStyle = '#101826';
      for (let i = 0; i < 3; i++) ctx.fillRect(x - 9, y - h / 2 + 8 + i * 10, 18, 4);
      energyGlow(ctx, x, y - h / 2 - 2, 6, CYAN, 0.6);
    }
    // central core housing
    poly(ctx, [[18, 10], [9, 26], [-9, 26], [-18, 10], [-9, -6], [9, -6]]);
    materialFill(ctx, -18, -8, 18, 26, STEEL_LIGHT, 'grain', 210, 0.16);
    edgeLight(ctx, 1.8);
    energyGlow(ctx, 0, 10, 22, CYAN, 0.55);
    // antenna
    ctx.strokeStyle = shadeColor(ORANGE, 1);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(38, -38);
    ctx.lineTo(48, -66);
    ctx.stroke();
    energyGlow(ctx, 48, -66, 7, ORANGE, 0.8);
  });
}

function bakeFabricator(): HTMLCanvasElement {
  return bakeSprite('fabricator', 320, (ctx) => {
    // main body
    poly(ctx, [[70, 25], [70, -25], [25, -42], [-70, -42], [-70, 42], [25, 42]]);
    materialFill(ctx, -72, -44, 72, 44, STEEL_DARK, 'brushed', 221);
    edgeLight(ctx, 2.5);
    // roof plating
    poly(ctx, [[62, 20], [62, -20], [22, -35], [-62, -35], [-62, 35], [22, 35]]);
    materialFill(ctx, -64, -36, 64, 36, STEEL, 'brushed', 222);
    edgeLight(ctx, 2);
    panelSeams(ctx, [[-30, -35, -30, 35], [10, -35, 10, 35], [-62, 0, 62, 0]], 1.8);
    rivets(ctx, [[-55, -28], [-55, 28], [55, -15], [55, 15], [-15, -30], [-15, 30]], 2);
    // chimney
    poly(ctx, [[-58, -30], [-42, -30], [-42, -58], [-58, -58]]);
    materialFill(ctx, -58, -58, -42, -30, STEEL_DARK, 'brushed', 223);
    edgeLight(ctx, 1.5);
    // conveyor door
    ctx.fillStyle = '#0c1420';
    ctx.fillRect(34, -15, 26, 30);
    ctx.strokeStyle = ORANGE;
    ctx.lineWidth = 2;
    ctx.strokeRect(34, -15, 26, 30);
    ctx.strokeStyle = 'rgba(255,156,65,0.4)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(34, -15 + i * 7.5);
      ctx.lineTo(60, -15 + i * 7.5);
      ctx.stroke();
    }
    energyGlow(ctx, -10, 0, 16, CYAN, 0.3);
  });
}

function bakeUplink(): HTMLCanvasElement {
  return bakeSprite('uplink', 256, (ctx) => {
    // base pad
    poly(ctx, [[50, 0], [25, 43], [-25, 43], [-50, 0], [-25, -43], [25, -43]]);
    materialFill(ctx, -52, -45, 52, 45, STEEL_DARK, 'brushed', 231);
    edgeLight(ctx, 2.2);
    rivets(ctx, [[-30, -20], [30, -20], [-30, 20], [30, 20]], 2);
    // mast
    poly(ctx, [[8, 0], [4, -44], [-4, -44], [-8, 0]]);
    materialFill(ctx, -9, -45, 9, 0, STEEL, 'brushed', 232);
    edgeLight(ctx, 1.6);
    // side fins
    poly(ctx, [[13, 13], [30, 25], [13, 28]]);
    materialFill(ctx, 13, 13, 30, 28, ORANGE, 'brushed', 233, 0.16);
    edgeLight(ctx, 1.2);
    poly(ctx, [[-13, 13], [-30, 25], [-13, 28]]);
    materialFill(ctx, -30, 13, -13, 28, ORANGE, 'brushed', 234, 0.16);
    edgeLight(ctx, 1.2);
    energyGlow(ctx, 0, -46, 9, CYAN, 0.9);
  });
}

function bakeCapacitor(): HTMLCanvasElement {
  return bakeSprite('capacitor', 192, (ctx) => {
    // pylon base
    poly(ctx, [[33, 0], [16, 28], [-16, 28], [-33, 0], [-16, -28], [16, -28]]);
    materialFill(ctx, -35, -30, 35, 30, STEEL_DARK, 'brushed', 241);
    edgeLight(ctx, 2);
    rivets(ctx, [[-20, -12], [20, -12], [-20, 12], [20, 12]], 1.6);
    // crystal
    poly(ctx, [[0, -26], [11, -5], [6, 15], [-6, 15], [-11, -5]]);
    materialFill(ctx, -12, -27, 12, 15, STEEL_LIGHT, 'crystal', 242, 0.3);
    edgeLight(ctx, 1.5);
    energyGlow(ctx, 0, -6, 20, CYAN, 0.6);
    // ring
    ctx.strokeStyle = shadeColor(ORANGE, 1);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 18, 20, 6.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function bakeTurretBase(): HTMLCanvasElement {
  return bakeSprite('turret_base', 192, (ctx) => {
    poly(ctx, [[35, 0], [17, 30], [-17, 30], [-35, 0], [-17, -30], [17, -30]]);
    materialFill(ctx, -37, -32, 37, 32, STEEL_DARK, 'brushed', 251);
    edgeLight(ctx, 2.2);
    rivets(ctx, [[-22, -14], [22, -14], [-22, 14], [22, 14], [0, -26], [0, 26]], 1.8);
    panelSeams(ctx, [[-17, -30, 17, 30]], 1.5);
  });
}

function bakeTurretHead(): HTMLCanvasElement {
  return bakeSprite('turret_head', 128, (ctx) => {
    circ(ctx, 0, 0, 14);
    materialFill(ctx, -14, -14, 14, 14, STEEL, 'brushed', 252);
    edgeLight(ctx, 1.6);
    // twin barrels
    ctx.fillStyle = shadeColor(STEEL_DARK, 0.85);
    ctx.fillRect(6, -7, 22, 5);
    ctx.fillRect(6, 2, 22, 5);
    ctx.fillStyle = shadeColor(STEEL_DARK, 1.3);
    ctx.fillRect(24, -7.5, 5, 6);
    ctx.fillRect(24, 1.5, 5, 6);
    energyGlow(ctx, 0, 0, 7, ORANGE, 0.65);
    specular(ctx, -4, -6, 8, 0.4);
  });
}

function bakeSpawner(): HTMLCanvasElement {
  return bakeSprite('spawner', 384, (ctx) => {
    // mound
    circ(ctx, 0, 0, 58);
    materialFill(ctx, -58, -58, 58, 58, CHITIN, 'flesh', 261);
    edgeLight(ctx, 3);
    veins(ctx, 262, 0, 0, 46, 12, MAGENTA);
    // orifices
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2 + 0.4;
      const x = Math.cos(ang) * 32;
      const y = Math.sin(ang) * 32;
      circ(ctx, x, y, 10);
      ctx.fillStyle = '#160a24';
      ctx.fill();
      edgeLight(ctx, 1.4);
      energyGlow(ctx, x, y, 11, ACID, 0.4);
    }
    energyGlow(ctx, 0, 0, 26, MAGENTA, 0.45);
    specular(ctx, -15, -18, 22, 0.3);
  });
}

// ======================================================================
// RESOURCE NODES & PROJECTILES
// ======================================================================

function drawShardNode(ctx: CanvasRenderingContext2D, frac: number, t: number): void {
  const shards: [number, number, number, number][] = [
    [0, 0, 14, 1],
    [-12, 8, 9, 0.7],
    [11, 9, 8, 0.5]
  ];
  for (const [x, y, h, s] of shards) {
    const hh = h * (0.5 + frac * 0.5);
    poly(ctx, [[x, y - hh * s * 2], [x + 7 * s, y], [x, y + 6 * s], [x - 7 * s, y]]);
    materialFill(ctx, x - 7 * s, y - hh * s * 2, x + 7 * s, y + 6 * s, '#2b7ea6', 'crystal', 300 + x, 0.35);
    edgeLight(ctx, 1.2);
  }
  energyGlow(ctx, 0, 0, 18, CYAN, 0.3 + Math.sin(t * 2) * 0.1 + frac * 0.15);
}

function drawFluxNode(ctx: CanvasRenderingContext2D, frac: number, t: number): void {
  poly(ctx, [[15, 5], [8, 13], [-8, 13], [-15, 5], [-8, -3], [8, -3]]);
  materialFill(ctx, -16, -4, 16, 14, '#5a4228', 'grain', 310);
  edgeLight(ctx, 1.5);
  const jet = 0.45 + Math.sin(t * 5) * 0.2 + frac * 0.3;
  ctx.strokeStyle = `rgba(255, 156, 65, ${Math.min(1, jet + 0.2)})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(Math.sin(t * 7) * 3.5, -20 - frac * 8);
  ctx.stroke();
  energyGlow(ctx, 0, -8, 20, ORANGE, jet);
}

// ======================================================================
// PUBLIC DRAW API (called by renderer each frame)
// ======================================================================

const UNIT_WORLD: Record<string, number> = {
  splicer: 34,
  sentinel: 40,
  bulwark: 56,
  arccaster: 42,
  patchwright: 36,
  mite: 30,
  spitter: 38,
  leech: 44,
  carrier: 60,
  ravager: 76,
  invasion_core: 120
};

export function drawUnit(ctx: CanvasRenderingContext2D, defId: string, anim: AnimState): void {
  const size = UNIT_WORLD[defId] ?? 40;
  const moving = anim.moving;
  switch (defId) {
    case 'splicer': {
      // legs (dynamic)
      const sw = moving ? Math.sin(anim.time * 12) * 5 : 0;
      ctx.strokeStyle = shadeColor(STEEL_DARK, 0.9);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-3, 5);
      ctx.lineTo(-8 + sw, 13);
      ctx.moveTo(-3, -5);
      ctx.lineTo(-8 - sw, -13);
      ctx.stroke();
      blit(ctx, bakeSplicer(), size);
      break;
    }
    case 'sentinel': {
      const sw = moving ? Math.sin(anim.time * 10) * 6 : 0;
      ctx.strokeStyle = shadeColor(STEEL_DARK, 0.9);
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-4, 6);
      ctx.lineTo(-7 + sw, 17);
      ctx.moveTo(-4, -6);
      ctx.lineTo(-7 - sw, -17);
      ctx.stroke();
      blit(ctx, bakeSentinel(), size);
      break;
    }
    case 'bulwark': {
      // treads (dynamic)
      const off = moving ? (anim.time * 30) % 6 : 0;
      ctx.fillStyle = '#141c2c';
      ctx.fillRect(-22, 12, 40, 10);
      ctx.fillRect(-22, -22, 40, 10);
      ctx.fillStyle = '#2a3854';
      for (let i = -22; i < 18; i += 6) {
        ctx.fillRect(i + off, 13.5, 3.5, 7);
        ctx.fillRect(i + off, -20.5, 3.5, 7);
      }
      blit(ctx, bakeBulwark(), size);
      break;
    }
    case 'arccaster': {
      ctx.translate(0, Math.sin(anim.time * 3) * 2);
      blit(ctx, bakeArccaster(), size);
      break;
    }
    case 'patchwright':
      blit(ctx, bakePatchwright(), size);
      break;
    case 'mite':
      ctx.rotate(moving ? Math.sin(anim.time * 16) * 0.12 : 0);
      blit(ctx, bakeMite(), size);
      break;
    case 'spitter': {
      const b = 1 + Math.sin(anim.time * 4) * 0.05;
      ctx.scale(b, b);
      blit(ctx, bakeSpitter(), size);
      break;
    }
    case 'leech': {
      if (moving) ctx.rotate(Math.sin(anim.time * 10) * 0.1);
      blit(ctx, bakeLeech(), size);
      break;
    }
    case 'carrier': {
      const p = 1 + Math.sin(anim.time * 2.5) * 0.04;
      ctx.scale(p, p);
      blit(ctx, bakeCarrier(), size);
      break;
    }
    case 'ravager':
      blit(ctx, bakeRavager(), size);
      break;
    case 'invasion_core': {
      // rotating outer ring (dynamic)
      ctx.save();
      ctx.rotate(anim.time * 0.5);
      ctx.strokeStyle = MAGENTA;
      ctx.lineWidth = 3.5;
      ctx.setLineDash([16, 9]);
      ctx.beginPath();
      ctx.arc(0, 0, 44, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      blit(ctx, bakeInvasionCore(), size);
      ctx.save();
      ctx.rotate(-anim.time * 0.9);
      ctx.strokeStyle = ACID;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 7]);
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      break;
    }
    default:
      blit(ctx, bakeSplicer(), size);
  }
  if (anim.attackFlash > 0) {
    energyGlow(ctx, size * 0.4, 0, size * 0.35 * anim.attackFlash, '#ffffff', anim.attackFlash * 0.7);
  }
}

const BUILDING_WORLD: Record<string, number> = {
  citadel: 190,
  fabricator: 150,
  uplink: 110,
  capacitor: 76,
  turret: 80,
  spawner: 220
};

export function drawBuilding(
  ctx: CanvasRenderingContext2D,
  defId: string,
  time: number,
  construction: number,
  attackFlash: number
): void {
  if (construction < 1) drawScaffold(ctx, defId, construction);
  const size = BUILDING_WORLD[defId] ?? 80;
  const alpha = construction < 1 ? 0.45 + construction * 0.4 : 1;
  ctx.globalAlpha = alpha;
  switch (defId) {
    case 'citadel':
      blit(ctx, bakeCitadel(), size);
      energyGlow(ctx, 48, -66, 6, ORANGE, 0.5 + Math.sin(time * 5) * 0.4);
      break;
    case 'fabricator': {
      blit(ctx, bakeFabricator(), size);
      // smoke (dynamic)
      const smoke = (time * 18) % 36;
      ctx.globalAlpha = alpha * Math.max(0, 0.45 * (1 - smoke / 36));
      energyGlow(ctx, -50, -60 - smoke, 9, 'rgba(150,160,180,0.8)', 0.5);
      ctx.globalAlpha = alpha;
      // crane swing
      const swing = Math.sin(time * 0.8) * 0.3;
      ctx.strokeStyle = shadeColor(ORANGE, 1);
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-12, -12);
      ctx.lineTo(-12 + Math.cos(swing) * 32, -12 - Math.sin(swing + 1.2) * 24);
      ctx.stroke();
      break;
    }
    case 'uplink': {
      blit(ctx, bakeUplink(), size);
      // floating dish rings (dynamic)
      for (let i = 0; i < 3; i++) {
        const r = 13 + i * 10 + Math.sin(time * 2 + i) * 2.5;
        ctx.strokeStyle = `rgba(63, 210, 255, ${0.55 - i * 0.13})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(0, -46, r, r * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case 'capacitor':
      blit(ctx, bakeCapacitor(), size);
      energyGlow(ctx, 0, -6, 18, CYAN, 0.4 + Math.sin(time * 3) * 0.2);
      break;
    case 'turret': {
      blit(ctx, bakeTurretBase(), size);
      const ang = time * 0.6;
      ctx.save();
      ctx.rotate(ang);
      blit(ctx, bakeTurretHead(), 56);
      ctx.restore();
      if (attackFlash > 0) energyGlow(ctx, Math.cos(ang) * 28, Math.sin(ang) * 28, 14 * attackFlash, ORANGE, attackFlash);
      break;
    }
    case 'spawner': {
      // tendrils (dynamic, under mound)
      ctx.strokeStyle = shadeColor(CHITIN_DARK, 0.9);
      ctx.lineWidth = 5;
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2;
        const wob = Math.sin(time * 2 + i * 1.3) * 12;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * 36, Math.sin(ang) * 36);
        ctx.quadraticCurveTo(
          Math.cos(ang) * 72 + wob,
          Math.sin(ang) * 72 + wob,
          Math.cos(ang) * 102,
          Math.sin(ang) * 102
        );
        ctx.stroke();
      }
      blit(ctx, bakeSpawner(), size);
      // pulsing orifice glow
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + 0.4;
        energyGlow(ctx, Math.cos(ang) * 32, Math.sin(ang) * 32, 10, ACID, 0.3 + Math.sin(time * 3 + i) * 0.15);
      }
      break;
    }
  }
  ctx.globalAlpha = 1;
}

function drawScaffold(ctx: CanvasRenderingContext2D, defId: string, progress: number): void {
  const size = (BUILDING_WORLD[defId] ?? 80) * 0.9;
  ctx.strokeStyle = 'rgba(63, 210, 255, 0.65)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([7, 5]);
  ctx.strokeRect(-size / 2, -size / 2, size, size);
  ctx.setLineDash([]);
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, -size / 2 - 10, 8, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  ctx.stroke();
}

export function drawNode(
  ctx: CanvasRenderingContext2D,
  nodeType: 'shards' | 'flux',
  frac: number,
  t: number
): void {
  if (nodeType === 'shards') drawShardNode(ctx, frac, t);
  else drawFluxNode(ctx, frac, t);
}

export function drawProjectile(ctx: CanvasRenderingContext2D, defId: string, _angle: number): void {
  switch (defId) {
    case 'rail':
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-9, 0);
      ctx.lineTo(5, 0);
      ctx.stroke();
      energyGlow(ctx, 5, 0, 5, CYAN, 0.9);
      break;
    case 'arc':
      ctx.strokeStyle = '#9be7ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-9, 0);
      ctx.lineTo(-2, -3.5);
      ctx.lineTo(4, 3.5);
      ctx.lineTo(10, 0);
      ctx.stroke();
      energyGlow(ctx, 10, 0, 6, CYAN, 0.8);
      break;
    case 'goo':
      circ(ctx, 0, 0, 4.5);
      materialFill(ctx, -4, -4, 4, 4, ACID, 'flesh', 320);
      energyGlow(ctx, 0, 0, 8, ACID, 0.6);
      break;
    case 'flame':
      poly(ctx, [[10, 0], [0, 5], [-7, 0], [0, -5]]);
      materialFill(ctx, -7, -5, 10, 5, ORANGE, 'grain', 321);
      energyGlow(ctx, 0, 0, 9, ORANGE, 0.7);
      break;
    case 'corebeam':
      circ(ctx, 0, 0, 8);
      materialFill(ctx, -8, -8, 8, 8, MAGENTA, 'flesh', 322);
      energyGlow(ctx, 0, 0, 15, MAGENTA, 0.8);
      break;
    default:
      energyGlow(ctx, 0, 0, 4, '#ffffff', 0.8);
  }
}
