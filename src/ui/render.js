import { U } from '../core/util.js';
import { DATA } from '../data/gamedata.js';
import { ITEMS } from '../game/items.js';
import { ICONS } from './icons.js';
import { ASSETS } from './assets.js';

const TAU = Math.PI * 2;

// 元素配色：core 高光 / mid 主体 / edge 外焰 / spark 火星
const FX = {
  fire: { core: '#fff6dd', mid: '#ffb056', edge: '#ff4a1e', spark: '#ffd27a' },
  ice: { core: '#ffffff', mid: '#bfeaff', edge: '#3f8fe0', spark: '#d8f6ff' },
  bolt: { core: '#ffffff', mid: '#bfe9ff', edge: '#4a8ff0', spark: '#e0f6ff' },
  holy: { core: '#fffdf0', mid: '#ffe08a', edge: '#ffab2e', spark: '#fff0b0' },
  poison: { core: '#f0ffdd', mid: '#a6f08a', edge: '#3f8f32', spark: '#c8ff9a' },
  phys: { core: '#ffffff', mid: '#ffe0b0', edge: '#ff9a4a', spark: '#ffe8c0' },
  dark: { core: '#f0e0ff', mid: '#a864ff', edge: '#5a1e9a', spark: '#c88aff' },
};

// 接受 #hex / rgb() / rgba()，统一改透明度
function withAlpha(color, a) {
  if (typeof color !== 'string') return color;
  if (color[0] === '#') return U.rgba(color, a);
  const m = color.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(',').map((s) => s.trim());
    return `rgba(${p[0]},${p[1]},${p[2]},${a})`;
  }
  return color;
}

function fxPal(name, fallback = 'phys') {
  return FX[name] || FX[fallback];
}

const CLS_LOOK = {
  warrior: {
    armor: '#8c3a2e', armor2: '#c25a3c', trim: '#e8b269', cape: '#5f1e18',
    pants: '#3a221c', skin: '#e8b98c', helm: '#b0542f', glow: '#ff9a5c',
  },
  mage: {
    armor: '#2f4f8f', armor2: '#4d79c9', trim: '#8fd8ff', cape: '#1a2b52',
    pants: '#22243a', skin: '#e6c0a0', helm: '#3a5fa0', glow: '#7fc8ff',
  },
  taoist: {
    armor: '#2f6b4f', armor2: '#48906a', trim: '#d8d29a', cape: '#1d3f30',
    pants: '#24332a', skin: '#e6c0a0', helm: '#3f7c58', glow: '#a9e8b8',
  },
};

// 根据当前装备推导角色外观：甲胄配稀有度颜色、武器决定持武姿态
function playerLook(p) {
  const base = CLS_LOOK[p.clsId] || CLS_LOOK.warrior;
  const look = {
    ...base,
    weaponKind: p.clsId === 'warrior' ? 'melee' : p.clsId === 'mage' ? 'magic' : 'tao',
    weaponBase: null,
  };
  const eq = p.equip || {};
  const armor = eq.armor;
  if (armor) {
    const rd = DATA.RARITIES[armor.rarity] || DATA.RARITIES[0];
    const t = 0.08 + armor.rarity * 0.04;
    look.armor = U.mix(base.armor, rd.color, t);
    look.armor2 = U.mix(base.armor2, rd.color, t + 0.07);
    look.cape = U.mix(base.cape, rd.color, t * 0.7);
    look.trim = armor.rarity >= 3 ? U.mix(rd.color, '#ffe6b4', 0.45) : base.trim;
    look.heavy = armor.kind !== 'robe';
  }
  const helmet = eq.helmet;
  if (helmet) {
    const rd = DATA.RARITIES[helmet.rarity] || DATA.RARITIES[0];
    look.helm = U.mix(base.helm, rd.color, 0.14 + helmet.rarity * 0.05);
  }
  const weapon = eq.weapon;
  if (weapon) {
    look.weaponKind = weapon.kind || look.weaponKind;
    look.weaponBase = weapon.baseId;
    if (weapon.rarity >= 3) look.glow = (DATA.RARITIES[weapon.rarity] || DATA.RARITIES[0]).color;
  }
  return look;
}

const MON_COLORS = {
  orc: { body: '#7d9b55', dark: '#4f6635', skin: '#93b06a', eye: '#ffcf6a' },
  beast: { body: '#b98a5e', dark: '#7d5838', skin: '#d8aa7a', eye: '#2a1a10' },
  bird: { body: '#c9a35b', dark: '#8f6f38', skin: '#e2c386', eye: '#2a1a10' },
  spider: { body: '#6f8c4b', dark: '#40532a', skin: '#93b06a', eye: '#ff5a4a' },
  skeleton: { body: '#a9acb0', dark: '#6f7478', skin: '#d6d9db', eye: '#7fe8ff' },
  statue: { body: '#9a8a6c', dark: '#675c47', skin: '#b8a98a', eye: '#ffb75a' },
  demon: { body: '#8d4a3a', dark: '#56261e', skin: '#b06a52', eye: '#ffcf5a' },
  humanoid: { body: '#8f4a4a', dark: '#4a2020', skin: '#b06a6a', eye: '#ff6a6a' },
  priest: { body: '#7c6a93', dark: '#4c3f5f', skin: '#a99bbd', eye: '#c9a6ff' },
  dragon: { body: '#8d5a6a', dark: '#4f2430', skin: '#a86464', eye: '#ffd06a' },
};

export const RENDER = {
  canvas: null,
  ctx: null,
  dpr: 1,
  w: 0,
  h: 0,
  scale: 1,
  shakeX: 0,
  shakeY: 0,
  mini: null,
  miniCtx: null,
  _lastMini: 0,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.mini = document.getElementById('minimap');
    this.miniCtx = this.mini ? this.mini.getContext('2d') : null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120));
  },

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * dpr);
    this.canvas.height = Math.floor(this.h * dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    const tilesAcross = this.w < 620 ? 11.2 : this.w < 1100 ? 13.5 : 16;
    this.scale = U.clamp(this.w / (tilesAcross * DATA.TILE), 0.62, 1.45);
  },

  worldToScreen(game, x, y) {
    const cam = game.camera;
    return {
      x: this.w / 2 + (x - cam.x) * this.scale + this.shakeX,
      y: this.h / 2 + (y - cam.y) * this.scale + this.shakeY,
    };
  },

  screenToWorld(game, sx, sy) {
    const cam = game.camera;
    return {
      x: cam.x + (sx - this.w / 2) / this.scale,
      y: cam.y + (sy - this.h / 2) / this.scale,
    };
  },

  draw(game, dt) {
    const ctx = this.ctx;
    const p = game.player;
    if (!p || !game.map) return;

    const shake = game.shake || 0;
    this.shakeX = (Math.random() * 2 - 1) * shake;
    this.shakeY = (Math.random() * 2 - 1) * shake;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#080706';
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.save();
    ctx.translate(this.w / 2 + this.shakeX, this.h / 2 + this.shakeY);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-game.camera.x, -game.camera.y);

    const viewW = this.w / this.scale;
    const viewH = this.h / this.scale;
    const left = game.camera.x - viewW / 2 - 40;
    const top = game.camera.y - viewH / 2 - 40;
    const right = game.camera.x + viewW / 2 + 40;
    const bottom = game.camera.y + viewH / 2 + 40;
    const visible = (x, y, pad = 120) => x > left - pad && x < right + pad && y > top - pad && y < bottom + pad;

    // 地形
    if (game.terrain) {
      const mapW = game.map.w * DATA.TILE;
      const mapH = game.map.h * DATA.TILE;
      const sx = U.clamp(left, 0, mapW);
      const sy = U.clamp(top, 0, mapH);
      const sw = U.clamp(right, 0, mapW) - sx;
      const sh = U.clamp(bottom, 0, mapH) - sy;
      if (sw > 0 && sh > 0) {
        ctx.drawImage(game.terrain, sx, sy, sw, sh, sx, sy, sw, sh);
      }
    }

    // 地面层效果（掉落光柱、范围预警）
    for (const l of game.loot) {
      if (visible(l.x, l.y, 60)) this.drawLootBeam(ctx, l, game.time);
    }
    for (const e of game.effects) {
      if (e.type === 'telegraph') this.drawTelegraph(ctx, e, game.time);
      else if (e.type === 'aoe' || e.type === 'ring') this.drawGroundAoe(ctx, e);
    }

    const drawables = [];
    for (const prop of game.map.props) {
      if (visible(prop.x, prop.y, 180)) drawables.push({ y: prop.y, kind: 'prop', obj: prop });
    }
    for (const mon of game.monsters) {
      if (!mon.dead && visible(mon.x, mon.y, 150)) drawables.push({ y: mon.y, kind: 'mon', obj: mon });
    }
    for (const l of game.loot) {
      if (visible(l.x, l.y, 60)) drawables.push({ y: l.y, kind: 'loot', obj: l });
    }
    for (const rp of game.remotes || []) {
      const rx = rp.rx == null ? rp.x : rp.rx;
      const ry = rp.ry == null ? rp.y : rp.ry;
      if (visible(rx, ry, 200)) drawables.push({ y: ry, kind: 'remote', obj: rp });
    }
    drawables.push({ y: p.y, kind: 'player', obj: p });
    drawables.sort((a, b) => a.y - b.y);

    // 影子
    for (const d of drawables) {
      if (d.kind === 'player') this.shadow(ctx, d.obj.x, d.obj.y, 20, 7);
      else if (d.kind === 'remote') this.shadow(ctx, d.obj.rx == null ? d.obj.x : d.obj.rx, d.obj.ry == null ? d.obj.y : d.obj.ry, 18, 6);
      else if (d.kind === 'mon') {
        const s = d.obj.def.size * 22;
        this.shadow(ctx, d.obj.x, d.obj.y, s, s * 0.38);
      } else if (d.kind === 'prop') {
        if (['tree', 'pine', 'pillar', 'statue', 'brazier'].includes(d.obj.type)) this.shadow(ctx, d.obj.x, d.obj.y, 20 * d.obj.scale, 7 * d.obj.scale);
      } else if (d.kind === 'loot') {
        this.shadow(ctx, d.obj.x, d.obj.y, 11, 4);
      }
    }

    for (const d of drawables) {
      if (d.kind === 'prop') this.drawProp(ctx, d.obj, game.time);
      else if (d.kind === 'mon') {
        this.drawMonster(ctx, d.obj, game.time);
        if (d.obj.remote) this.drawRemoteMark(ctx, d.obj, game.time);
        this.drawMonsterPlate(ctx, d.obj, game);
      } else if (d.kind === 'loot') this.drawLoot(ctx, d.obj, game.time);
      else if (d.kind === 'remote') this.drawRemotePlayer(ctx, d.obj, game.time);
      else if (d.kind === 'player') this.drawPlayer(ctx, d.obj, game.time);
    }

    // 弹道
    for (const pr of game.projectiles) {
      if (visible(pr.x, pr.y, 60)) this.drawProjectile(ctx, pr, game.time);
    }

    // 粒子 / 特效
    for (const pa of game.particles) {
      if (visible(pa.x, pa.y, 60)) this.drawParticle(ctx, pa);
    }
    for (const e of game.effects) {
      if (e.type === 'telegraph' || e.type === 'aoe' || e.type === 'ring') continue;
      this.drawEffect(ctx, e, game.time);
    }

    // 光源
    this.drawLights(ctx, game);
    this.drawPlayerAura(ctx, p, game.time);

    ctx.restore();

    // 屏幕空间：环境粒子、伤害数字、受伤红晕
    this.drawAmbient(game, dt);
    this.drawTexts(game);
    this.drawLowHp(game);
    if (game.hitVignette > 0) {
      const a = U.clamp(game.hitVignette, 0, 0.4);
      const g = ctx.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.24, this.w / 2, this.h / 2, this.h * 0.72);
      g.addColorStop(0, 'rgba(150,20,10,0)');
      g.addColorStop(1, `rgba(150,20,10,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    this.drawMini(game);
  },

  shadow(ctx, x, y, rx, ry) {
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fill();
  },

  /* --------------------------- 玩家 --------------------------- */
  drawPlayer(ctx, p, time) {
    // 外部贴图优先：assets/manifest.json 提供角色帧时使用精灵图
    const spriteCfg = ASSETS.charCfg(p.clsId);
    if (spriteCfg) {
      const spriteImg = ASSETS.image(spriteCfg.src);
      if (spriteImg) {
        this.drawSpritePlayer(ctx, p, spriteCfg, spriteImg, time);
        return;
      }
    }

    const look = playerLook(p);
    const moving = p.moving;
    const walk = moving ? Math.sin(p.animTime * 13) : Math.sin(time * 2) * 0.25;
    const facing = p.facing >= 0 ? 1 : -1;
    const swing = p.attackT > 0 ? U.clamp(1 - p.attackT / 0.2, 0, 1) : -1;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(facing * 1.08, 1.08);

    // 脚下光环
    ctx.strokeStyle = 'rgba(255,214,140,0.22)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 5, 0, 0, TAU);
    ctx.stroke();

    // 披风
    ctx.fillStyle = look.cape;
    ctx.beginPath();
    ctx.moveTo(-9, -38);
    ctx.quadraticCurveTo(-16 - walk * 2, -20, -12 + Math.sin(time * 4) * 2, -4);
    ctx.lineTo(-2, -10);
    ctx.lineTo(2, -38);
    ctx.closePath();
    ctx.fill();

    // 腿
    ctx.fillStyle = look.pants;
    U.roundRect(ctx, -8 + walk * 1.4, -16, 7, 16, 2.5);
    ctx.fill();
    U.roundRect(ctx, 1 - walk * 1.4, -16, 7, 16, 2.5);
    ctx.fill();
    ctx.fillStyle = '#1c1512';
    U.roundRect(ctx, -9 + walk * 1.4, -4, 8.5, 4, 2);
    ctx.fill();
    U.roundRect(ctx, 0.5 - walk * 1.4, -4, 8.5, 4, 2);
    ctx.fill();

    // 身体
    const grad = ctx.createLinearGradient(-10, -40, 10, -14);
    grad.addColorStop(0, look.armor2);
    grad.addColorStop(0.55, look.armor);
    grad.addColorStop(1, U.shade(look.armor, -26));
    ctx.fillStyle = grad;
    U.roundRect(ctx, -10, -40, 20, 27, 5);
    ctx.fill();
    // 胸甲纹饰
    ctx.strokeStyle = look.trim;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -37);
    ctx.lineTo(-4, -28);
    ctx.lineTo(0, -21);
    ctx.lineTo(4, -28);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;
    // 腰带
    ctx.fillStyle = look.trim;
    ctx.fillRect(-10, -19, 20, 3);
    ctx.fillStyle = U.shade(look.trim, -30);
    ctx.fillRect(-2.5, -19.5, 5, 4);

    // 手臂
    ctx.fillStyle = look.armor;
    U.roundRect(ctx, -13, -37, 5.5, 17, 2.5);
    ctx.fill();
    U.roundRect(ctx, 7.5, -37, 5.5, 17, 2.5);
    ctx.fill();

    // 肩甲
    ctx.fillStyle = look.armor2;
    ctx.beginPath();
    ctx.ellipse(-10, -37, 5.5, 4.5, -0.25, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(10, -37, 5.5, 4.5, 0.25, 0, TAU);
    ctx.fill();

    // 头
    ctx.fillStyle = look.skin;
    ctx.beginPath();
    ctx.arc(0, -47, 7.2, 0, TAU);
    ctx.fill();
    // 眼睛
    ctx.fillStyle = '#241813';
    ctx.beginPath();
    ctx.arc(2.6, -48, 1.05, 0, TAU);
    ctx.fill();
    // 头盔
    ctx.fillStyle = look.helm;
    ctx.beginPath();
    ctx.arc(0, -47.5, 7.6, Math.PI * 1.02, Math.PI * 1.98);
    ctx.lineTo(7.4, -45.5);
    ctx.lineTo(-7.4, -45.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = look.trim;
    ctx.fillRect(-7.6, -46.4, 15.2, 1.6);
    if (p.clsId === 'warrior') {
      ctx.fillStyle = look.trim;
      ctx.beginPath();
      ctx.moveTo(0, -56);
      ctx.lineTo(2.2, -49);
      ctx.lineTo(-2.2, -49);
      ctx.closePath();
      ctx.fill();
    } else if (p.clsId === 'mage') {
      ctx.fillStyle = look.glow;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(0, -55, 2.1, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = look.trim;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-6, -50);
      ctx.quadraticCurveTo(0, -54, 6, -50);
      ctx.stroke();
    }

    // 武器（由已装备武器的类型与品质决定外观）
    this.drawWeapon(ctx, p, look, swing, time);

    // 攻击拖影
    if (swing >= 0) {
      ctx.globalAlpha = 0.4 * (1 - swing);
      ctx.strokeStyle = look.glow || '#ffe0a0';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(4, -26, 34, -2.2 + swing * 1.2, -1.0 + swing * 1.2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 受击闪白
    if (p.hitFlash > 0) {
      ctx.globalAlpha = U.clamp(p.hitFlash * 4, 0, 0.55);
      ctx.fillStyle = '#ff6a50';
      ctx.beginPath();
      ctx.ellipse(0, -30, 15, 22, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // 名字（由 HUD 显示，画面内保持简洁）
  },

  // 精灵图角色：支持四向行走、攻击帧与左右翻转
  drawSpritePlayer(ctx, p, cfg, img, time) {
    const fw = cfg.frameW || 64;
    const fh = cfg.frameH || 64;
    const cols = cfg.cols || 8;
    const rows = cfg.rows || 6;
    const facing = p.facing >= 0 ? 1 : -1;
    const flip = cfg.flip !== false;

    // 行走 / 攻击方向：优先看移动轴向，静止时沿用上一次朝向
    const mode = p.dirMode || 'down';
    const dir = mode === 'down' ? 'Down' : mode === 'up' ? 'Up' : 'Right';

    let row;
    let frame = 0;
    const animT = Number.isFinite(p.animTime) ? p.animTime : 0;

    if (p.attackT > 0) {
      row = cfg['attack' + dir + 'Row'];
      if (row == null) row = cfg.attackRightRow || 0;
      const frames = cfg.attackFrames || 6;
      const prog = 1 - U.clamp(p.attackT / 0.2, 0, 1);
      frame = Math.min(frames - 1, Math.floor(prog * frames));
    } else if (p.moving) {
      row = cfg['walk' + dir + 'Row'];
      if (row == null) row = cfg.walkDownRow || 0;
      frame = Math.floor(animT * (cfg.fps || 10)) % (cfg.walkFrames || cols);
    } else {
      row = cfg['walk' + dir + 'Row'];
      if (row == null) row = cfg.walkDownRow || 0;
    }

    row = U.clamp(Math.round(row), 0, rows - 1);
    frame = ((Math.round(frame) % cols) + cols) % cols;

    const sx = frame * fw;
    const sy = row * fh;
    const drawH = cfg.drawH || 76;
    const drawW = drawH * (fw / fh);
    const ox = cfg.offsetX || 0;
    const oy = cfg.offsetY || 0;
    const mirror = flip && dir === 'Right' && facing < 0;

    ctx.save();
    ctx.translate(p.x, p.y);
    if (mirror) ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = false;
    // 背对镜头时武器藏在身后
    if (dir === 'Up') this.drawSpriteWeapon(ctx, p, cfg, time);
    ctx.drawImage(img, sx, sy, fw, fh, -drawW / 2 + ox, -drawH + oy, drawW, drawH);
    if (dir !== 'Up') this.drawSpriteWeapon(ctx, p, cfg, time);
    ctx.restore();

    if (p.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = U.clamp(p.hitFlash * 4, 0, 0.5);
      ctx.fillStyle = '#ff6a50';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 30, 15, 22, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  },

  // 联机队友：复用职业精灵图，头顶显示名字与血条
  drawRemotePlayer(ctx, rp, time) {
    const x = rp.rx == null ? rp.x : rp.rx;
    const y = rp.ry == null ? rp.y : rp.ry;
    const cfg = ASSETS.charCfg(rp.clsId);
    const img = cfg && ASSETS.image(cfg.src);

    if (cfg && img) {
      this.drawSpritePlayer(ctx, {
        x,
        y,
        facing: rp.facing >= 0 ? 1 : -1,
        dirMode: rp.dirMode || 'down',
        moving: !!rp.moving,
        attackT: rp.attackT || 0,
        animTime: rp.animTime || 0,
        hitFlash: 0,
        equip: { weapon: rp.weapon ? { slot: 'weapon', baseId: rp.weapon, rarity: 0 } : null },
      }, cfg, img, time);
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = 'rgba(150,205,255,0.8)';
      U.roundRect(ctx, -9, -42, 18, 30, 5);
      ctx.fill();
      ctx.fillStyle = 'rgba(208,236,255,0.92)';
      ctx.beginPath();
      ctx.arc(0, -50, 7, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    const name = rp.name || '队友';
    const hpPct = U.clamp((rp.hp || 0) / Math.max(1, rp.maxHp || 1), 0, 1);
    const barW = 38;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - barW / 2, y - 78, barW, 3);
    ctx.fillStyle = rp.dead ? '#7d4a4a' : '#5ec86f';
    ctx.fillRect(x - barW / 2, y - 78, barW * hpPct, 3);
    ctx.font = '11px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    const label = `${name}  Lv.${rp.level || 1}`;
    U.strokeText(ctx, label, x, y - 84, {
      stroke: 'rgba(0,0,0,0.85)',
      lineWidth: 3,
      fill: rp.dead ? '#9a9a9a' : '#9fe0ff',
    });
    ctx.restore();
  },

  // 在精灵图角色手里画当前武器（按部位/品质变化，带攻击挥砍）
  // 坐标系：原点在脚下，+x 为面朝方向
  drawSpriteWeapon(ctx, p, cfg, time) {
    if (!p.equip || !p.equip.weapon) return;
    const look = playerLook(p);
    const swing = p.attackT > 0 ? U.clamp(1 - p.attackT / 0.2, 0, 1) : -1;
    ctx.save();
    ctx.translate(4, 1);
    // 程序化武器默认向后仰，贴图角色不需要；绕握点抹平后仰量
    if ((look.weaponKind || 'melee') !== 'magic') {
      ctx.translate(10, -30);
      ctx.rotate(0.55);
      ctx.translate(-10, 30);
    }
    this.drawWeapon(ctx, p, look, swing, time);
    ctx.restore();
  },

  // 按装备类型绘制武器：剑 / 斧 / 法杖 / 道剑 / 扇
  drawWeapon(ctx, p, look, swing, time) {
    const kind = look.weaponKind || 'melee';
    const wp = p.equip && p.equip.weapon;
    const rd = wp ? DATA.RARITIES[wp.rarity] || DATA.RARITIES[0] : null;
    const glow = rd && rd.id >= 3 ? rd.color : null;

    if (kind === 'melee') {
      const isAxe = look.weaponBase === 'w_axe';
      const ang = swing >= 0 ? -1.25 + swing * 2.4 : -0.55 + Math.sin(time * 2) * 0.06;
      ctx.save();
      ctx.translate(10, -30);
      ctx.rotate(ang);
      if (isAxe) {
        ctx.fillStyle = '#6b4526';
        U.roundRect(ctx, -1.4, -30, 2.8, 38, 1.2);
        ctx.fill();
        const g = ctx.createLinearGradient(-12, -30, 2, -14);
        g.addColorStop(0, '#f2f7fa');
        g.addColorStop(0.45, '#cfd6db');
        g.addColorStop(1, '#8f979d');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-1, -31);
        ctx.quadraticCurveTo(-14, -38, -18, -26);
        ctx.quadraticCurveTo(-20, -17, -12, -14);
        ctx.quadraticCurveTo(-5, -12, -1, -17);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-14, -34);
        ctx.quadraticCurveTo(-18, -25, -12, -16);
        ctx.stroke();
        ctx.fillStyle = '#c9a45c';
        ctx.fillRect(-3, -19, 6, 3);
      } else {
        const hi = glow ? U.mix('#ffffff', glow, 0.35) : '#f2f7fa';
        const mid = glow ? U.mix('#dfe6ea', glow, 0.45) : '#dfe6ea';
        const lo = glow ? U.mix('#aeb9c0', glow, 0.5) : '#aeb9c0';
        const g2 = ctx.createLinearGradient(0, -6, 0, -46);
        g2.addColorStop(0, mid);
        g2.addColorStop(0.5, hi);
        g2.addColorStop(1, lo);
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.moveTo(-2.4, 0);
        ctx.lineTo(-2.8, -36);
        ctx.lineTo(0, -44);
        ctx.lineTo(2.8, -36);
        ctx.lineTo(2.4, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(-0.5, -38, 1, 30);
        ctx.fillStyle = '#c9a45c';
        ctx.fillRect(-6, -2, 12, 3.4);
        ctx.fillStyle = '#5a3a22';
        U.roundRect(ctx, -1.8, 0, 3.6, 7, 1.5);
        ctx.fill();
      }
      if (glow) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const tipY = isAxe ? -30 : -44;
        const rg = ctx.createRadialGradient(0, tipY, 0, 0, tipY, 16);
        rg.addColorStop(0, withAlpha(glow, 0.5));
        rg.addColorStop(1, withAlpha(glow, 0));
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(0, tipY, 16, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      return;
    }

    if (kind === 'magic') {
      ctx.save();
      ctx.translate(11, -26);
      ctx.rotate(-0.08);
      ctx.fillStyle = '#5a3a26';
      U.roundRect(ctx, -1.6, -34, 3.2, 42, 1.4);
      ctx.fill();
      ctx.fillStyle = '#c9a45c';
      ctx.fillRect(-3.4, -37, 6.8, 3);
      ctx.strokeStyle = '#c9a45c';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, -42, 7, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      const orbColor = rd ? rd.color : '#8fd8ff';
      const glowGrad = ctx.createRadialGradient(0, -44, 0.5, 0, -44, 14);
      glowGrad.addColorStop(0, '#ffffff');
      glowGrad.addColorStop(0.3, withAlpha(orbColor, 0.95));
      glowGrad.addColorStop(1, withAlpha(orbColor, 0));
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, -44, 14, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fffaf0';
      ctx.beginPath();
      ctx.arc(0, -44, 3.2, 0, TAU);
      ctx.fill();
      ctx.restore();
      return;
    }

    // 道士：道剑 / 扇
    const isFan = look.weaponBase === 'w_fan';
    ctx.save();
    ctx.translate(10, -30);
    if (isFan) {
      ctx.rotate(swing >= 0 ? -1.0 + swing * 1.8 : -0.42 + Math.sin(time * 2) * 0.04);
      const g = ctx.createLinearGradient(-10, -34, 4, -6);
      g.addColorStop(0, '#ffe9b8');
      g.addColorStop(1, '#b78b45');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.arc(0, -4, 30, Math.PI * 1.2, Math.PI * 1.8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,58,34,0.8)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 5; i++) {
        const a = Math.PI * 1.2 + (Math.PI * 0.6 * i) / 5;
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(Math.cos(a) * 29, -4 + Math.sin(a) * 29);
        ctx.stroke();
      }
      ctx.fillStyle = '#8f6c3c';
      ctx.fillRect(-2, -4, 4, 8);
    } else {
      ctx.rotate(swing >= 0 ? -1.0 + swing * 1.8 : -0.38);
      const g = ctx.createLinearGradient(-2, -35, 3, 0);
      g.addColorStop(0, '#fff6dc');
      g.addColorStop(0.5, '#e3d9b2');
      g.addColorStop(1, '#b9ab7e');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-1.8, 0);
      ctx.lineTo(-2.2, -28);
      ctx.lineTo(0, -35);
      ctx.lineTo(2.2, -28);
      ctx.lineTo(1.8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#8f6c3c';
      ctx.fillRect(-4.5, -2, 9, 2.6);
      if (glow) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const rg = ctx.createRadialGradient(0, -35, 0, 0, -35, 12);
        rg.addColorStop(0, withAlpha(glow, 0.45));
        rg.addColorStop(1, withAlpha(glow, 0));
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(0, -35, 12, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();

    // 符纸（道士常驻）
    ctx.save();
    ctx.translate(-12, -32);
    ctx.rotate(Math.sin(time * 3) * 0.15 - 0.25);
    ctx.fillStyle = 'rgba(255,235,160,0.85)';
    ctx.fillRect(-2.6, -6, 5.2, 12);
    ctx.strokeStyle = 'rgba(190,60,40,0.8)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(0, 4);
    ctx.moveTo(-1.4, -1);
    ctx.lineTo(1.4, -1);
    ctx.stroke();
    ctx.restore();
  },

  drawPlayerAura(ctx, p, time) {
    const eq = Object.values(p.equip).filter(Boolean);
    const best = eq.reduce((m, i) => Math.max(m, i.rarity), 0);
    const pulse = 0.5 + Math.sin(time * 2.4) * 0.5;

    if (best >= 4) {
      const color = best >= 5 ? '#ff5a5a' : '#ffa23f';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = withAlpha(color, 0.12 + pulse * 0.14);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 2, 26 + pulse * 4, 9 + pulse * 1.5, 0, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(color, 0.05 + pulse * 0.07);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 2, 35 + pulse * 6, 12 + pulse * 2, 0, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const a = time * 1.4 + (i / 4) * TAU;
        ctx.fillStyle = withAlpha(color, 0.45);
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(a) * (20 + pulse * 4), p.y - 22 + Math.sin(a) * 8, 1.5, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    const buffs = p.buffs || [];

    // 魔法盾：护盾泡 + 六边符文
    if (buffs.some((b) => b.shieldPct > 0)) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const r = 30 + Math.sin(time * 3) * 1.8;
      const g = ctx.createRadialGradient(p.x, p.y - 26, r * 0.2, p.x, p.y - 26, r);
      g.addColorStop(0, 'rgba(120,200,255,0)');
      g.addColorStop(0.7, 'rgba(120,200,255,0.09)');
      g.addColorStop(0.93, 'rgba(170,232,255,0.32)');
      g.addColorStop(1, 'rgba(190,240,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 26, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = withAlpha('#9fe4ff', 0.32 + pulse * 0.16);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * TAU + time * 0.55;
        const x = p.x + Math.cos(a) * (r - 3);
        const y = p.y - 26 + Math.sin(a) * (r - 3);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 烈火剑法：身周余焰
    if (buffs.some((b) => b.stats && b.stats.atkMul)) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const ph = (time * 1.8 + i * 0.21) % 1;
        const x = p.x + Math.sin(time * 5 + i * 2.1) * 9;
        const y = p.y - 6 - ph * 44;
        const a = (1 - ph) * 0.5;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 8);
        g.addColorStop(0, `rgba(255,190,110,${a})`);
        g.addColorStop(1, 'rgba(255,90,30,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  },

  /* --------------------------- 怪物 --------------------------- */
  drawMonster(ctx, mon, time) {
    const d = mon.def;
    const col = MON_COLORS[d.kind] || MON_COLORS.orc;
    const base = d.color || col.body;
    const size = d.size || 1;
    const moving = mon.moving;
    const walk = moving ? Math.sin(mon.animTime * 10) : Math.sin(time * 1.6 + mon.seed) * 0.3;
    const facing = mon.facing >= 0 ? 1 : -1;

    ctx.save();
    ctx.translate(mon.x, mon.y);
    ctx.scale(facing * size, size);

    if (d.boss) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.6 + Math.sin(time * 3) * 0.4;
      ctx.strokeStyle = `rgba(255,70,50,${0.18 + pulse * 0.12})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, -4, 34, 13, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    } else if (mon.elite) {
      ctx.strokeStyle = 'rgba(110,180,255,0.35)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, -2, 24, 8, 0, 0, TAU);
      ctx.stroke();
    }

    switch (d.kind) {
      case 'bird': this.monBird(ctx, col, base, walk); break;
      case 'beast': this.monBeast(ctx, col, base, walk, d.name); break;
      case 'orc': this.monOrc(ctx, col, base, walk, d.boss); break;
      case 'spider': this.monSpider(ctx, col, base, walk, time, d.boss); break;
      case 'skeleton': this.monSkeleton(ctx, col, walk, time); break;
      case 'statue': this.monStatue(ctx, col, base, d.boss, time); break;
      case 'demon': this.monDemon(ctx, col, base, walk, time, d.boss); break;
      case 'humanoid': this.monHumanoid(ctx, col, base, walk); break;
      case 'priest': this.monPriest(ctx, col, base, walk, time); break;
      case 'dragon': this.monDragon(ctx, col, base, walk, time, d.boss); break;
      default: this.monOrc(ctx, col, base, walk, d.boss);
    }

    // 状态
    if (mon.freeze > 0) {
      ctx.fillStyle = 'rgba(130,220,255,0.28)';
      ctx.beginPath();
      ctx.ellipse(0, -26, 20, 30, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(190,245,255,0.65)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-8, -44); ctx.lineTo(-14, -34); ctx.moveTo(6, -50); ctx.lineTo(12, -42);
      ctx.stroke();
    }
    if (mon.stun > 0) {
      ctx.fillStyle = '#ffe08a';
      for (let i = 0; i < 3; i++) {
        const a = time * 4 + (i * TAU) / 3;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 12, -56 + Math.sin(a) * 3, 1.8, 0, TAU);
        ctx.fill();
      }
    }
    if (mon.poison && mon.poison.t > 0) {
      ctx.fillStyle = 'rgba(120,230,110,0.75)';
      for (let i = 0; i < 2; i++) {
        const yy = -34 - ((time * 22 + i * 20) % 30);
        ctx.beginPath();
        ctx.arc(8 + Math.sin(time * 2 + i) * 5, yy, 2, 0, TAU);
        ctx.fill();
      }
    }
    if (mon.burn && mon.burn.t > 0) {
      for (let i = 0; i < 3; i++) {
        const a = time * 9 + i * 2.1;
        ctx.fillStyle = i % 2 ? 'rgba(255,170,60,0.75)' : 'rgba(255,90,30,0.6)';
        ctx.beginPath();
        ctx.ellipse(Math.sin(a) * 10, -20 - Math.abs(Math.cos(a)) * 24, 3, 6, 0, 0, TAU);
        ctx.fill();
      }
    }

    if (mon.hitFlash > 0) {
      ctx.globalAlpha = U.clamp(mon.hitFlash * 5, 0, 0.5);
      ctx.fillStyle = '#fff2e0';
      ctx.beginPath();
      ctx.ellipse(0, -26, 20, 28, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  },

  monOrc(ctx, col, base, walk, boss) {
    ctx.fillStyle = col.dark;
    U.roundRect(ctx, -11 + walk * 2, -18, 8, 18, 3);
    ctx.fill();
    U.roundRect(ctx, 3 - walk * 2, -18, 8, 18, 3);
    ctx.fill();
    const g = ctx.createLinearGradient(-16, -44, 12, -14);
    g.addColorStop(0, base);
    g.addColorStop(1, U.shade(base, -38));
    ctx.fillStyle = g;
    U.roundRect(ctx, -16, -42, 32, 27, 8);
    ctx.fill();
    // 腰带
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(-15, -22, 30, 4);
    // 手臂
    ctx.fillStyle = U.shade(base, -14);
    U.roundRect(ctx, -21, -40, 8, 20, 4);
    ctx.fill();
    U.roundRect(ctx, 13, -40, 8, 20, 4);
    ctx.fill();
    // 头
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.arc(0, -51, 11, 0, TAU);
    ctx.fill();
    ctx.fillStyle = col.dark;
    ctx.beginPath();
    ctx.ellipse(-9, -53, 3.6, 5, -0.4, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(9, -53, 3.6, 5, 0.4, 0, TAU);
    ctx.fill();
    // 眼
    ctx.fillStyle = col.eye;
    ctx.beginPath();
    ctx.arc(-4, -52, 1.8, 0, TAU);
    ctx.arc(4, -52, 1.8, 0, TAU);
    ctx.fill();
    // 獠牙
    ctx.fillStyle = '#f0e6c8';
    ctx.beginPath();
    ctx.moveTo(-5, -45);
    ctx.lineTo(-3.4, -39);
    ctx.lineTo(-1.8, -45);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(5, -45);
    ctx.lineTo(3.4, -39);
    ctx.lineTo(1.8, -45);
    ctx.closePath();
    ctx.fill();
    // 武器
    ctx.save();
    ctx.translate(17, -30);
    ctx.rotate(-0.4 + walk * 0.06);
    ctx.fillStyle = '#4a3524';
    U.roundRect(ctx, -2, -6, 4, 40, 2);
    ctx.fill();
    ctx.fillStyle = boss ? '#c9a45c' : '#7d6a52';
    ctx.beginPath();
    ctx.arc(0, -30, boss ? 9 : 7, 0, TAU);
    ctx.fill();
    ctx.restore();
  },

  monBeast(ctx, col, base, walk, name) {
    const isDeer = name && name.includes('鹿');
    const isCat = name && (name.includes('猫') || name.includes('虎'));
    ctx.fillStyle = col.dark;
    for (let i = -1; i <= 1; i += 2) {
      ctx.save();
      ctx.translate(i * 7, 0);
      ctx.rotate(i * walk * 0.14);
      ctx.fillRect(-2.5, -14, 5, 14);
      ctx.restore();
    }
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.ellipse(0, -20, 20, 11, 0, 0, TAU);
    ctx.fill();
    // 头
    ctx.beginPath();
    ctx.ellipse(15, -27, 9, 8, -0.15, 0, TAU);
    ctx.fill();
    // 耳朵
    ctx.fillStyle = col.dark;
    ctx.beginPath();
    ctx.moveTo(11, -34);
    ctx.lineTo(13, -41);
    ctx.lineTo(17, -34);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(18, -34);
    ctx.lineTo(21, -40);
    ctx.lineTo(23, -33);
    ctx.closePath();
    ctx.fill();
    // 眼
    ctx.fillStyle = col.eye;
    ctx.beginPath();
    ctx.arc(19, -29, 1.4, 0, TAU);
    ctx.fill();
    // 尾巴
    ctx.strokeStyle = base;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-19, -22);
    ctx.quadraticCurveTo(-28, -26 + walk * 3, -25, -34);
    ctx.stroke();
    if (isDeer) {
      ctx.strokeStyle = '#d8c39a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(17, -36);
      ctx.lineTo(21, -48);
      ctx.lineTo(25, -52);
      ctx.moveTo(21, -44);
      ctx.lineTo(16, -47);
      ctx.moveTo(11, -35);
      ctx.lineTo(8, -45);
      ctx.stroke();
    }
    if (isCat) {
      ctx.strokeStyle = 'rgba(255,240,220,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(10, -21);
      ctx.lineTo(-12, -24);
      ctx.stroke();
    }
  },

  monBird(ctx, col, base, walk) {
    ctx.strokeStyle = '#d8a05c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-2, -5); ctx.lineTo(-3, 0);
    ctx.moveTo(3, -5); ctx.lineTo(4, 0);
    ctx.stroke();
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.ellipse(0, -14, 9, 10, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, -23, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e06a3a';
    ctx.beginPath();
    ctx.moveTo(10, -23);
    ctx.lineTo(15, -21);
    ctx.lineTo(10, -20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c93a2a';
    ctx.beginPath();
    ctx.arc(4, -30, 2.8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#241813';
    ctx.beginPath();
    ctx.arc(7, -24, 1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = col.dark;
    ctx.beginPath();
    ctx.ellipse(-6, -13, 5, 4, 0.4 + walk * 0.1, 0, TAU);
    ctx.fill();
  },

  monSpider(ctx, col, base, walk, time, boss) {
    ctx.strokeStyle = col.dark;
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 4; i++) {
      const a = 0.5 + i * 0.36;
      const sw = Math.sin(time * 6 + i) * 0.16;
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.quadraticCurveTo(12, -22 - i * 2, 20 + Math.cos(a) * 8, -6 + sw * 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.quadraticCurveTo(-12, -22 - i * 2, -20 - Math.cos(a) * 8, -6 - sw * 10);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(0, -22, 3, 0, -18, 20);
    g.addColorStop(0, U.shade(base, 24));
    g.addColorStop(1, col.dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -18, 17, 14, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = col.body;
    ctx.beginPath();
    ctx.arc(0, -29, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ff5a4a';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(-4 + (i % 2) * 8, -31 + Math.floor(i / 2) * 4, 1.5, 0, TAU);
      ctx.fill();
    }
    if (boss) {
      ctx.strokeStyle = 'rgba(255,90,70,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, -18, 24, 18, 0, 0, TAU);
      ctx.stroke();
    }
  },

  monSkeleton(ctx, col, walk, time) {
    ctx.strokeStyle = '#c8ccd0';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-4 + walk * 2, -22); ctx.lineTo(-6 + walk * 3, 0);
    ctx.moveTo(4 - walk * 2, -22); ctx.lineTo(6 - walk * 3, 0);
    ctx.stroke();
    // 盆骨
    ctx.fillStyle = '#b8bcc0';
    ctx.beginPath();
    ctx.ellipse(0, -23, 8, 5, 0, 0, TAU);
    ctx.fill();
    // 肋骨
    ctx.strokeStyle = '#d6d9db';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(0, -42 + i * 4.6, 9 - i * 0.8, 2.4, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.strokeStyle = '#c8ccd0';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, -46);
    ctx.lineTo(0, -30);
    ctx.stroke();
    // 手臂 + 武器
    ctx.beginPath();
    ctx.moveTo(-8, -44); ctx.lineTo(-14, -32);
    ctx.moveTo(8, -44); ctx.lineTo(14, -30);
    ctx.stroke();
    ctx.save();
    ctx.translate(15, -30);
    ctx.rotate(-0.5);
    ctx.fillStyle = '#8f9aa3';
    ctx.beginPath();
    ctx.moveTo(-1.6, 0); ctx.lineTo(-2, -24); ctx.lineTo(0, -29); ctx.lineTo(2, -24); ctx.lineTo(1.6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // 头骨
    ctx.fillStyle = '#e2e5e7';
    ctx.beginPath();
    ctx.arc(0, -55, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2a2f33';
    ctx.beginPath();
    ctx.arc(-3, -56, 2.2, 0, TAU);
    ctx.arc(3, -56, 2.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = col.eye;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(-3, -56, 1, 0, TAU);
    ctx.arc(3, -56, 1, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },

  monStatue(ctx, col, base, boss, time) {
    const g = ctx.createLinearGradient(-18, -60, 18, 0);
    g.addColorStop(0, U.shade(base, 22));
    g.addColorStop(1, col.dark);
    ctx.fillStyle = g;
    U.roundRect(ctx, -16, -50, 32, 48, 5);
    ctx.fill();
    ctx.fillStyle = U.shade(base, -12);
    U.roundRect(ctx, -22, -46, 7, 26, 3);
    ctx.fill();
    U.roundRect(ctx, 15, -46, 7, 26, 3);
    ctx.fill();
    // 头
    ctx.fillStyle = base;
    U.roundRect(ctx, -10, -66, 20, 18, 4);
    ctx.fill();
    ctx.fillStyle = col.dark;
    ctx.fillRect(-10, -58, 20, 2);
    // 眼
    const pulse = 0.6 + Math.sin(time * 2 + 1) * 0.4;
    ctx.fillStyle = `rgba(255,183,90,${0.55 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(-4, -60, 1.8, 0, TAU);
    ctx.arc(4, -60, 1.8, 0, TAU);
    ctx.fill();
    // 裂纹
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-10, -40); ctx.lineTo(-3, -34); ctx.lineTo(-7, -26);
    ctx.moveTo(8, -44); ctx.lineTo(12, -36);
    ctx.stroke();
    if (boss) {
      ctx.strokeStyle = 'rgba(255,120,60,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -34, 26 + pulse * 2, 0, TAU);
      ctx.stroke();
    }
  },

  monDemon(ctx, col, base, walk, time, boss) {
    // 翅膀
    const flap = Math.sin(time * 3) * 0.18;
    ctx.fillStyle = 'rgba(60,20,24,0.9)';
    for (let side = -1; side <= 1; side += 2) {
      ctx.save();
      ctx.scale(side, 1);
      ctx.beginPath();
      ctx.moveTo(10, -42);
      ctx.quadraticCurveTo(32, -56 + flap * 20, 42, -30);
      ctx.quadraticCurveTo(28, -32, 22, -20);
      ctx.quadraticCurveTo(18, -34, 10, -42);
      ctx.fill();
      ctx.restore();
    }
    // 腿
    ctx.fillStyle = col.dark;
    U.roundRect(ctx, -10 + walk * 2, -18, 8, 18, 3);
    ctx.fill();
    U.roundRect(ctx, 2 - walk * 2, -18, 8, 18, 3);
    ctx.fill();
    // 身体
    const g = ctx.createLinearGradient(-14, -48, 14, -16);
    g.addColorStop(0, base);
    g.addColorStop(1, col.dark);
    ctx.fillStyle = g;
    U.roundRect(ctx, -13, -46, 26, 30, 6);
    ctx.fill();
    // 手臂
    ctx.strokeStyle = base;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-12, -40);
    ctx.lineTo(-20, -24 + walk * 2);
    ctx.moveTo(12, -40);
    ctx.lineTo(20, -24 - walk * 2);
    ctx.stroke();
    ctx.lineCap = 'butt';
    // 头
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.arc(0, -54, 10, 0, TAU);
    ctx.fill();
    // 角
    ctx.strokeStyle = '#e0c9a0';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-7, -61); ctx.quadraticCurveTo(-14, -70, -10, -74);
    ctx.moveTo(7, -61); ctx.quadraticCurveTo(14, -70, 10, -74);
    ctx.stroke();
    // 眼
    ctx.fillStyle = col.eye;
    ctx.beginPath();
    ctx.arc(-3.5, -55, 1.9, 0, TAU);
    ctx.arc(3.5, -55, 1.9, 0, TAU);
    ctx.fill();
    // 尾
    ctx.strokeStyle = col.dark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.quadraticCurveTo(10, -4, 18, -10);
    ctx.stroke();
    if (boss) {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = 'rgba(255,80,50,0.16)';
      ctx.beginPath();
      ctx.arc(0, -36, 34, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  },

  monHumanoid(ctx, col, base, walk) {
    ctx.fillStyle = col.dark;
    U.roundRect(ctx, -8 + walk * 2, -20, 6, 20, 2);
    ctx.fill();
    U.roundRect(ctx, 2 - walk * 2, -20, 6, 20, 2);
    ctx.fill();
    ctx.fillStyle = base;
    U.roundRect(ctx, -11, -50, 22, 32, 5);
    ctx.fill();
    // 披风
    ctx.fillStyle = 'rgba(80,20,24,0.8)';
    ctx.beginPath();
    ctx.moveTo(-10, -48);
    ctx.quadraticCurveTo(-22, -24, -16, -8);
    ctx.lineTo(-6, -18);
    ctx.closePath();
    ctx.fill();
    // 手臂与爪
    ctx.strokeStyle = col.skin;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-10, -44); ctx.lineTo(-19, -28);
    ctx.moveTo(10, -44); ctx.lineTo(18, -30);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = '#e8dcc8';
    ctx.beginPath();
    ctx.moveTo(-22, -26); ctx.lineTo(-26, -31); ctx.lineTo(-18, -29);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(21, -28); ctx.lineTo(25, -33); ctx.lineTo(17, -31);
    ctx.fill();
    // 头
    ctx.fillStyle = col.skin;
    ctx.beginPath();
    ctx.arc(0, -56, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#3a1a1a';
    ctx.beginPath();
    ctx.arc(-3, -57, 1.6, 0, TAU);
    ctx.arc(3, -57, 1.6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#c04a3a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-3, -51); ctx.lineTo(3, -51);
    ctx.stroke();
  },

  monPriest(ctx, col, base, walk, time) {
    // 长袍
    const g = ctx.createLinearGradient(0, -58, 0, 0);
    g.addColorStop(0, base);
    g.addColorStop(1, col.dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-9, -52);
    ctx.lineTo(9, -52);
    ctx.quadraticCurveTo(16, -16, 13 + walk * 2, 0);
    ctx.lineTo(-13 + walk * 2, 0);
    ctx.quadraticCurveTo(-16, -16, -9, -52);
    ctx.closePath();
    ctx.fill();
    // 兜帽
    ctx.fillStyle = col.dark;
    ctx.beginPath();
    ctx.arc(0, -56, 10, Math.PI, TAU);
    ctx.lineTo(9, -48);
    ctx.lineTo(-9, -48);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1b1420';
    ctx.beginPath();
    ctx.ellipse(0, -53, 6, 5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = col.eye;
    ctx.beginPath();
    ctx.arc(-2.6, -54, 1.3, 0, TAU);
    ctx.arc(2.6, -54, 1.3, 0, TAU);
    ctx.fill();
    // 法杖
    ctx.strokeStyle = '#5a4430';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(14, -56);
    ctx.stroke();
    const pulse = 0.6 + Math.sin(time * 3) * 0.4;
    ctx.fillStyle = `rgba(190,150,255,${0.5 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(14, -60, 5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(190,150,255,${0.15 * pulse})`;
    ctx.beginPath();
    ctx.arc(14, -60, 12, 0, TAU);
    ctx.fill();
  },

  monDragon(ctx, col, base, walk, time, boss) {
    const flap = Math.sin(time * 2.6) * 0.16;
    // 翅膀
    ctx.fillStyle = 'rgba(50,20,24,0.85)';
    for (let side = -1; side <= 1; side += 2) {
      ctx.save();
      ctx.scale(side, 1);
      ctx.beginPath();
      ctx.moveTo(12, -52);
      ctx.quadraticCurveTo(38, -76 + flap * 26, 54, -48);
      ctx.quadraticCurveTo(36, -50, 28, -30);
      ctx.quadraticCurveTo(26, -46, 12, -52);
      ctx.fill();
      ctx.restore();
    }
    // 尾
    ctx.strokeStyle = col.dark;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, -20);
    ctx.quadraticCurveTo(-30, -16 + walk * 3, -38, -30);
    ctx.stroke();
    ctx.lineCap = 'butt';
    // 腿
    ctx.fillStyle = col.dark;
    U.roundRect(ctx, -12 + walk * 2, -20, 9, 20, 3);
    ctx.fill();
    U.roundRect(ctx, 3 - walk * 2, -20, 9, 20, 3);
    ctx.fill();
    // 身体
    const g = ctx.createLinearGradient(-16, -56, 16, -16);
    g.addColorStop(0, base);
    g.addColorStop(1, col.dark);
    ctx.fillStyle = g;
    U.roundRect(ctx, -15, -54, 30, 36, 8);
    ctx.fill();
    // 腹部纹
    ctx.strokeStyle = 'rgba(255,220,160,0.25)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(0, -46 + i * 7, 8 - i, 2.2, 0, 0, TAU);
      ctx.stroke();
    }
    // 头
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.ellipse(4, -64, 12, 10, -0.1, 0, TAU);
    ctx.fill();
    // 角
    ctx.strokeStyle = '#d8c39a';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-2, -72); ctx.lineTo(-8, -82);
    ctx.moveTo(8, -72); ctx.lineTo(13, -80);
    ctx.stroke();
    // 眼
    ctx.fillStyle = col.eye;
    ctx.beginPath();
    ctx.arc(8, -66, 2.2, 0, TAU);
    ctx.fill();
    // 火焰吐息
    if (boss) {
      const a = 0.25 + Math.sin(time * 4) * 0.08;
      ctx.fillStyle = `rgba(255,120,40,${a})`;
      ctx.beginPath();
      ctx.moveTo(16, -62);
      ctx.quadraticCurveTo(34, -66, 44, -58);
      ctx.quadraticCurveTo(32, -56, 16, -58);
      ctx.fill();
    }
  },

  drawRemoteMark(ctx, mon, time) {
    // 队友的怪：脚下青环 + 头顶小箭标，和自己刷的怪区分开
    const r = (mon.size || 1) * 20;
    const pulse = 0.55 + Math.sin(time * 3 + mon.seed) * 0.2;
    ctx.save();
    ctx.strokeStyle = `rgba(120,214,255,${pulse})`;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.ellipse(mon.x, mon.y - 2, r, r * 0.38, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    const ty = mon.y - (mon.size || 1) * 74 - (mon.boss ? 30 : 12);
    ctx.fillStyle = `rgba(120,214,255,${0.5 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.moveTo(mon.x, ty + 7);
    ctx.lineTo(mon.x - 5, ty);
    ctx.lineTo(mon.x + 5, ty);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  drawMonsterPlate(ctx, mon, game) {
    const d = mon.def;
    if (mon.dead) return;
    const bob = 0;
    const top = mon.y - (d.size > 1.4 ? 104 : 76) * (d.size / Math.max(1, d.size * 0.9)) - bob;
    const showBar = mon.hp < mon.maxHp || mon.boss || mon.elite || mon.remote;
    const focus = game.target === mon;
    if (!showBar && !focus) return;
    const w = d.boss ? 96 : d.elite ? 58 : 46;
    const x = mon.x - w / 2;
    const y = mon.y - (d.size || 1) * 74 - (d.boss ? 24 : 0);
    if (mon.hp < mon.maxHp || mon.boss || mon.remote) {
      ctx.fillStyle = 'rgba(8,6,5,0.75)';
      U.roundRect(ctx, x - 1, y - 1, w + 2, 7, 3);
      ctx.fill();
      const pct = U.clamp(mon.hp / mon.maxHp, 0, 1);
      const grad = ctx.createLinearGradient(x, 0, x + w, 0);
      if (mon.boss) {
        grad.addColorStop(0, '#8a1414');
        grad.addColorStop(0.6, '#e5472c');
        grad.addColorStop(1, '#ff9a6a');
      } else if (mon.remote) {
        grad.addColorStop(0, '#1d5c78');
        grad.addColorStop(1, '#7fd8ff');
      } else if (mon.elite) {
        grad.addColorStop(0, '#3a6ca8');
        grad.addColorStop(1, '#7fc8ff');
      } else {
        grad.addColorStop(0, '#9a2620');
        grad.addColorStop(1, '#e0684f');
      }
      ctx.fillStyle = grad;
      U.roundRect(ctx, x, y, Math.max(2, w * pct), 5, 2.5);
      ctx.fill();
    }
    if (d.boss || mon.elite || (mon.remote && focus)) {
      ctx.font = `${d.boss ? 12 : 10}px "PingFang SC", sans-serif`;
      ctx.textAlign = 'center';
      const nameColor = d.boss ? '#ff9a88' : mon.remote ? '#8fd8ff' : mon.elite ? '#8fc8ff' : '#e0cba8';
      const label = `${mon.remote ? '队友·' : ''}${mon.elite ? '精英 ' : ''}${d.name}${d.boss ? '' : ' Lv.' + mon.lvl}`;
      U.strokeText(ctx, label, mon.x, y - 7, { fill: nameColor, stroke: 'rgba(0,0,0,0.8)', lineWidth: 3 });
    }
    if (focus) {
      ctx.strokeStyle = 'rgba(255,220,150,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(mon.x, mon.y - 4, (d.size || 1) * 26, 0, TAU);
      ctx.stroke();
    }
  },

  /* --------------------------- 道具 / 掉落 --------------------------- */
  drawLootBeam(ctx, loot, time) {
    let color = null;
    if (loot.kind === 'item' && loot.item) {
      const r = loot.item.rarity;
      if (r >= 2) color = ITEMS.rarity(loot.item).color;
    } else if (loot.kind === 'gold') color = '#ffd27a';
    else if (loot.kind === 'frag') color = '#c9a6ff';
    if (!color) return;
    const pulse = 0.7 + Math.sin(time * 4 + loot.x * 0.05) * 0.3;
    const h = 60 + (loot.item ? loot.item.rarity * 16 : 0);
    const grad = ctx.createLinearGradient(0, loot.y - h, 0, loot.y);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, U.rgba(color, 0.22 * pulse));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(loot.x - 5, loot.y);
    ctx.lineTo(loot.x - 2, loot.y - h);
    ctx.lineTo(loot.x + 2, loot.y - h);
    ctx.lineTo(loot.x + 5, loot.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = U.rgba(color, 0.5 * pulse);
    ctx.beginPath();
    ctx.ellipse(loot.x, loot.y, 10, 4, 0, 0, TAU);
    ctx.fill();
  },

  drawLoot(ctx, loot, time) {
    const bob = Math.sin(time * 3 + loot.x * 0.1) * 2;
    const y = loot.y - 12 + bob;
    if (loot.kind === 'gold') {
      ctx.fillStyle = '#c9953e';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(loot.x - 5 + i * 5, y + 2 - (i % 2) * 2, 4.5, 2.2, 0, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#ffd27a';
      ctx.beginPath();
      ctx.arc(loot.x, y - 3, 1.6, 0, TAU);
      ctx.fill();
    } else if (loot.kind === 'potion') {
      ctx.fillStyle = loot.potion === 'hp' ? '#c0402e' : '#2f6bb0';
      U.roundRect(ctx, loot.x - 4, y - 8, 8, 11, 3);
      ctx.fill();
      ctx.fillStyle = '#e8dfc8';
      ctx.fillRect(loot.x - 2, y - 12, 4, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(loot.x - 2.5, y - 6, 2, 5);
    } else if (loot.kind === 'frag') {
      ctx.save();
      ctx.translate(loot.x, y);
      const halo = ctx.createRadialGradient(0, 6, 1, 0, 6, 22);
      halo.addColorStop(0, 'rgba(201,166,255,0.45)');
      halo.addColorStop(1, 'rgba(201,166,255,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.ellipse(0, 6, 22, 9, 0, 0, TAU);
      ctx.fill();
      ctx.rotate(Math.sin(time * 2 + loot.x * 0.1) * 0.12);
      // 书页残片
      ctx.fillStyle = '#6d4b9c';
      ctx.beginPath();
      ctx.moveTo(-7, -13);
      ctx.lineTo(7, -9);
      ctx.lineTo(5, 8);
      ctx.lineTo(-6, 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e6d9ff';
      ctx.beginPath();
      ctx.moveTo(-4, -9);
      ctx.lineTo(4, -6);
      ctx.lineTo(3, 4);
      ctx.lineTo(-3, 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#a985e0';
      ctx.fillRect(-3, -4, 6, 1.2);
      ctx.fillRect(-3, -1, 5, 1.2);
      ctx.restore();
      if (loot.amount >= 8) {
        ctx.font = '10px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        U.strokeText(ctx, `碎片 ×${loot.amount}`, loot.x, y - 22, { stroke: 'rgba(0,0,0,0.85)', lineWidth: 3, fill: '#c9a6ff' });
      }
    } else if (loot.kind === 'item' && loot.item) {
      const color = ITEMS.rarity(loot.item).color;
      const r = loot.item.rarity;
      ctx.save();
      ctx.translate(loot.x, y);
      // 地面光环
      const halo = ctx.createRadialGradient(0, 8, 1, 0, 8, 18 + r * 3);
      halo.addColorStop(0, U.rgba(color, 0.4));
      halo.addColorStop(1, U.rgba(color, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.ellipse(0, 8, 18 + r * 3, 8 + r * 1.5, 0, 0, TAU);
      ctx.fill();
      // 旋转符文环
      if (r >= 2) {
        ctx.strokeStyle = U.rgba(color, 0.32);
        ctx.lineWidth = 1;
        ctx.save();
        ctx.scale(1, 0.45);
        ctx.rotate(time * 1.2);
        ctx.beginPath();
        ctx.arc(0, 8, 20 + Math.sin(time * 2) * 2, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
      // 装备图标（随品质放大、上下浮动）
      const bob2 = Math.sin(time * 2.4 + loot.x * 0.1) * 1.6;
      ICONS.drawWorld(ctx, loot.item, 0, bob2 - 6, 30 + r * 2);
      // 高稀有度星芒
      if (r >= 3) {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const a = time * 1.7 + (i / 3) * TAU;
          const d = 15 + r * 3;
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.beginPath();
          ctx.arc(Math.cos(a) * d, Math.sin(a) * d * 0.5 - 6, 1.2, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
      if (r >= 3) {
        ctx.font = '10px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = color;
        U.strokeText(ctx, loot.item.name, loot.x, y - 22, { stroke: 'rgba(0,0,0,0.85)', lineWidth: 3, fill: color });
      }
    }
  },

  /* --------------------------- 投射物 / 粒子 / 特效 --------------------------- */
  drawProjectile(ctx, pr, time) {
    const pal = fxPal(pr.element);
    const color = pr.color || pal.mid;
    const rad = Number.isFinite(pr.radius) ? pr.radius : 8;
    const trail = pr.trail || [];

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 拖尾：沿轨迹渐隐的光斑
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      const k = (i + 1) / (trail.length + 1);
      ctx.fillStyle = withAlpha(color, 0.05 + k * 0.2);
      ctx.beginPath();
      ctx.arc(t.x, t.y, rad * (0.3 + k * 0.95), 0, TAU);
      ctx.fill();
    }
    // 尾部余焰
    for (let i = 0; i < 3; i++) {
      const t = trail[Math.max(0, trail.length - 1 - i)];
      if (!t) break;
      const flick = 0.65 + Math.sin(time * 30 + i * 2.1) * 0.35;
      ctx.fillStyle = withAlpha(pal.mid, 0.14 * flick);
      ctx.beginPath();
      ctx.arc(t.x, t.y, rad * (0.7 + i * 0.55) * flick, 0, TAU);
      ctx.fill();
    }

    // 外层光晕
    this.fxGlow(ctx, pr.x, pr.y, rad * 4.4, pal.edge, 0.3);
    this.fxGlow(ctx, pr.x, pr.y, rad * 2.6, pal.mid, 0.55);

    if (pr.extra && pr.extra.talisman) {
      // 灵魂火符：旋转符纸 + 符文
      ctx.translate(pr.x, pr.y);
      ctx.rotate(time * 4.2);
      ctx.fillStyle = 'rgba(255,238,176,0.95)';
      ctx.fillRect(-rad * 0.9, -rad * 1.35, rad * 1.8, rad * 2.7);
      ctx.strokeStyle = 'rgba(196,52,36,0.9)';
      ctx.lineWidth = Math.max(1, rad * 0.14);
      ctx.beginPath();
      ctx.moveTo(0, -rad);
      ctx.lineTo(0, rad);
      ctx.moveTo(-rad * 0.52, -rad * 0.1);
      ctx.lineTo(rad * 0.52, -rad * 0.1);
      ctx.moveTo(-rad * 0.4, rad * 0.6);
      ctx.lineTo(rad * 0.4, rad * 0.6);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(pal.mid, 0.7);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, rad * 2, 0, TAU);
      ctx.stroke();
    } else if (pr.element === 'ice') {
      // 冰锥
      ctx.translate(pr.x, pr.y);
      ctx.rotate(Math.atan2(pr.vy || 0, pr.vx || 1));
      ctx.fillStyle = 'rgba(228,250,255,0.95)';
      ctx.beginPath();
      ctx.moveTo(rad * 2, 0);
      ctx.lineTo(-rad * 0.9, -rad * 0.85);
      ctx.lineTo(-rad * 0.3, 0);
      ctx.lineTo(-rad * 0.9, rad * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(rad * 0.3, 0, rad * 0.42, 0, TAU);
      ctx.fill();
    } else {
      // 魔弹核心与旋转尾翼
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, rad * 0.62, 0, TAU);
      ctx.fill();
      ctx.translate(pr.x, pr.y);
      ctx.rotate(time * 7);
      ctx.strokeStyle = withAlpha(pal.core, 0.75);
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, rad * 1.3, i * Math.PI, i * Math.PI + 1.15);
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  drawParticle(ctx, pa) {
    const life = U.clamp(pa.t / pa.dur, 0, 1);
    const alpha = 1 - life;
    if (alpha <= 0) return;
    const additive = pa.glow || pa.shape === 'ember' || pa.shape === 'spark';
    if (additive) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
    }
    if (pa.glow) this.fxGlow(ctx, pa.x, pa.y, pa.size * 3.2, pa.color, alpha * 0.5);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = pa.color;
    const s = pa.size * (1 - life * 0.38);

    if (pa.shape === 'spark') {
      // 沿速度方向的细长火星
      const sp = Math.hypot(pa.vx, pa.vy) || 1;
      const nx = pa.vx / sp;
      const ny = pa.vy / sp;
      ctx.strokeStyle = pa.color;
      ctx.lineWidth = Math.max(0.8, s * 0.7);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pa.x - nx * s * 2.4, pa.y - ny * s * 2.4);
      ctx.lineTo(pa.x, pa.y);
      ctx.stroke();
    } else if (pa.shape === 'ember') {
      ctx.globalAlpha = alpha * 0.9;
      ctx.beginPath();
      ctx.arc(pa.x, pa.y, s * 0.9, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(pa.x, pa.y, s * 0.35, 0, TAU);
      ctx.fill();
    } else if (pa.shape === 'shard') {
      ctx.translate(pa.x, pa.y);
      ctx.rotate(pa.rot || life * 4);
      ctx.fillStyle = pa.color;
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.8);
      ctx.lineTo(s * 0.7, 0);
      ctx.lineTo(0, s * 1.8);
      ctx.lineTo(-s * 0.7, 0);
      ctx.closePath();
      ctx.fill();
    } else if (pa.shape === 'bubble') {
      ctx.globalAlpha = alpha * 0.75;
      ctx.strokeStyle = pa.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pa.x, pa.y, s * (1.1 + life * 0.6), 0, TAU);
      ctx.stroke();
    } else if (pa.shape === 'smoke') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = alpha * 0.22;
      ctx.fillStyle = pa.color;
      ctx.beginPath();
      ctx.arc(pa.x, pa.y, s * (2.2 + life * 2.6), 0, TAU);
      ctx.fill();
    } else if (pa.shape === 'leaf') {
      ctx.beginPath();
      ctx.ellipse(pa.x, pa.y, s, s * 0.5, pa.rot || 0, 0, TAU);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(pa.x, pa.y, s, 0, TAU);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    if (additive) ctx.restore();
  },

  drawGroundAoe(ctx, e) {
    const t = U.clamp(e.t / e.dur, 0, 1);
    const fade = 1 - t;
    const pal = fxPal(e.element);
    const color = e.color || pal.mid;

    if (e.type === 'ring') {
      const r = e.r0 + (e.r1 - e.r0) * U.easeOutCubic(t);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // 内层淡光
      const g = ctx.createRadialGradient(e.x, e.y, r * 0.55, e.x, e.y, r);
      g.addColorStop(0, withAlpha(color, 0));
      g.addColorStop(0.75, withAlpha(color, 0.1 * fade));
      g.addColorStop(1, withAlpha(color, 0.26 * fade));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, TAU);
      ctx.fill();
      // 外环
      ctx.strokeStyle = withAlpha(color, 0.85 * fade);
      ctx.lineWidth = (e.width || 3) * fade + 1;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = withAlpha('#ffffff', 0.5 * fade);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r * 0.97, 0, TAU);
      ctx.stroke();
      // 环上刻度
      ctx.strokeStyle = withAlpha(color, 0.5 * fade);
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        const r0 = r * 0.94;
        const r1 = r * (i % 2 ? 1.02 : 1.08);
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(a) * r0, e.y + Math.sin(a) * r0);
        ctx.lineTo(e.x + Math.cos(a) * r1, e.y + Math.sin(a) * r1);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    if (e.element === 'ice') {
      this.fxFrostGround(ctx, e, t);
      return;
    }
    if (e.element === 'poison') {
      this.fxPoisonPool(ctx, e, t);
      return;
    }

    const r = e.r;
    const grow = U.easeOutCubic(Math.min(1, t * 2.2));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(e.x, e.y, r * 0.08, e.x, e.y, r * grow);
    g.addColorStop(0, withAlpha(pal.core, 0.32 * fade));
    g.addColorStop(0.5, withAlpha(color, 0.18 * fade));
    g.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * grow, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = withAlpha(color, 0.7 * fade);
    ctx.lineWidth = 2.4 * fade + 1;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * (0.35 + 0.65 * t), 0, TAU);
    ctx.stroke();
    this.fxSparks(ctx, e.x, e.y, r * 0.9, 10, pal.spark, 0.35 * fade, t * 6);
    ctx.restore();
  },

  drawTelegraph(ctx, e) {
    const t = U.clamp(e.t / e.dur, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.16 + t * 0.25;
    ctx.fillStyle = 'rgba(220,30,20,0.55)';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * t, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = 'rgba(255,90,60,0.9)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,160,110,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * t, 0, TAU);
    ctx.stroke();
    ctx.restore();
  },

  /* --------------------------- 特效笔刷 --------------------------- */
  fxGlow(ctx, x, y, r, color, alpha) {
    if (!(r > 0) || alpha <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, withAlpha(color, alpha));
    g.addColorStop(0.42, withAlpha(color, alpha * 0.42));
    g.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  },

  fxSparks(ctx, x, y, r, count, color, alpha, rot = 0) {
    if (alpha <= 0) return;
    ctx.strokeStyle = withAlpha(color, alpha);
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const a = rot + (i / count) * TAU + Math.sin(i * 3.17) * 0.35;
      const r0 = r * 0.34;
      const r1 = r * (0.78 + 0.35 * Math.abs(Math.sin(i * 7.73)));
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
      ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
      ctx.stroke();
    }
  },

  fxStar(ctx, x, y, len, color, alpha, rot = 0) {
    if (len <= 0 || alpha <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = withAlpha(color, alpha);
    for (let i = 0; i < 2; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -len);
      ctx.lineTo(len * 0.15, 0);
      ctx.lineTo(0, len);
      ctx.lineTo(-len * 0.15, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  },

  drawEffect(ctx, e, time) {
    const t = U.clamp(e.t / e.dur, 0, 1);
    switch (e.type) {
      case 'slash': this.fxSlash(ctx, e, t, e.style); break;
      case 'fireArc': this.fxFireArc(ctx, e, t, time); break;
      case 'crescent': this.fxCrescent(ctx, e, t); break;
      case 'thrust': this.fxThrust(ctx, e, t); break;
      case 'ring':
      case 'aoe': this.drawGroundAoe(ctx, e); break;
      case 'explode': this.fxExplode(ctx, e, t); break;
      case 'fireNova': this.fxFireNova(ctx, e, t, time); break;
      case 'lightning': this.fxLightning(ctx, e, t); break;
      case 'frost': this.fxFrost(ctx, e, t); break;
      case 'poison': this.fxPoison(ctx, e, t, time); break;
      case 'heal': this.fxHeal(ctx, e, t); break;
      case 'levelup': this.fxLevelup(ctx, e, t, time); break;
      case 'summon': this.fxSummon(ctx, e, t); break;
      case 'hit': this.fxHit(ctx, e, t); break;
      case 'impact': this.fxImpact(ctx, e, t); break;
      case 'teleport': this.fxTeleport(ctx, e, t); break;
      case 'shockwave': this.fxShockwave(ctx, e, t); break;
      case 'shieldRune': this.fxShieldRune(ctx, e, t, time); break;
      case 'holyRune': this.fxHolyRune(ctx, e, t); break;
      default: break;
    }
  },

  /* 普通挥砍：三层弧光 + 刀尖爆闪 */
  fxSlash(ctx, e, t, style) {
    const pal = fxPal(style === 'fire' ? 'fire' : e.element);
    const k = U.easeOutCubic(t);
    const arc = e.arc || 1.2;
    const start = e.angle - arc / 2;
    const end = start + arc * k;
    const fade = 1 - t;
    const color = e.color || pal.mid;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    ctx.strokeStyle = withAlpha(color, 0.12 * fade);
    ctx.lineWidth = 22 * fade + 5;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.range, start, end);
    ctx.stroke();

    ctx.strokeStyle = withAlpha(pal.mid, 0.4 * fade);
    ctx.lineWidth = 9 * fade + 2.5;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.range, start, end);
    ctx.stroke();

    ctx.strokeStyle = withAlpha(pal.core, 0.9 * fade);
    ctx.lineWidth = 2.6 * fade + 0.8;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.range * (0.97 + 0.03 * k), start, end);
    ctx.stroke();

    const midA = (start + end) / 2;
    const tx = e.x + Math.cos(end) * e.range;
    const ty = e.y + Math.sin(end) * e.range;
    this.fxGlow(ctx, tx, ty, 14 + 8 * fade, pal.core, 0.7 * fade);
    this.fxGlow(
      ctx,
      e.x + Math.cos(midA) * e.range * 0.86,
      e.y + Math.sin(midA) * e.range * 0.86,
      22,
      pal.mid,
      0.28 * fade
    );
    this.fxSparks(ctx, tx, ty, 20, 4, pal.spark, 0.55 * fade, end);
    ctx.restore();
  },

  /* 半月弯刀：实心月牙刀光 */
  fxCrescent(ctx, e, t) {
    const pal = fxPal(e.element);
    const mid = e.color && e.color[0] === '#' ? e.color : pal.mid;
    const k = U.easeOutCubic(t);
    const arc = e.arc || 1.4;
    const start = e.angle - arc / 2;
    const end = start + arc * k;
    const fade = 1 - t;
    const rOut = e.range;
    const rIn = e.range * 0.52;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.arc(e.x, e.y, rOut, start, end);
    ctx.arc(e.x, e.y, rIn, end, start, true);
    ctx.closePath();
    const g = ctx.createRadialGradient(e.x, e.y, rIn * 0.8, e.x, e.y, rOut);
    g.addColorStop(0, withAlpha(mid, 0));
    g.addColorStop(0.55, withAlpha(mid, 0.42 * fade));
    g.addColorStop(1, withAlpha(pal.edge, 0.1 * fade));
    ctx.fillStyle = g;
    ctx.fill();

    ctx.strokeStyle = withAlpha(pal.core, 0.82 * fade);
    ctx.lineWidth = 2.2 * fade + 0.6;
    ctx.beginPath();
    ctx.arc(e.x, e.y, rOut, start, end);
    ctx.stroke();
    ctx.strokeStyle = withAlpha(mid, 0.5 * fade);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(e.x, e.y, rIn, start, end);
    ctx.stroke();

    const tx = e.x + Math.cos(end) * rOut;
    const ty = e.y + Math.sin(end) * rOut;
    this.fxGlow(ctx, tx, ty, 16, pal.core, 0.7 * fade);
    this.fxStar(ctx, tx, ty, 16 * (1 - t) + 6, pal.core, 0.6 * fade, end);
    ctx.restore();
  },

  /* 烈火剑法：月牙 + 沿刃翻卷的火焰 */
  fxFireArc(ctx, e, t, time) {
    const pal = FX.fire;
    this.fxCrescent(ctx, { ...e, element: 'fire' }, t);
    const fade = 1 - t;
    const k = U.easeOutCubic(t);
    const arc = e.arc || 1.4;
    const start = e.angle - arc / 2;
    const end = start + arc * k;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const n = 10;
    for (let i = 0; i < n; i++) {
      const p = i / (n - 1);
      const a = start + (end - start) * p;
      const bx = e.x + Math.cos(a) * e.range;
      const by = e.y + Math.sin(a) * e.range;
      const flick = 0.7 + Math.sin(time * 26 + i * 1.7) * 0.3;
      const len = (12 + Math.abs(Math.sin(i * 2.3)) * 22) * (1 - t * 0.55) * flick;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      ctx.fillStyle = withAlpha(i % 2 ? pal.mid : pal.edge, 0.34 * fade);
      ctx.beginPath();
      ctx.moveTo(bx - dy * 4, by + dx * 4);
      ctx.quadraticCurveTo(bx + dx * len * 0.6 - dy * 5, by + dy * len * 0.6 + dx * 5, bx + dx * len, by + dy * len);
      ctx.quadraticCurveTo(bx + dx * len * 0.45 + dy * 5, by + dy * len * 0.45 - dx * 5, bx + dy * 4, by - dx * 4);
      ctx.closePath();
      ctx.fill();
    }
    for (let i = 0; i < 8; i++) {
      const a = start + ((end - start) * i) / 8;
      const rr = e.range * (0.9 + Math.sin(time * 9 + i) * 0.12);
      this.fxGlow(ctx, e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr - (1 - t) * 12, 4.5, pal.spark, 0.6 * fade);
    }
    ctx.restore();
  },

  /* 刺杀剑术：直线剑气 + 尖端十字闪光 */
  fxThrust(ctx, e, t) {
    const pal = FX.phys;
    const k = U.easeOutCubic(t);
    const fade = 1 - t;
    const len = e.range * (0.55 + 0.45 * k);
    const dx = Math.cos(e.angle);
    const dy = Math.sin(e.angle);
    const px = -dy;
    const py = dx;
    const w0 = 13 * fade + 3;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(e.x, e.y, e.x + dx * len, e.y + dy * len);
    g.addColorStop(0, withAlpha(pal.mid, 0.04));
    g.addColorStop(0.55, withAlpha(pal.mid, 0.46 * fade));
    g.addColorStop(1, withAlpha(pal.core, 0.18 * fade));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(e.x + px * w0, e.y + py * w0);
    ctx.lineTo(e.x + dx * len + px * 1.5, e.y + dy * len + py * 1.5);
    ctx.lineTo(e.x + dx * len - px * 1.5, e.y + dy * len - py * 1.5);
    ctx.lineTo(e.x - px * w0, e.y - py * w0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = withAlpha(pal.core, 0.95 * fade);
    ctx.lineWidth = 3.2 * fade + 1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + dx * len, e.y + dy * len);
    ctx.stroke();

    // 附带的并行细剑气
    ctx.strokeStyle = withAlpha(pal.mid, 0.45 * fade);
    ctx.lineWidth = 1.2;
    for (let i = -1; i <= 1; i += 2) {
      ctx.beginPath();
      ctx.moveTo(e.x + px * i * 7, e.y + py * i * 7);
      ctx.lineTo(e.x + dx * len * 0.92 + px * i * 4, e.y + dy * len * 0.92 + py * i * 4);
      ctx.stroke();
    }

    const tipX = e.x + dx * len;
    const tipY = e.y + dy * len;
    this.fxGlow(ctx, tipX, tipY, 28 * fade + 10, pal.core, 0.9 * fade);
    this.fxStar(ctx, tipX, tipY, 30 * fade + 8, pal.core, 0.9 * fade, e.angle + Math.PI / 4);
    this.fxSparks(ctx, tipX, tipY, 26, 6, pal.spark, 0.6 * fade, e.angle);
    ctx.strokeStyle = withAlpha(pal.mid, 0.6 * fade);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(tipX, tipY, 12 + (1 - fade) * 22, 0, TAU);
    ctx.stroke();
    ctx.restore();
  },

  /* 爆炸：核心 + 火焰尖刺 + 烟环 */
  fxExplode(ctx, e, t) {
    const fade = 1 - t;
    const pal = e.element ? fxPal(e.element) : { core: '#fff6dd', mid: e.color || '#ffb056', edge: e.color || '#ff6a3c', spark: '#ffd27a' };
    const r = Math.max(1, (e.r || 60) * U.easeOutCubic(t));

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.fxGlow(ctx, e.x, e.y, r, pal.mid, 0.65 * fade);
    this.fxGlow(ctx, e.x, e.y, r * 0.5, pal.core, 0.9 * fade);

    ctx.strokeStyle = withAlpha(pal.core, 0.75 * fade);
    ctx.lineWidth = 3.2 * fade + 1;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.98, 0, TAU);
    ctx.stroke();

    const n = 14;
    const rot = e.x * 0.017 + e.y * 0.013;
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * TAU + t * 0.8;
      const jitter = 0.72 + Math.abs(Math.sin(i * 7.3 + e.x * 0.11)) * 0.55;
      const rr = r * (0.55 + jitter * 0.55);
      const w = 0.1 + Math.abs(Math.sin(i * 3.7)) * 0.09;
      ctx.fillStyle = withAlpha(i % 2 ? pal.edge : pal.mid, 0.26 * fade);
      ctx.beginPath();
      ctx.moveTo(e.x + Math.cos(a - w) * r * 0.55, e.y + Math.sin(a - w) * r * 0.55);
      ctx.lineTo(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr);
      ctx.lineTo(e.x + Math.cos(a + w) * r * 0.55, e.y + Math.sin(a + w) * r * 0.55);
      ctx.closePath();
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.1 * fade;
    ctx.fillStyle = '#0a0806';
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 1.08, 0, TAU);
    ctx.fill();
    ctx.restore();
  },

  /* 烈火剑法爆发：地面火环 + 上升火舌 */
  fxFireNova(ctx, e, t, time) {
    const pal = FX.fire;
    const fade = 1 - t;
    const R = e.r || 140;
    const k = U.easeOutCubic(t);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(1, 0.5);
    this.fxGlow(ctx, 0, 0, R * k * 0.9, pal.edge, 0.45 * fade);
    ctx.strokeStyle = withAlpha(pal.mid, 0.85 * fade);
    ctx.lineWidth = 8 * fade + 2;
    ctx.beginPath();
    ctx.arc(0, 0, R * k, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = withAlpha(pal.core, 0.75 * fade);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, R * k * 0.9, 0, TAU);
    ctx.stroke();
    // 地面火海
    const disc = ctx.createRadialGradient(0, 0, 0, 0, 0, R * k);
    disc.addColorStop(0, withAlpha(pal.mid, 0.3 * fade));
    disc.addColorStop(0.65, withAlpha(pal.edge, 0.16 * fade));
    disc.addColorStop(1, withAlpha(pal.edge, 0));
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(0, 0, R * k, 0, TAU);
    ctx.fill();
    ctx.restore();

    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU + 0.3;
      const bx = e.x + Math.cos(a) * R * k;
      const by = e.y + Math.sin(a) * R * k * 0.5;
      const flick = 0.7 + Math.sin(time * 22 + i * 1.3) * 0.3;
      const h = (30 + Math.abs(Math.sin(i * 2.1)) * 46) * (1 - t * 0.6) * flick;
      ctx.fillStyle = withAlpha(i % 2 ? pal.mid : pal.edge, 0.4 * fade);
      ctx.beginPath();
      ctx.moveTo(bx - 6, by);
      ctx.quadraticCurveTo(bx - 2.5, by - h * 0.6, bx, by - h);
      ctx.quadraticCurveTo(bx + 2.5, by - h * 0.6, bx + 6, by);
      ctx.closePath();
      ctx.fill();
      // 内焰
      ctx.fillStyle = withAlpha(pal.core, 0.28 * fade);
      ctx.beginPath();
      ctx.moveTo(bx - 2.2, by);
      ctx.quadraticCurveTo(bx - 1, by - h * 0.45, bx, by - h * 0.65);
      ctx.quadraticCurveTo(bx + 1, by - h * 0.45, bx + 2.2, by);
      ctx.closePath();
      ctx.fill();
    }
    this.fxStar(ctx, e.x, e.y - 18, 30 * (1 - t) + 10, pal.core, 0.55 * fade, 0);
    ctx.restore();
  },

  /* 雷电术：主雷 + 分叉 + 落点冲击 */
  fxLightning(ctx, e, t) {
    const pts = e.points || [];
    if (pts.length < 2) return;
    const fade = 1 - t;
    const drawPath = () => {
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
        else ctx.lineTo(pts[i].x, pts[i].y);
      }
    };

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.strokeStyle = withAlpha('#7fd8ff', 0.16 * fade);
    ctx.lineWidth = 11;
    drawPath();
    ctx.stroke();

    ctx.strokeStyle = withAlpha('#bfe9ff', 0.5 * fade);
    ctx.lineWidth = 4.5;
    drawPath();
    ctx.stroke();

    ctx.strokeStyle = withAlpha('#ffffff', 0.95 * fade);
    ctx.lineWidth = 1.6;
    drawPath();
    ctx.stroke();

    // 分叉
    ctx.strokeStyle = withAlpha('#bfe9ff', 0.55 * fade);
    ctx.lineWidth = 1.2;
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const base = Math.atan2(b.y - a.y, b.x - a.x);
      for (let j = 0; j < 2; j++) {
        const ang = base + (j ? 1 : -1) * (0.7 + Math.sin(i * 5.1 + j) * 0.3);
        const len = 14 + ((i * 7 + j * 13) % 18);
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + Math.cos(ang) * len, my + Math.sin(ang) * len);
        ctx.stroke();
      }
    }

    const last = pts[pts.length - 1];
    this.fxGlow(ctx, last.x, last.y, 30 * fade + 10, '#bfe9ff', 0.8 * fade);
    this.fxStar(ctx, last.x, last.y, 26 * fade + 8, '#ffffff', 0.85 * fade, 0);
    ctx.strokeStyle = withAlpha('#d8f6ff', 0.6 * fade);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(last.x, last.y, 10 + (1 - fade) * 28, 0, TAU);
    ctx.stroke();
    ctx.restore();
  },

  /* 冰咆哮：冰盘 + 冰刺 */
  fxFrost(ctx, e, t) {
    const fade = 1 - t;
    const R = e.r || 120;
    this.fxFrostGround(ctx, e, t);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + 0.2;
      const rr = R * U.easeOutCubic(t) * (0.55 + (i % 3) * 0.14);
      const bx = e.x + Math.cos(a) * rr;
      const by = e.y + Math.sin(a) * rr * 0.5;
      const len = (18 + ((i * 37) % 22)) * (1 - t) * (R / 120);
      const w = 3 + (i % 2) * 2;
      ctx.fillStyle = withAlpha(i % 2 ? '#d8f6ff' : '#8fd8ff', 0.72 * fade);
      ctx.beginPath();
      ctx.moveTo(bx - Math.sin(a) * w, by + Math.cos(a) * w * 0.5);
      ctx.lineTo(bx + Math.cos(a) * w * 0.4, by + Math.sin(a) * w * 0.2 - len);
      ctx.lineTo(bx + Math.sin(a) * w, by - Math.cos(a) * w * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    this.fxStar(ctx, e.x, e.y - 10, 26 * (1 - t) + 8, '#ffffff', 0.55 * fade, 0);
    ctx.restore();
  },

  fxFrostGround(ctx, e, t) {
    const fade = 1 - t;
    const R = e.r || 120;
    const grow = U.easeOutCubic(Math.min(1, t * 1.6));
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(1, 0.52);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * grow);
    g.addColorStop(0, withAlpha('#ffffff', 0.38 * fade));
    g.addColorStop(0.45, withAlpha('#bfeaff', 0.26 * fade));
    g.addColorStop(1, withAlpha('#3f8fe0', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R * grow, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = withAlpha('#d8f6ff', 0.7 * fade);
    ctx.lineWidth = 3 * fade + 1;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.92 * grow, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = withAlpha('#bff0ff', 0.5 * fade);
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + t * 1.6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.78 * grow, Math.sin(a) * R * 0.78 * grow);
      ctx.lineTo(Math.cos(a) * R * 0.98 * grow, Math.sin(a) * R * 0.98 * grow);
      ctx.stroke();
    }
    ctx.restore();
  },

  /* 施毒术：毒池 + 气泡 */
  fxPoison(ctx, e, t, time) {
    const fade = 1 - t;
    const R = e.r || 110;
    this.fxPoisonPool(ctx, e, t);

    ctx.save();
    for (let i = 0; i < 10; i++) {
      const a = i * 2.399;
      const rr = R * 0.5 * (0.3 + ((i * 13) % 10) / 10);
      const bx = e.x + Math.cos(a) * rr;
      const by = e.y + Math.sin(a) * rr * 0.5;
      const ph = (time * 1.4 + i * 0.37) % 1;
      ctx.fillStyle = withAlpha('#c8ff9a', 0.5 * fade * (1 - ph));
      ctx.beginPath();
      ctx.arc(bx, by - ph * 34, 2.2 + (i % 3), 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = withAlpha('#9ce08a', 0.32 * fade);
    ctx.lineWidth = 2;
    for (let j = 0; j < 2; j++) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, R * 0.6 * (0.5 + j * 0.3) + t * 18, time * 2 + j * 2, time * 2 + j * 2 + 2.2);
      ctx.stroke();
    }
    ctx.restore();
  },

  fxPoisonPool(ctx, e, t) {
    const fade = 1 - t;
    const R = e.r || 110;
    const grow = 0.6 + 0.4 * U.easeOutCubic(t);
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(1, 0.5);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * grow);
    g.addColorStop(0, withAlpha('#4fbf3f', 0.4 * fade));
    g.addColorStop(0.6, withAlpha('#2f7a26', 0.24 * fade));
    g.addColorStop(1, withAlpha('#1c3f18', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R * grow, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = withAlpha('#9ce08a', 0.35 * fade);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, R * grow * 0.92, 0, TAU);
    ctx.stroke();
    ctx.restore();
  },

  /* 治愈术：脚下光环 + 上升光柱 */
  fxHeal(ctx, e, t) {
    const fade = 1 - t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const rr = 12 + i * 10 + t * 30;
      ctx.strokeStyle = withAlpha('#8cffae', (0.5 - i * 0.12) * fade);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, rr, rr * 0.34, 0, 0, TAU);
      ctx.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const ox = (i - 1) * 10;
      const g = ctx.createLinearGradient(e.x + ox, e.y - 90, e.x + ox, e.y);
      g.addColorStop(0, withAlpha('#c8ffd8', 0));
      g.addColorStop(0.55, withAlpha('#8cffae', 0.14 * fade));
      g.addColorStop(1, withAlpha('#8cffae', 0.32 * fade));
      ctx.fillStyle = g;
      ctx.fillRect(e.x + ox - 6, e.y - 90, 12, 90);
    }
    for (let i = 0; i < 10; i++) {
      const ph = (t * 1.2 + i * 0.13) % 1;
      const a = i * 2.3;
      const px = e.x + Math.cos(a) * (10 + ph * 18);
      const py = e.y - 20 - ph * 70;
      ctx.fillStyle = withAlpha('#d8ffe2', 0.8 * (1 - ph) * fade);
      ctx.beginPath();
      ctx.arc(px, py, 1.8 + ph * 1.6, 0, TAU);
      ctx.fill();
    }
    this.fxStar(ctx, e.x, e.y - 50, 26 * (1 - t) + 8, '#d8ffe2', 0.7 * fade, 0);
    ctx.restore();
  },

  /* 升级：光柱 + 旋转符文环 */
  fxLevelup(ctx, e, t, time) {
    const fade = 1 - t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(e.x, e.y - 280, e.x, e.y);
    g.addColorStop(0, 'rgba(255,220,130,0)');
    g.addColorStop(0.55, `rgba(255,220,130,${fade * 0.45})`);
    g.addColorStop(1, `rgba(255,232,160,${fade * 0.85})`);
    ctx.fillStyle = g;
    ctx.fillRect(e.x - 34, e.y - 280, 68, 280);
    ctx.fillStyle = g;
    ctx.fillRect(e.x - 12, e.y - 280, 24, 280);

    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(1, 0.36);
    ctx.rotate(t * 2 + time * 0.2);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = withAlpha('#ffe28a', (0.42 - i * 0.1) * fade);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 30 + i * 20 + t * 44, 0, TAU);
      ctx.stroke();
    }
    ctx.strokeStyle = withAlpha('#fff3c4', 0.5 * fade);
    ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 54, Math.sin(a) * 54);
      ctx.lineTo(Math.cos(a) * 64, Math.sin(a) * 64);
      ctx.stroke();
    }
    ctx.restore();

    for (let i = 0; i < 8; i++) {
      const ph = (t * 1.3 + i * 0.12) % 1;
      ctx.fillStyle = withAlpha('#ffe9a8', 0.8 * (1 - ph) * fade);
      ctx.beginPath();
      ctx.arc(e.x + Math.sin(i * 2.1 + time) * 18, e.y - ph * 120, 2.2, 0, TAU);
      ctx.fill();
    }
    this.fxGlow(ctx, e.x, e.y - 150, 70, '#ffe9a8', 0.28 * fade);
    ctx.restore();
  },

  /* 召唤：地面法阵 */
  fxSummon(ctx, e, t) {
    const fade = 1 - t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(1, 0.42);
    ctx.rotate(t * 1.6);
    ctx.strokeStyle = withAlpha('#c88aff', 0.8 * fade);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * TAU) / 5;
      const x = Math.cos(a) * 30;
      const y = Math.sin(a) * 30;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = withAlpha('#a864ff', 0.5 * fade);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, TAU);
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const ph = (t * 1.4 + i * 0.1) % 1;
      ctx.fillStyle = withAlpha('#d8b0ff', 0.7 * (1 - ph) * fade);
      ctx.beginPath();
      ctx.arc(e.x + Math.cos(a) * 20, e.y - ph * 50, 2, 0, TAU);
      ctx.fill();
    }
    this.fxGlow(ctx, e.x, e.y - 20, 36, '#c88aff', 0.4 * fade);
    ctx.restore();
  },

  /* 命中火花 */
  fxHit(ctx, e, t) {
    const fade = 1 - t;
    const pal = fxPal(e.element);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.fxGlow(ctx, e.x, e.y, 18 * fade + 6, pal.mid, 0.5 * fade);
    this.fxStar(ctx, e.x, e.y, 16 + t * 10, pal.core, 0.8 * fade, e.seed || 0);
    this.fxSparks(ctx, e.x, e.y, 18 + t * 16, 5, pal.spark, 0.7 * fade, e.seed || 0);
    ctx.restore();
  },

  /* 元素命中冲击（每次伤害都会出现） */
  fxImpact(ctx, e, t) {
    const fade = 1 - t;
    const pal = fxPal(e.element);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.fxGlow(ctx, e.x, e.y, 8 + t * 26, pal.mid, 0.55 * fade);
    ctx.strokeStyle = withAlpha(pal.core, 0.75 * fade);
    ctx.lineWidth = 2.4 * fade + 0.8;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 6 + t * 22, 0, TAU);
    ctx.stroke();
    this.fxSparks(ctx, e.x, e.y, 10 + t * 20, 7, pal.core, 0.8 * fade, e.seed || 0);
    ctx.restore();
  },

  /* 传送 / 复活 */
  fxTeleport(ctx, e, t) {
    const fade = 1 - t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.fxGlow(ctx, e.x, e.y - 20, 55 + t * 40, '#8fd8ff', 0.5 * fade);
    const g = ctx.createLinearGradient(e.x, e.y - 140, e.x, e.y);
    g.addColorStop(0, 'rgba(160,220,255,0)');
    g.addColorStop(0.6, `rgba(160,220,255,${0.18 * fade})`);
    g.addColorStop(1, `rgba(200,240,255,${0.36 * fade})`);
    ctx.fillStyle = g;
    ctx.fillRect(e.x - 20, e.y - 140, 40, 140);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = withAlpha('#bfeaff', (0.55 - i * 0.14) * fade);
      ctx.lineWidth = 2.4 - i * 0.5;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, 24 + i * 12 + t * 52, 8 + i * 4 + t * 18, 0, 0, TAU);
      ctx.stroke();
    }
    this.fxSparks(ctx, e.x, e.y - 24, 40 + t * 30, 10, '#dff6ff', 0.6 * fade, t * 4);
    ctx.restore();
  },

  /* 冲锋冲击波 */
  fxShockwave(ctx, e, t) {
    const fade = 1 - t;
    const R = (e.r || 80) * U.easeOutCubic(t);
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const rr = R * (1 - i * 0.19);
      ctx.strokeStyle = withAlpha(e.color || '#ffcf9a', (0.6 - i * 0.16) * fade);
      ctx.lineWidth = (4 - i) * fade + 1;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, rr, rr * 0.36, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.24 * fade;
    ctx.fillStyle = '#c0ad92';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.3;
      const d = R * (0.55 + (i % 3) * 0.16);
      ctx.beginPath();
      ctx.arc(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d * 0.5 - 2, 5 + (i % 3) * 3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },

  /* 魔法盾起手符文 */
  fxShieldRune(ctx, e, t, time) {
    const fade = 1 - t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(e.x, e.y - 26);
    ctx.rotate(time * 2.4);
    ctx.strokeStyle = withAlpha('#9fe4ff', 0.7 * fade);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 26 + t * 12, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = withAlpha('#dff6ff', 0.75 * fade);
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 18);
      ctx.lineTo(Math.cos(a) * 25, Math.sin(a) * 25);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.fxGlow(ctx, e.x, e.y - 26, 46 + t * 16, '#8fd8ff', 0.38 * fade);
    ctx.restore();
  },

  /* 神圣战甲术起手 */
  fxHolyRune(ctx, e, t) {
    const fade = 1 - t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(e.x, e.y);
    ctx.scale(1, 0.42);
    ctx.rotate(-t * 1.8);
    ctx.strokeStyle = withAlpha('#ffe08a', 0.75 * fade);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, 30 + t * 26, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 34, Math.sin(a) * 34);
      ctx.lineTo(Math.cos(a) * 42, Math.sin(a) * 42);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const ox = (i - 1) * 12;
      const g = ctx.createLinearGradient(e.x + ox, e.y - 70, e.x + ox, e.y);
      g.addColorStop(0, 'rgba(255,224,138,0)');
      g.addColorStop(1, `rgba(255,224,138,${0.28 * fade})`);
      ctx.fillStyle = g;
      ctx.fillRect(e.x + ox - 5, e.y - 70, 10, 70);
    }
    this.fxStar(ctx, e.x, e.y - 40, 26 * (1 - t) + 8, '#fff0b0', 0.6 * fade, 0);
    ctx.restore();
  },

  drawLights(ctx, game) {
    const time = game.time;
    if (!game.map.lights.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.62;
    const viewW = this.w / this.scale;
    const viewH = this.h / this.scale;
    for (const light of game.map.lights) {
      const dx = Math.abs(light.x - game.camera.x);
      const dy = Math.abs(light.y - game.camera.y);
      if (dx > viewW / 2 + 220 || dy > viewH / 2 + 220) continue;
      const flick = 0.82 + Math.sin(time * 5 + light.phase) * 0.1 + Math.sin(time * 11 + light.phase * 2) * 0.06;
      const r = light.r * flick;
      const g = ctx.createRadialGradient(light.x, light.y, 2, light.x, light.y, r);
      g.addColorStop(0, light.color);
      g.addColorStop(0.55, light.color.replace(/0\.\d+\)$/, '0.07)'));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(light.x, light.y, r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },

  drawAmbient(game, dt) {
    const zone = game.map.zone;
    const kind = zone.theme.ambient;
    const ctx = this.ctx;
    const t = game.time;
    const n = kind === 'ember' ? 34 : 26;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const seed = i * 12.9898 + game.map.ambientSeed;
      const baseX = (U.hash2(i, 7, seed) * 1.3 - 0.15) * this.w;
      const baseY = (U.hash2(i, 13, seed) * 1.3 - 0.15) * this.h;
      let x = baseX;
      let y = baseY;
      let size = 1.4;
      let color = 'rgba(255,240,200,0.4)';
      let alpha = 0.35;
      if (kind === 'ember') {
        y = this.h - ((baseY + t * (14 + (i % 5) * 6)) % (this.h + 60));
        x = baseX + Math.sin(t * 0.8 + i) * 22;
        color = 'rgba(255,140,60,0.9)';
        size = 1.2 + (i % 3) * 0.8;
        alpha = 0.5 + Math.sin(t * 3 + i) * 0.25;
      } else if (kind === 'leaf') {
        x = (baseX + t * (12 + (i % 4) * 8)) % (this.w + 80) - 40;
        y = (baseY + t * (8 + (i % 3) * 5)) % (this.h + 80) - 40;
        color = 'rgba(120,180,90,0.55)';
        size = 2.4;
        alpha = 0.3;
      } else if (kind === 'pollen') {
        x = (baseX + Math.sin(t * 0.5 + i) * 30) % this.w;
        y = (baseY + Math.cos(t * 0.4 + i * 2) * 24 + this.h) % this.h;
        color = 'rgba(255,235,170,0.75)';
        alpha = 0.3 + Math.sin(t * 2 + i) * 0.15;
      } else {
        x = (baseX + t * 4) % this.w;
        y = (baseY + Math.sin(t * 0.6 + i) * 30) % this.h;
        color = 'rgba(210,200,180,0.5)';
        alpha = 0.16;
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // 区域色偏
    if (zone.theme.tint) {
      ctx.fillStyle = zone.theme.tint;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  },

  drawTexts(game) {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    for (const tx of game.texts) {
      const k = U.clamp(tx.t / tx.dur, 0, 1);
      const alpha = k < 0.7 ? 1 : (1 - k) / 0.3;
      const pos = this.worldToScreen(game, tx.x, tx.y);
      const rise = U.easeOutCubic(k) * 34;
      const scale = tx.crit ? 1.18 : 1;
      ctx.globalAlpha = alpha;
      ctx.font = `${tx.crit ? 700 : 500} ${Math.round((tx.crit ? 20 : 14) * scale)}px "PingFang SC", sans-serif`;
      U.strokeText(ctx, tx.text, pos.x, pos.y - rise, {
        fill: tx.color,
        stroke: 'rgba(0,0,0,0.85)',
        lineWidth: tx.crit ? 4 : 3,
      });
    }
    ctx.restore();
  },

  drawLowHp(game) {
    const p = game.player;
    const pct = p.hp / p.stats.hp;
    if (pct < 0.3 && !p.dead) {
      const puls = 0.5 + Math.sin(game.time * 5) * 0.5;
      const alpha = (0.3 - pct) * 0.5 * puls;
      const g = this.ctx.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.2, this.w / 2, this.h / 2, this.h * 0.75);
      g.addColorStop(0, 'rgba(120,0,0,0)');
      g.addColorStop(1, `rgba(140,10,5,${alpha})`);
      this.ctx.fillStyle = g;
      this.ctx.fillRect(0, 0, this.w, this.h);
    }
  },

  drawMini(game) {
    if (!this.miniCtx) return;
    const now = performance.now();
    if (now - this._lastMini < 120) return;
    this._lastMini = now;
    const ctx = this.miniCtx;
    const map = game.map;
    const S = this.mini.width;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 1, 0, TAU);
    ctx.clip();
    ctx.fillStyle = '#0a0706';
    ctx.fillRect(0, 0, S, S);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(map.mini, 0, 0, S, S);
    const toMini = (x, y) => ({ x: (x / (map.w * DATA.TILE)) * S, y: (y / (map.h * DATA.TILE)) * S });
    // 视野框
    const vw = (this.w / this.scale / (map.w * DATA.TILE)) * S;
    const vh = (this.h / this.scale / (map.h * DATA.TILE)) * S;
    const pc = toMini(game.player.x, game.player.y);
    ctx.strokeStyle = 'rgba(255,230,180,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(pc.x - vw / 2, pc.y - vh / 2, vw, vh);
    // 怪物
    for (const m of game.monsters) {
      if (m.dead) continue;
      const q = toMini(m.x, m.y);
      ctx.fillStyle = m.remote ? 'rgba(111,210,255,0.9)' : m.def.boss ? 'rgba(255,70,50,0.95)' : m.elite ? 'rgba(120,190,255,0.9)' : 'rgba(220,120,90,0.8)';
      ctx.beginPath();
      ctx.arc(q.x, q.y, m.def.boss ? 2.6 : 1.3, 0, TAU);
      ctx.fill();
    }
    // 掉落
    for (const l of game.loot) {
      const q = toMini(l.x, l.y);
      ctx.fillStyle = l.kind === 'item' ? 'rgba(255,200,90,0.9)' : 'rgba(255,230,150,0.5)';
      ctx.fillRect(q.x - 1, q.y - 1, 2, 2);
    }
    // 玩家
    ctx.fillStyle = '#ffe6a8';
    ctx.beginPath();
    ctx.arc(pc.x, pc.y, 2.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
    // 外圈
    ctx.strokeStyle = 'rgba(217,172,92,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, TAU);
    ctx.stroke();
  },

  /* --------------------------- 场景道具 --------------------------- */
  drawProp(ctx, prop, time) {
    const { x, y, type, scale, phase, flip } = prop;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * (flip || 1), scale);
    const sway = Math.sin(time * 1.4 + phase) * 0.03;
    switch (type) {
      case 'tree': {
        ctx.fillStyle = '#4a3522';
        U.roundRect(ctx, -4, -34, 8, 34, 3);
        ctx.fill();
        ctx.rotate(sway);
        ctx.fillStyle = '#2f4a2a';
        ctx.beginPath();
        ctx.arc(-12, -46, 18, 0, TAU);
        ctx.arc(10, -50, 16, 0, TAU);
        ctx.arc(0, -62, 20, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#3c5c33';
        ctx.beginPath();
        ctx.arc(-8, -58, 12, 0, TAU);
        ctx.arc(8, -62, 10, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(150,200,120,0.18)';
        ctx.beginPath();
        ctx.arc(-6, -68, 8, 0, TAU);
        ctx.fill();
        break;
      }
      case 'pine': {
        ctx.fillStyle = '#3e2c1e';
        U.roundRect(ctx, -3.5, -26, 7, 26, 2);
        ctx.fill();
        ctx.rotate(sway);
        ctx.fillStyle = '#24402b';
        for (let i = 0; i < 3; i++) {
          const w = 26 - i * 6;
          const yy = -32 - i * 18;
          ctx.beginPath();
          ctx.moveTo(0, yy - 24);
          ctx.lineTo(w, yy);
          ctx.lineTo(-w, yy);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(120,170,110,0.16)';
        ctx.beginPath();
        ctx.moveTo(0, -92); ctx.lineTo(10, -70); ctx.lineTo(-2, -72);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'rock': {
        const g = ctx.createLinearGradient(-14, -24, 14, 0);
        g.addColorStop(0, '#6a6259');
        g.addColorStop(1, '#332d29');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-16, 0);
        ctx.lineTo(-12, -14);
        ctx.lineTo(-2, -22);
        ctx.lineTo(10, -18);
        ctx.lineTo(16, -4);
        ctx.lineTo(12, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.moveTo(-10, -15); ctx.lineTo(-2, -20); ctx.lineTo(4, -18); ctx.lineTo(-4, -12);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'grass': {
        ctx.strokeStyle = '#4c6a3a';
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 5; i++) {
          const a = -0.6 + i * 0.3 + Math.sin(time + phase + i) * 0.06;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(Math.sin(a) * 8, -8, Math.sin(a) * 14, -14 - (i % 2) * 4);
          ctx.stroke();
        }
        break;
      }
      case 'stump': {
        ctx.fillStyle = '#4a3522';
        U.roundRect(ctx, -9, -12, 18, 12, 2);
        ctx.fill();
        ctx.fillStyle = '#6a4c30';
        ctx.beginPath();
        ctx.ellipse(0, -12, 9, 3.5, 0, 0, TAU);
        ctx.fill();
        break;
      }
      case 'mushroom': {
        ctx.fillStyle = '#d8c8a8';
        ctx.fillRect(-1.6, -10, 3.2, 10);
        ctx.fillStyle = '#8c3a3a';
        ctx.beginPath();
        ctx.ellipse(0, -12, 8, 5, 0, Math.PI, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,220,180,0.6)';
        ctx.beginPath();
        ctx.arc(-3, -14, 1.2, 0, TAU);
        ctx.arc(3, -13, 0.9, 0, TAU);
        ctx.fill();
        break;
      }
      case 'bones': {
        ctx.strokeStyle = 'rgba(220,215,195,0.7)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-8, -2); ctx.lineTo(8, -6);
        ctx.moveTo(-6, -9); ctx.lineTo(6, -1);
        ctx.stroke();
        ctx.fillStyle = 'rgba(220,215,195,0.8)';
        ctx.beginPath();
        ctx.arc(9, -6, 2.4, 0, TAU);
        ctx.fill();
        break;
      }
      case 'skull': {
        ctx.fillStyle = 'rgba(225,222,208,0.85)';
        ctx.beginPath();
        ctx.arc(0, -6, 6, 0, TAU);
        ctx.fill();
        ctx.fillRect(-4, -3, 8, 3);
        ctx.fillStyle = '#231a14';
        ctx.beginPath();
        ctx.arc(-2, -7, 1.4, 0, TAU);
        ctx.arc(2, -7, 1.4, 0, TAU);
        ctx.fill();
        break;
      }
      case 'pillar': {
        const g = ctx.createLinearGradient(-10, 0, 10, 0);
        g.addColorStop(0, '#4a4034');
        g.addColorStop(0.5, '#7a6b54');
        g.addColorStop(1, '#3a3228');
        ctx.fillStyle = g;
        ctx.fillRect(-9, -62, 18, 62);
        ctx.fillStyle = '#8a7a5f';
        ctx.fillRect(-13, -66, 26, 7);
        ctx.fillRect(-12, -6, 24, 6);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(-9, -50 + i * 16);
          ctx.lineTo(9, -50 + i * 16);
          ctx.stroke();
        }
        break;
      }
      case 'brazier': {
        ctx.fillStyle = '#3a2c20';
        ctx.fillRect(-2.5, -16, 5, 16);
        ctx.fillStyle = '#5a4630';
        ctx.beginPath();
        ctx.ellipse(0, -18, 11, 5, 0, 0, TAU);
        ctx.fill();
        const fl = 0.8 + Math.sin(time * 8 + phase) * 0.2;
        ctx.fillStyle = 'rgba(255,130,50,0.85)';
        ctx.beginPath();
        ctx.ellipse(0, -26 - fl * 4, 7, 12 * fl, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,230,160,0.9)';
        ctx.beginPath();
        ctx.ellipse(0, -24 - fl * 3, 3.4, 6.5 * fl, 0, 0, TAU);
        ctx.fill();
        break;
      }
      case 'torch': {
        ctx.fillStyle = '#4a3522';
        ctx.fillRect(-2, -34, 4, 34);
        ctx.fillStyle = 'rgba(255,150,60,0.9)';
        ctx.beginPath();
        ctx.ellipse(0, -38, 5, 9 + Math.sin(time * 9 + phase) * 2, 0, 0, TAU);
        ctx.fill();
        break;
      }
      case 'statue': {
        ctx.fillStyle = '#6a5f4c';
        U.roundRect(ctx, -8, -44, 16, 44, 3);
        ctx.fill();
        ctx.fillStyle = '#8a7c62';
        ctx.beginPath();
        ctx.arc(0, -50, 7, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,180,100,0.5)';
        ctx.beginPath();
        ctx.arc(-2.4, -51, 1.1, 0, TAU);
        ctx.arc(2.4, -51, 1.1, 0, TAU);
        ctx.fill();
        break;
      }
      case 'crystal': {
        const pulse = 0.7 + Math.sin(time * 2 + phase) * 0.3;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(120,210,255,${0.2 * pulse})`;
        ctx.beginPath();
        ctx.ellipse(0, -12, 18, 22, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#7fd0e8';
        ctx.beginPath();
        ctx.moveTo(0, -34);
        ctx.lineTo(7, -12);
        ctx.lineTo(0, 0);
        ctx.lineTo(-7, -12);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(220,250,255,0.8)';
        ctx.beginPath();
        ctx.moveTo(0, -30); ctx.lineTo(3, -14); ctx.lineTo(0, -8); ctx.lineTo(-3, -14);
        ctx.closePath();
        ctx.fill();
        break;
      }
      default: break;
    }
    ctx.restore();
  },
};
