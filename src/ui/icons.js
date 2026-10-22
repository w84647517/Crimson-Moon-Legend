// 程序化装备图标：不依赖任何外部图片，全部用 Canvas 矢量绘制后缓存
// 参考传奇系端游背包图标：武器/衣服/头盔/项链/手镯/戒指/腰带/靴子/勋章
import { DATA } from '../data/gamedata.js';
import { ASSETS } from './assets.js';

// 每个稀有度一套金属 + 宝石配色
const PAL = [
  { metal: '#9aa0a6', hi: '#e8edf1', lo: '#4b5157', gem: '#cfc7b8', line: '#262a2d' }, // 普通
  { metal: '#7fa26a', hi: '#d6edbd', lo: '#3c5330', gem: '#63c56f', line: '#1d2a17' }, // 精良
  { metal: '#6f93c9', hi: '#d3e7ff', lo: '#2f4668', gem: '#54a8ff', line: '#141f33' }, // 稀有
  { metal: '#9a7fc9', hi: '#e3d3ff', lo: '#453460', gem: '#b678ff', line: '#221735' }, // 史诗
  { metal: '#c99a52', hi: '#ffe9bd', lo: '#5d4221', gem: '#ffa23f', line: '#301d0b' }, // 传说
  { metal: '#c96a5a', hi: '#ffd2c4', lo: '#5d2a22', gem: '#ff5a5a', line: '#300f0b' }, // 神话
];

const GOLD = '#c9a45c';
const GOLD_HI = '#ffe1a1';
const LEATHER = '#4a2f1e';
const RENDER_SIZE = 96;
const DESIGN = 48;

const cache = new Map();

function rad(hex, a) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function mix(a, b, t) {
  const p = (h) => {
    let s = h.replace('#', '');
    if (s.length === 3) s = s.split('').map((c) => c + c).join('');
    const n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const x = p(a);
  const y = p(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * t));
  return '#' + ((1 << 24) | (c[0] << 16) | (c[1] << 8) | c[2]).toString(16).slice(1);
}

function metalGrad(ctx, x0, y0, x1, y1, pal) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, pal.hi);
  g.addColorStop(0.35, pal.metal);
  g.addColorStop(0.72, mix(pal.metal, pal.lo, 0.55));
  g.addColorStop(1, pal.lo);
  return g;
}

function gem(ctx, x, y, r, pal, glow) {
  if (glow) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4);
    g.addColorStop(0, rad(pal.gem, 0.85));
    g.addColorStop(0.45, rad(pal.gem, 0.28));
    g.addColorStop(1, rad(pal.gem, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // 四角宝石
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.82, y - r * 0.16);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.82, y - r * 0.16);
  ctx.closePath();
  ctx.fillStyle = gemGrad(ctx, x, y - r, x, y + r, pal);
  ctx.fill();
  ctx.strokeStyle = rad('#ffffff', 0.55);
  ctx.lineWidth = 0.6;
  ctx.stroke();
  // 高光棱面
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.4, y - r * 0.1);
  ctx.lineTo(x, y + r * 0.55);
  ctx.closePath();
  ctx.fillStyle = rad('#ffffff', 0.42);
  ctx.fill();
}

function gemGrad(ctx, x0, y0, x1, y1, pal) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, mix(pal.gem, '#ffffff', 0.62));
  g.addColorStop(0.42, pal.gem);
  g.addColorStop(1, mix(pal.gem, '#000000', 0.45));
  return g;
}

function star(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(r * 0.22, -r);
    ctx.lineTo(-r * 0.22, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------ 各部位形状 ------------------------------ */

function sword(ctx, pal) {
  ctx.save();
  ctx.rotate(-0.14);
  // 剑身
  ctx.beginPath();
  ctx.moveTo(0, -21);
  ctx.lineTo(4.2, -11);
  ctx.lineTo(3.5, 6);
  ctx.lineTo(0, 8);
  ctx.lineTo(-3.5, 6);
  ctx.lineTo(-4.2, -11);
  ctx.closePath();
  ctx.fillStyle = metalGrad(ctx, -4, -21, 4, 8, pal);
  ctx.fill();
  ctx.strokeStyle = rad(pal.hi, 0.5);
  ctx.lineWidth = 0.5;
  ctx.stroke();
  // 中脊
  ctx.fillStyle = rad('#ffffff', 0.42);
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(0.8, -10);
  ctx.lineTo(0, 6);
  ctx.lineTo(-0.8, -10);
  ctx.closePath();
  ctx.fill();
  // 护手
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-8.2, 7.4, 16.4, 3.2, 1.4) : ctx.rect(-8.2, 7.4, 16.4, 3.2);
  ctx.fill();
  ctx.fillStyle = rad(GOLD_HI, 0.85);
  ctx.fillRect(-8, 7.6, 16, 1);
  // 握柄
  ctx.fillStyle = LEATHER;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-2.2, 10.6, 4.4, 7.6, 1.6) : ctx.rect(-2.2, 10.6, 4.4, 7.6);
  ctx.fill();
  ctx.strokeStyle = rad('#c9a45c', 0.55);
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-2.1, 12 + i * 2);
    ctx.lineTo(2.1, 13 + i * 2);
    ctx.stroke();
  }
  // 剑首
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(0, 19.4, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rad(GOLD_HI, 0.7);
  ctx.beginPath();
  ctx.arc(-0.6, 18.7, 1, 0, Math.PI * 2);
  ctx.fill();
  // 剑格宝石
  gem(ctx, 0, 9, 1.7, pal, true);
  ctx.restore();
}

function axe(ctx, pal) {
  ctx.save();
  ctx.rotate(0.1);
  // 斧柄
  const g = ctx.createLinearGradient(-1.5, 0, 1.5, 0);
  g.addColorStop(0, '#3a2415');
  g.addColorStop(0.45, '#7a5230');
  g.addColorStop(1, '#33200f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-1.5, -11, 3, 30, 1.2) : ctx.rect(-1.5, -11, 3, 30);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,12,6,0.85)';
  ctx.lineWidth = 0.7;
  ctx.stroke();
  // 斧头（单刃阔斧）
  ctx.beginPath();
  ctx.moveTo(-1.5, -13);
  ctx.lineTo(-12, -16);
  ctx.quadraticCurveTo(-19, -8, -17, 0);
  ctx.quadraticCurveTo(-14, 6, -9, 5);
  ctx.lineTo(-5, 2.5);
  ctx.lineTo(-2, 3.5);
  ctx.closePath();
  ctx.fillStyle = metalGrad(ctx, -15, -15, -2, 4, pal);
  ctx.fill();
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 1;
  ctx.stroke();
  // 刃口冷光
  ctx.beginPath();
  ctx.moveTo(-12.4, -15);
  ctx.quadraticCurveTo(-18, -8, -16.2, 0);
  ctx.quadraticCurveTo(-14, 4.6, -10, 4.4);
  ctx.strokeStyle = rad('#ffffff', 0.7);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // 斧面高光
  ctx.beginPath();
  ctx.moveTo(-9, -10);
  ctx.quadraticCurveTo(-12, -5, -10, 1);
  ctx.strokeStyle = rad(pal.hi, 0.45);
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // 顶端尖刺
  ctx.beginPath();
  ctx.moveTo(-1, -12);
  ctx.lineTo(5.4, -17.4);
  ctx.lineTo(2.4, -9.4);
  ctx.closePath();
  ctx.fillStyle = metalGrad(ctx, 0, -17, 4, -9, pal);
  ctx.fill();
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 0.7;
  ctx.stroke();
  // 加固环 + 宝石
  ctx.fillStyle = GOLD;
  ctx.fillRect(-2.4, -2.6, 4.8, 1.9);
  ctx.strokeStyle = 'rgba(60,38,12,0.7)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(-2.4, -2.6, 4.8, 1.9);
  gem(ctx, 0, 2.2, 1.7, pal, true);
  // 缠绳
  ctx.strokeStyle = rad('#d9b06a', 0.45);
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-1.6, 8 + i * 2.6);
    ctx.lineTo(1.6, 9 + i * 2.6);
    ctx.stroke();
  }
  ctx.restore();
}

function staff(ctx, pal) {
  ctx.save();
  ctx.rotate(0.1);
  // 杖身
  const g = ctx.createLinearGradient(-1.6, 0, 1.6, 0);
  g.addColorStop(0, '#3b2414');
  g.addColorStop(0.45, '#8a5e36');
  g.addColorStop(1, '#2f1c0e');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-1.5, -6, 3, 27, 1.4) : ctx.rect(-1.5, -6, 3, 27);
  ctx.fill();
  // 金环
  ctx.fillStyle = GOLD;
  ctx.fillRect(-2.1, 13, 4.2, 1.6);
  ctx.fillRect(-2.1, -5, 4.2, 1.6);
  // 杖首双爪
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-1.6, -6);
  ctx.quadraticCurveTo(-9, -14, -5, -20);
  ctx.moveTo(1.6, -6);
  ctx.quadraticCurveTo(9, -14, 5, -20);
  ctx.stroke();
  ctx.strokeStyle = rad(GOLD_HI, 0.7);
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // 宝珠
  const orb = ctx.createRadialGradient(-1.5, -16, 0.5, 0, -13, 8);
  orb.addColorStop(0, '#ffffff');
  orb.addColorStop(0.3, mix(pal.gem, '#ffffff', 0.45));
  orb.addColorStop(0.75, pal.gem);
  orb.addColorStop(1, rad(pal.gem, 0));
  ctx.fillStyle = orb;
  ctx.beginPath();
  ctx.arc(0, -13, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rad('#ffffff', 0.9);
  ctx.beginPath();
  ctx.arc(-1.8, -15, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function taoBlade(ctx, pal) {
  ctx.save();
  ctx.rotate(-0.12);
  // 弯曲的窄刃
  ctx.beginPath();
  ctx.moveTo(2.4, -21);
  ctx.quadraticCurveTo(7.4, -8, 3.4, 6);
  ctx.lineTo(-0.6, 7.4);
  ctx.quadraticCurveTo(-2.4, -7, -1.2, -17);
  ctx.closePath();
  ctx.fillStyle = metalGrad(ctx, -2, -20, 5, 7, pal);
  ctx.fill();
  ctx.strokeStyle = rad(pal.hi, 0.5);
  ctx.lineWidth = 0.5;
  ctx.stroke();
  // 刃口
  ctx.beginPath();
  ctx.moveTo(2.2, -19.4);
  ctx.quadraticCurveTo(6.4, -8, 2.8, 4.4);
  ctx.strokeStyle = rad('#ffffff', 0.6);
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // 护手
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-5.4, 7, 11, 2.6, 1.1) : ctx.rect(-5.4, 7, 11, 2.6);
  ctx.fill();
  // 柄 + 红穗
  ctx.fillStyle = LEATHER;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-1.8, 9.6, 3.6, 7, 1.4) : ctx.rect(-1.8, 9.6, 3.6, 7);
  ctx.fill();
  ctx.strokeStyle = '#b8423a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 16.6);
  ctx.quadraticCurveTo(-2.4, 19, -1.2, 21);
  ctx.moveTo(0, 16.6);
  ctx.quadraticCurveTo(2.2, 19, 1.4, 21);
  ctx.stroke();
  gem(ctx, 0, 8.3, 1.5, pal, true);
  ctx.restore();
}

function fan(ctx, pal) {
  ctx.save();
  ctx.translate(0, 4);
  ctx.rotate(-0.2);
  // 扇面
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.arc(0, 12, 21, Math.PI * 1.18, Math.PI * 1.82);
  ctx.closePath();
  ctx.fillStyle = metalGrad(ctx, -14, -8, 12, 12, pal);
  ctx.fill();
  ctx.strokeStyle = rad(pal.hi, 0.55);
  ctx.lineWidth = 0.7;
  ctx.stroke();
  // 扇骨
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 0.8;
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI * 1.18 + (Math.PI * 0.64 * i) / 6;
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(Math.cos(a) * 20, 12 + Math.sin(a) * 20);
    ctx.stroke();
  }
  // 扇坠
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(0, 13, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b8423a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 15);
  ctx.lineTo(0, 20);
  ctx.stroke();
  gem(ctx, 0, -2, 2, pal, true);
  ctx.restore();
}

function heavyArmor(ctx, pal) {
  // 胸甲
  ctx.beginPath();
  ctx.moveTo(-12.5, -8);
  ctx.lineTo(-9, -14);
  ctx.lineTo(9, -14);
  ctx.lineTo(12.5, -8);
  ctx.lineTo(10.5, 5);
  ctx.lineTo(6.5, 11);
  ctx.lineTo(-6.5, 11);
  ctx.lineTo(-10.5, 5);
  ctx.closePath();
  ctx.fillStyle = metalGrad(ctx, -10, -14, 10, 11, pal);
  ctx.fill();
  ctx.strokeStyle = rad(pal.hi, 0.5);
  ctx.lineWidth = 0.6;
  ctx.stroke();
  // 肩甲
  ctx.fillStyle = mix(pal.metal, '#ffffff', 0.18);
  ctx.beginPath();
  ctx.ellipse(-11.4, -9.4, 4.2, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(11.4, -9.4, 4.2, 6, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rad(pal.lo, 0.6);
  ctx.beginPath();
  ctx.ellipse(-11.4, -8.6, 3, 4.4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(11.4, -8.6, 3, 4.4, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // 领口
  ctx.fillStyle = rad(GOLD, 0.9);
  ctx.beginPath();
  ctx.moveTo(-5, -14);
  ctx.quadraticCurveTo(0, -9.4, 5, -14);
  ctx.lineTo(3.4, -14);
  ctx.quadraticCurveTo(0, -11, -3.4, -14);
  ctx.closePath();
  ctx.fill();
  // 胸口中线
  ctx.strokeStyle = rad(GOLD_HI, 0.35);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(0, 9);
  ctx.stroke();
  // 腰带
  ctx.fillStyle = mix(pal.lo, '#000000', 0.2);
  ctx.fillRect(-9, 7, 18, 2.6);
  gem(ctx, 0, -2.5, 2.6, pal, true);
}

function robe(ctx, pal) {
  // 长袍轮廓
  ctx.beginPath();
  ctx.moveTo(-7, -15);
  ctx.lineTo(7, -15);
  ctx.lineTo(10, -2);
  ctx.lineTo(13.5, 16);
  ctx.lineTo(-13.5, 16);
  ctx.lineTo(-10, -2);
  ctx.closePath();
  ctx.fillStyle = metalGrad(ctx, -9, -15, 9, 16, pal);
  ctx.fill();
  ctx.strokeStyle = rad(pal.hi, 0.42);
  ctx.lineWidth = 0.6;
  ctx.stroke();
  // 内衬
  ctx.beginPath();
  ctx.moveTo(-4, -14);
  ctx.lineTo(0, -2);
  ctx.lineTo(4, -14);
  ctx.closePath();
  ctx.fillStyle = mix(pal.lo, '#000000', 0.28);
  ctx.fill();
  // 衣襟
  ctx.strokeStyle = rad(GOLD, 0.85);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.lineTo(0, 15);
  ctx.stroke();
  // 下摆饰边
  ctx.fillStyle = rad(GOLD, 0.7);
  ctx.fillRect(-13, 13.4, 26, 1.4);
  // 袖口
  ctx.fillStyle = mix(pal.metal, '#ffffff', 0.1);
  ctx.beginPath();
  ctx.moveTo(-7.4, -14);
  ctx.lineTo(-12, -9);
  ctx.lineTo(-10.6, 1);
  ctx.lineTo(-7.6, -1);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(7.4, -14);
  ctx.lineTo(12, -9);
  ctx.lineTo(10.6, 1);
  ctx.lineTo(7.6, -1);
  ctx.closePath();
  ctx.fill();
  gem(ctx, 0, -6.5, 2.4, pal, true);
}

function helmet(ctx, pal, rarity) {
  // 盔体
  ctx.beginPath();
  ctx.moveTo(-10.5, 3);
  ctx.quadraticCurveTo(-11.5, -13, 0, -15);
  ctx.quadraticCurveTo(11.5, -13, 10.5, 3);
  ctx.lineTo(7.4, 6);
  ctx.lineTo(-7.4, 6);
  ctx.closePath();
  ctx.fillStyle = metalGrad(ctx, -8, -14, 8, 6, pal);
  ctx.fill();
  ctx.strokeStyle = rad(pal.hi, 0.5);
  ctx.lineWidth = 0.6;
  ctx.stroke();
  // 面甲缝
  ctx.fillStyle = '#120c09';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-8, -1.4, 16, 2.8, 1.2) : ctx.rect(-8, -1.4, 16, 2.8);
  ctx.fill();
  ctx.fillStyle = rad(pal.gem, 0.75);
  ctx.fillRect(-6.6, -0.5, 13.2, 1);
  // 护颊
  ctx.fillStyle = mix(pal.metal, '#000000', 0.28);
  ctx.beginPath();
  ctx.moveTo(-10.4, 2);
  ctx.lineTo(-8, 10);
  ctx.lineTo(-4.4, 8);
  ctx.lineTo(-4.6, 2.4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(10.4, 2);
  ctx.lineTo(8, 10);
  ctx.lineTo(4.4, 8);
  ctx.lineTo(4.6, 2.4);
  ctx.closePath();
  ctx.fill();
  // 中脊
  ctx.strokeStyle = rad(GOLD, 0.8);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -14.6);
  ctx.lineTo(0, -2.4);
  ctx.stroke();
  gem(ctx, 0, -9.5, 2, pal, true);
  if (rarity >= 3) {
    // 双角
    ctx.strokeStyle = pal.hi;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-8.6, -10);
    ctx.quadraticCurveTo(-15, -16, -12.6, -21);
    ctx.moveTo(8.6, -10);
    ctx.quadraticCurveTo(15, -16, 12.6, -21);
    ctx.stroke();
  }
  if (rarity >= 4) {
    // 冠羽
    ctx.fillStyle = rad(pal.gem, 0.85);
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.quadraticCurveTo(2.4, -21, 0, -23);
    ctx.quadraticCurveTo(-2.4, -21, 0, -15);
    ctx.fill();
  }
}

function necklace(ctx, pal) {
  // 链身
  ctx.strokeStyle = mix(pal.metal, GOLD, 0.4);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-13, -8);
  ctx.quadraticCurveTo(0, -17, 13, -8);
  ctx.stroke();
  // 链珠
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const x = -13 + 26 * t;
    const y = -8 - Math.sin(t * Math.PI) * 8.4;
    pts.push([x, y]);
  }
  for (let i = 0; i < pts.length; i++) {
    ctx.fillStyle = i % 2 ? mix(pal.hi, '#ffffff', 0.2) : pal.metal;
    ctx.beginPath();
    ctx.arc(pts[i][0], pts[i][1], 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // 吊坠
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(-4, -1);
  ctx.lineTo(4, -1);
  ctx.lineTo(2.4, 3.6);
  ctx.lineTo(-2.4, 3.6);
  ctx.closePath();
  ctx.fill();
  gem(ctx, 0, 6.6, 4.2, pal, true);
  // 坠尖
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.lineTo(1.8, 9);
  ctx.lineTo(-1.8, 9);
  ctx.closePath();
  ctx.fill();
}

function bracelet(ctx, pal) {
  ctx.save();
  ctx.rotate(-0.35);
  // 镯身
  ctx.beginPath();
  ctx.ellipse(0, 0, 11.5, 9.4, 0, 0, Math.PI * 2);
  ctx.strokeStyle = metalGrad(ctx, -12, -10, 12, 10, pal);
  ctx.lineWidth = 5.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, 11.5, 9.4, 0, 0, Math.PI * 2);
  ctx.strokeStyle = rad(pal.hi, 0.55);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // 内圈阴影
  ctx.beginPath();
  ctx.ellipse(0, 0, 8.6, 6.6, 0, 0, Math.PI * 2);
  ctx.strokeStyle = rad(pal.lo, 0.55);
  ctx.lineWidth = 1;
  ctx.stroke();
  // 宝石
  gem(ctx, 0, -9.6, 3, pal, true);
  ctx.restore();
}

function ring(ctx, pal) {
  // 指环
  ctx.beginPath();
  ctx.arc(0, 2, 9.4, 0, Math.PI * 2);
  ctx.strokeStyle = metalGrad(ctx, -9, -6, 9, 10, pal);
  ctx.lineWidth = 4.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 2, 9.4, Math.PI * 0.9, Math.PI * 1.75);
  ctx.strokeStyle = rad(pal.hi, 0.65);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // 戒托
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(-4.6, -4.4);
  ctx.lineTo(4.6, -4.4);
  ctx.lineTo(3, -7.4);
  ctx.lineTo(-3, -7.4);
  ctx.closePath();
  ctx.fill();
  gem(ctx, 0, -11, 4.6, pal, true);
}

function belt(ctx, pal) {
  // 皮带
  const g = ctx.createLinearGradient(0, -4, 0, 5);
  g.addColorStop(0, '#6b4526');
  g.addColorStop(0.5, '#4a2f1e');
  g.addColorStop(1, '#2c1a0f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-14, -3.6, 28, 7.2, 2) : ctx.rect(-14, -3.6, 28, 7.2);
  ctx.fill();
  // 缝线
  ctx.strokeStyle = rad(GOLD_HI, 0.34);
  ctx.lineWidth = 0.5;
  ctx.setLineDash([1.4, 2]);
  ctx.beginPath();
  ctx.moveTo(-13, -2.2);
  ctx.lineTo(13, -2.2);
  ctx.moveTo(-13, 2.2);
  ctx.lineTo(13, 2.2);
  ctx.stroke();
  ctx.setLineDash([]);
  // 带扣
  ctx.fillStyle = metalGrad(ctx, -5, -7, 5, 7, pal);
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-5.6, -6.4, 11.2, 12.8, 2) : ctx.rect(-5.6, -6.4, 11.2, 12.8);
  ctx.fill();
  ctx.strokeStyle = rad(pal.hi, 0.7);
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = '#120c09';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(-3.4, -4, 6.8, 8, 1.2) : ctx.rect(-3.4, -4, 6.8, 8);
  ctx.fill();
  gem(ctx, 0, 0, 2.6, pal, true);
}

function boots(ctx, pal) {
  // 左靴
  const drawBoot = (dx, mirror) => {
    ctx.save();
    ctx.translate(dx, 0);
    ctx.scale(mirror, 1);
    ctx.beginPath();
    ctx.moveTo(-4.2, -13);
    ctx.lineTo(2.4, -13);
    ctx.lineTo(2.8, 4);
    ctx.quadraticCurveTo(9.4, 5.4, 9.2, 10.6);
    ctx.lineTo(9.2, 12);
    ctx.lineTo(-4.6, 12);
    ctx.closePath();
    ctx.fillStyle = metalGrad(ctx, -4, -13, 8, 12, pal);
    ctx.fill();
    ctx.strokeStyle = rad(pal.hi, 0.42);
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // 靴筒饰边
    ctx.fillStyle = rad(GOLD, 0.85);
    ctx.fillRect(-4.4, -11.6, 7, 1.6);
    ctx.fillRect(-4.8, 9.6, 14.2, 1.8);
    // 靴头高光
    ctx.beginPath();
    ctx.ellipse(4.2, 6.4, 3.4, 1.6, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = rad('#ffffff', 0.22);
    ctx.fill();
    ctx.restore();
  };
  drawBoot(-6, 1);
  drawBoot(6, -1);
  gem(ctx, 0, 0, 2.4, pal, true);
}

function medal(ctx, pal) {
  // 绶带
  ctx.fillStyle = '#8c2f26';
  ctx.beginPath();
  ctx.moveTo(-9, -20);
  ctx.lineTo(-2, -20);
  ctx.lineTo(0, -3);
  ctx.lineTo(-7, -1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6f221b';
  ctx.beginPath();
  ctx.moveTo(9, -20);
  ctx.lineTo(2, -20);
  ctx.lineTo(0, -3);
  ctx.lineTo(7, -1);
  ctx.closePath();
  ctx.fill();
  // 盾牌
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(13, -4.4);
  ctx.lineTo(11.2, 8);
  ctx.quadraticCurveTo(0, 17, -11.2, 8);
  ctx.lineTo(-13, -4.4);
  ctx.closePath();
  ctx.fillStyle = metalGrad(ctx, -10, -8, 10, 13, pal);
  ctx.fill();
  ctx.strokeStyle = rad(GOLD_HI, 0.8);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // 内圈
  ctx.beginPath();
  ctx.moveTo(0, -5.4);
  ctx.lineTo(9, -2);
  ctx.lineTo(7.6, 6.6);
  ctx.quadraticCurveTo(0, 12.6, -7.6, 6.6);
  ctx.lineTo(-9, -2);
  ctx.closePath();
  ctx.strokeStyle = rad(pal.lo, 0.7);
  ctx.lineWidth = 0.9;
  ctx.stroke();
  // 星徽
  star(ctx, 0, 3, 5.4, GOLD_HI);
  gem(ctx, 0, 3, 2, pal, false);
}

/* ------------------------------ 组装 ------------------------------ */

function paint(ctx, item, size, dim) {
  const rarity = item ? item.rarity | 0 : 0;
  const pal = PAL[rarity] || PAL[0];
  const slot = item ? item.slot : 'unknown';
  const kind = item ? item.kind : null;
  const baseId = item ? item.baseId : null;

  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);
  const k = size / DESIGN;
  ctx.scale(k, k);

  // 稀有度底光
  if (!dim) {
    const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, 23);
    halo.addColorStop(0, rad(pal.gem, 0.16 + rarity * 0.045));
    halo.addColorStop(0.62, rad(pal.gem, 0.05 + rarity * 0.02));
    halo.addColorStop(1, rad(pal.gem, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 23, 0, Math.PI * 2);
    ctx.fill();
  }

  if (dim) {
    // 未装备：暗色线稿
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#6b5744';
    ctx.lineWidth = 1.2;
  }

  const usePal = dim
    ? { metal: '#594736', hi: '#8a7157', lo: '#2e231a', gem: '#5c4a3a', line: '#241a13' }
    : pal;

  ctx.lineJoin = 'round';
  switch (slot) {
    case 'weapon':
      if (kind === 'magic') staff(ctx, usePal);
      else if (kind === 'tao') {
        if (baseId === 'w_fan') fan(ctx, usePal);
        else taoBlade(ctx, usePal);
      } else if (baseId === 'w_axe') axe(ctx, usePal);
      else sword(ctx, usePal);
      break;
    case 'armor':
      if (kind === 'robe') robe(ctx, usePal);
      else heavyArmor(ctx, usePal);
      break;
    case 'helmet': helmet(ctx, usePal, dim ? 0 : rarity); break;
    case 'necklace': necklace(ctx, usePal); break;
    case 'bracelet1':
    case 'bracelet2': bracelet(ctx, usePal); break;
    case 'ring1':
    case 'ring2': ring(ctx, usePal); break;
    case 'belt': belt(ctx, usePal); break;
    case 'boots': boots(ctx, usePal); break;
    case 'medal': medal(ctx, usePal); break;
    default:
      // 未知部位：画个宝箱
      ctx.fillStyle = usePal.metal;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-11, -6, 22, 15, 3) : ctx.rect(-11, -6, 22, 15);
      ctx.fill();
      ctx.fillStyle = usePal.gem;
      ctx.fillRect(-11, -6, 22, 4);
      ctx.fillStyle = GOLD;
      ctx.fillRect(-2, -2, 4, 6);
      break;
  }

  // 高稀有度星芒
  if (!dim && rarity >= 4) {
    const t = rarity === 5 ? 1 : 0.75;
    ctx.globalCompositeOperation = 'lighter';
    star(ctx, -14, -14, 4.2 * t, rad(pal.gem, 0.85));
    star(ctx, 15, 12, 3.2 * t, rad('#ffffff', 0.7));
    star(ctx, 12, -16, 2.4 * t, rad(pal.gem, 0.6));
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore();
}

function makeCanvas(item, dim) {
  const c = document.createElement('canvas');
  c.width = RENDER_SIZE;
  c.height = RENDER_SIZE;
  const ctx = c.getContext('2d');
  paint(ctx, item, RENDER_SIZE, dim);
  return c;
}

export const ICONS = {
  size: RENDER_SIZE,

  keyOf(item, dim) {
    if (!item) return 'ghost:unknown';
    return `${item.slot}|${item.kind || '-'}|${item.baseId || '-'}|${item.rarity | 0}${dim ? '|dim' : ''}`;
  },

  canvas(item, dim = false) {
    const key = this.keyOf(item, dim);
    let c = cache.get(key);
    if (!c) {
      c = makeCanvas(item, dim);
      cache.set(key, c);
    }
    return c;
  },

  url(item, dim = false) {
    if (!dim) {
      const override = ASSETS.itemUrl(item);
      if (override) return override;
    }
    const key = 'url:' + this.keyOf(item, dim);
    let u = cache.get(key);
    if (!u) {
      u = this.canvas(item, dim).toDataURL('image/png');
      cache.set(key, u);
    }
    return u;
  },

  img(item, cls = '') {
    const color = item ? (DATA.RARITIES[item.rarity] || DATA.RARITIES[0]).color : '#6b5744';
    return `<img class="item-ico ${cls}" src="${this.url(item)}" alt="" draggable="false" style="--ico-glow:${rad(color, item && item.rarity >= 4 ? 0.55 : 0.16)}">`;
  },

  // 空装备位：同部位暗色线稿
  ghost(slotId) {
    const item = { slot: slotId, rarity: 0, kind: null, baseId: null };
    return `<img class="item-ico ghost" src="${this.url(item, true)}" alt="" draggable="false">`;
  },

  drawWorld(ctx, item, x, y, size, alpha = 1) {
    const override = ASSETS.itemUrl(item);
    if (override) {
      const img = ASSETS.image(override);
      if (img) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
        ctx.restore();
        return;
      }
    }
    const c = this.canvas(item);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(c, x - size / 2, y - size / 2, size, size);
    ctx.restore();
  },
};
