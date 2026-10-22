import { U } from '../core/util.js';
import { DATA } from '../data/gamedata.js';

export const TILE_FLOOR = 0;
export const TILE_WALL = 1;
export const TILE_ROUGH = 2;
export const TILE_HAZARD = 3;

const T = DATA.TILE;

function smoothNoise(x, y, seed) {
  const gx = x / 4.5;
  const gy = y / 4.5;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = U.hash2(x0, y0, seed);
  const b = U.hash2(x0 + 1, y0, seed);
  const c = U.hash2(x0, y0 + 1, seed);
  const d = U.hash2(x0 + 1, y0 + 1, seed);
  const top = a + (b - a) * ux;
  const bot = c + (d - c) * ux;
  return top + (bot - top) * uy;
}

export const WORLD = {
  tileBlocked(t) {
    return t === TILE_WALL || t === TILE_HAZARD;
  },

  zone(zoneId) {
    return DATA.ZONES.find((z) => z.id === zoneId) || DATA.ZONES[0];
  },

  generate(zoneId) {
    const zone = this.zone(zoneId);
    const size = zone.size || 48;
    const w = size;
    const h = size;
    const tiles = new Uint8Array(w * h);
    const map = {
      zoneId: zone.id,
      zone,
      w,
      h,
      tiles,
      props: [],
      lights: [],
      spawn: { x: 0, y: 0 },
      boss: null,
      seed: Math.floor(Math.random() * 1e9),
      ambientSeed: Math.random() * 100,
    };
    const rng = U.seeded(map.seed);

    const idx = (x, y) => y * w + x;
    const setTile = (x, y, v) => {
      if (x >= 0 && y >= 0 && x < w && y < h) tiles[idx(x, y)] = v;
    };
    const getTile = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? tiles[idx(x, y)] : TILE_WALL);

    // 边界
    for (let x = 0; x < w; x++) {
      setTile(x, 0, TILE_WALL);
      setTile(x, h - 1, TILE_WALL);
    }
    for (let y = 0; y < h; y++) {
      setTile(0, y, TILE_WALL);
      setTile(w - 1, y, TILE_WALL);
    }

    const spawnTX = Math.floor(w / 2);
    const spawnTY = Math.floor(h / 2);

    if (zone.style === 'temple' || zone.style === 'lair') {
      this.carveRooms(map, rng, setTile, getTile, spawnTX, spawnTY);
    } else if (zone.style === 'canyon') {
      this.carveCanyon(map, rng, setTile, getTile, spawnTX, spawnTY);
    } else {
      this.scatterField(map, rng, setTile, getTile, spawnTX, spawnTY);
    }

    // 出生点清空
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (dx * dx + dy * dy <= 11) setTile(spawnTX + dx, spawnTY + dy, TILE_FLOOR);
      }
    }

    // 连通性：从出生点防洪
    const reachable = new Uint8Array(w * h);
    const queue = [spawnTY * w + spawnTX];
    reachable[queue[0]] = 1;
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const cx = cur % w;
      const cy = (cur / w) | 0;
      const neigh = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of neigh) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1) continue;
        const ni = idx(nx, ny);
        if (reachable[ni] || this.tileBlocked(tiles[ni])) continue;
        reachable[ni] = 1;
        queue.push(ni);
      }
    }

    // 不可达区域变为墙，并挑选远处房间做 BOSS 场地
    let bossBest = { x: spawnTX, y: spawnTY, d: -1 };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = idx(x, y);
        if (!this.tileBlocked(tiles[i])) {
          if (!reachable[i]) {
            tiles[i] = TILE_WALL;
          } else {
            const d = (x - spawnTX) ** 2 + (y - spawnTY) ** 2;
            if (x > 4 && y > 4 && x < w - 5 && y < h - 5 && d > bossBest.d) {
              bossBest = { x, y, d };
            }
          }
        }
      }
    }
    // 让 BOSS 场地周围开阔一些
    if (bossBest.d > 0) {
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          if (dx * dx + dy * dy <= 10) setTile(bossBest.x + dx, bossBest.y + dy, TILE_FLOOR);
        }
      }
      map.boss = { x: (bossBest.x + 0.5) * T, y: (bossBest.y + 0.5) * T };
    }
    map.spawn = { x: (spawnTX + 0.5) * T, y: (spawnTY + 0.5) * T };

    // 装饰与光源
    this.decorate(map, rng, getTile);

    // 小地图底图
    map.mini = this.buildMini(map);

    return map;
  },

  scatterField(map, rng, setTile, getTile, spawnTX, spawnTY) {
    const { w, h, zone } = map;
    const forest = zone.style === 'forest';
    const blobs = Math.floor((w * h) / (forest ? 78 : 120));
    for (let i = 0; i < blobs; i++) {
      const cx = 2 + Math.floor(rng() * (w - 4));
      const cy = 2 + Math.floor(rng() * (h - 4));
      if (Math.hypot(cx - spawnTX, cy - spawnTY) < 6) continue;
      const r = 1 + Math.floor(rng() * (forest ? 3.4 : 2.4));
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          if (x * x + y * y <= r * r + rng() * 0.8) {
            setTile(cx + x, cy + y, TILE_WALL);
          }
        }
      }
    }
    // 粗糙地面 / 危险地形
    for (let i = 0; i < (w * h) / 90; i++) {
      const cx = 2 + Math.floor(rng() * (w - 4));
      const cy = 2 + Math.floor(rng() * (h - 4));
      const r = 1 + Math.floor(rng() * 2.2);
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          if (getTile(cx + x, cy + y) === TILE_FLOOR && x * x + y * y <= r * r) {
            setTile(cx + x, cy + y, zone.style === 'canyon' && rng() < 0.25 ? TILE_HAZARD : TILE_ROUGH);
          }
        }
      }
    }
  },

  carveCanyon(map, rng, setTile, getTile, spawnTX, spawnTY) {
    const { w, h } = map;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        setTile(x, y, rng() < 0.44 ? TILE_WALL : TILE_FLOOR);
      }
    }
    for (let step = 0; step < 4; step++) {
      const copy = map.tiles.slice();
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          let walls = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              if (copy[(y + dy) * w + (x + dx)] === TILE_WALL) walls++;
            }
          }
          if (walls >= 5) setTile(x, y, TILE_WALL);
          else if (walls <= 3) setTile(x, y, TILE_FLOOR);
        }
      }
    }
    // 开阔空地
    for (let i = 0; i < 14; i++) {
      const cx = 3 + Math.floor(rng() * (w - 6));
      const cy = 3 + Math.floor(rng() * (h - 6));
      const r = 2 + Math.floor(rng() * 3);
      if (Math.hypot(cx - spawnTX, cy - spawnTY) < 7) continue;
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          if (x * x + y * y <= r * r) setTile(cx + x, cy + y, TILE_FLOOR);
        }
      }
    }
    // 熔岩裂隙
    for (let i = 0; i < 10; i++) {
      let x = 4 + Math.floor(rng() * (w - 8));
      let y = 4 + Math.floor(rng() * (h - 8));
      const len = 5 + Math.floor(rng() * 9);
      for (let k = 0; k < len; k++) {
        if (getTile(x, y) === TILE_FLOOR) setTile(x, y, TILE_HAZARD);
        x += Math.floor(rng() * 3) - 1;
        y += Math.floor(rng() * 3) - 1;
      }
    }
  },

  carveRooms(map, rng, setTile, getTile, spawnTX, spawnTY) {
    const { w, h } = map;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) setTile(x, y, TILE_WALL);
    }
    const rooms = [];
    const attempts = 46;
    for (let i = 0; i < attempts; i++) {
      const rw = 5 + Math.floor(rng() * 6);
      const rh = 5 + Math.floor(rng() * 5);
      const rx = 2 + Math.floor(rng() * (w - rw - 4));
      const ry = 2 + Math.floor(rng() * (h - rh - 4));
      const overlaps = rooms.some((r) => rx < r.x + r.w + 1 && rx + rw + 1 > r.x && ry < r.y + r.h + 1 && ry + rh + 1 > r.y);
      if (overlaps) continue;
      rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + (rw >> 1), cy: ry + (rh >> 1) });
      for (let yy = ry; yy < ry + rh; yy++) {
        for (let xx = rx; xx < rx + rw; xx++) setTile(xx, yy, TILE_FLOOR);
      }
    }
    // 中央大厅
    rooms.push({ x: spawnTX - 4, y: spawnTY - 4, w: 9, h: 9, cx: spawnTX, cy: spawnTY });
    for (let y = spawnTY - 4; y <= spawnTY + 4; y++) {
      for (let x = spawnTX - 4; x <= spawnTX + 4; x++) setTile(x, y, TILE_FLOOR);
    }
    // L 型走廊
    const sorted = rooms.slice().sort((a, b) => a.cx - b.cx);
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1];
      const b = sorted[i];
      const wide = 2;
      for (let x = Math.min(a.cx, b.cx); x <= Math.max(a.cx, b.cx); x++) {
        for (let k = 0; k < wide; k++) setTile(x, a.cy + k - 1, TILE_FLOOR);
      }
      for (let y = Math.min(a.cy, b.cy); y <= Math.max(a.cy, b.cy); y++) {
        for (let k = 0; k < wide; k++) setTile(b.cx + k - 1, y, TILE_FLOOR);
      }
    }
    // 随机柱子与破损
    for (let i = 0; i < (w * h) / 60; i++) {
      const x = 2 + Math.floor(rng() * (w - 4));
      const y = 2 + Math.floor(rng() * (h - 4));
      if (getTile(x, y) === TILE_FLOOR && Math.hypot(x - spawnTX, y - spawnTY) > 6) {
        if (rng() < 0.5) setTile(x, y, TILE_WALL);
        else if (rng() < 0.5) setTile(x, y, TILE_ROUGH);
      }
    }
  },

  decorate(map, rng, getTile) {
    const { w, h, zone } = map;
    const pool = zone.theme.props || ['rock'];
    const count = Math.floor((w * h) / 24);
    for (let i = 0; i < count; i++) {
      const x = 1 + Math.floor(rng() * (w - 2));
      const y = 1 + Math.floor(rng() * (h - 2));
      if (this.tileBlocked(getTile(x, y))) continue;
      if (Math.hypot(x * T - map.spawn.x, y * T - map.spawn.y) < 100) continue;
      const type = pool[Math.floor(rng() * pool.length)];
      const px = (x + 0.2 + rng() * 0.6) * T;
      const py = (y + 0.3 + rng() * 0.6) * T;
      const scale = 0.75 + rng() * 0.65;
      map.props.push({ type, x: px, y: py, scale, phase: rng() * 10, flip: rng() < 0.5 ? -1 : 1 });
      if ((type === 'brazier' || type === 'torch' || type === 'crystal' || type === 'statue') && map.lights.length < 12 && rng() < 0.55) {
        map.lights.push({
          x: px, y: py - 8,
          r: type === 'brazier' ? 132 : type === 'crystal' ? 104 : 84,
          color: type === 'crystal' ? 'rgba(110,200,235,0.13)' : 'rgba(255,150,60,0.15)',
          phase: rng() * 10,
          type,
        });
      }
    }
    // 保证 BOSS 场地有火盆
    if (map.boss) {
      for (let k = 0; k < 4; k++) {
        const ang = (k / 4) * Math.PI * 2;
        const px = map.boss.x + Math.cos(ang) * 118;
        const py = map.boss.y + Math.sin(ang) * 118;
        map.props.push({ type: 'brazier', x: px, y: py, scale: 0.95, phase: rng() * 10, flip: 1 });
        map.lights.push({ x: px, y: py - 8, r: 118, color: 'rgba(255,140,60,0.16)', phase: rng() * 10, type: 'brazier' });
      }
    }
  },

  buildMini(map) {
    const c = document.createElement('canvas');
    c.width = map.w;
    c.height = map.h;
    const ctx = c.getContext('2d');
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const t = map.tiles[y * map.w + x];
        if (t === TILE_WALL) ctx.fillStyle = 'rgba(8,6,5,0.92)';
        else if (t === TILE_HAZARD) ctx.fillStyle = 'rgba(150,50,30,0.55)';
        else if (t === TILE_ROUGH) ctx.fillStyle = 'rgba(120,110,85,0.28)';
        else ctx.fillStyle = 'rgba(120,112,92,0.17)';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return c;
  },

  buildTerrain(map) {
    const { w, h, zone } = map;
    const c = document.createElement('canvas');
    c.width = w * T;
    c.height = h * T;
    const ctx = c.getContext('2d');
    const theme = zone.theme;
    const TAU = Math.PI * 2;

    // 平滑地面底色：先按 1px/格 生成噪声，再放大插值，避免逐格纯色块
    const base = document.createElement('canvas');
    base.width = w;
    base.height = h;
    const bctx = base.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = smoothNoise(x, y, map.seed);
        bctx.fillStyle = U.mix(theme.floor[0], theme.floor[2], n);
        bctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(base, 0, 0, w, h, 0, 0, w * T, h * T);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = map.tiles[y * w + x];
        const px = x * T;
        const py = y * T;
        const r1 = U.hash2(x, y, map.seed);
        const r2 = U.hash2(x, y, map.seed + 7);

        if (t === TILE_WALL) {
          // 石墙：主体 + 顶面 + 砖缝
          ctx.fillStyle = U.shade(theme.wall, -12 + Math.floor(r1 * 10));
          ctx.fillRect(px, py, T, T);
          ctx.fillStyle = U.shade(theme.wallTop, -8);
          ctx.fillRect(px + 2, py + 2, T - 4, T - 10);
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(px + 2, py + 2, T - 4, 3);
          ctx.fillStyle = 'rgba(0,0,0,0.28)';
          ctx.fillRect(px, py + T - 4, T, 4);
          ctx.fillRect(px + T - 3, py, 3, T);
          ctx.strokeStyle = 'rgba(0,0,0,0.22)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px, py + T * 0.46);
          ctx.lineTo(px + T, py + T * 0.46);
          ctx.moveTo(px + T * (0.3 + r2 * 0.4), py + 2);
          ctx.lineTo(px + T * (0.3 + r2 * 0.4), py + T * 0.46);
          ctx.stroke();
          // 苔藓 / 裂纹
          if (r2 > 0.72) {
            ctx.fillStyle = 'rgba(90,120,60,0.24)';
            ctx.beginPath();
            ctx.ellipse(px + T * 0.28, py + T * 0.2, T * 0.18, T * 0.1, r1 * 3, 0, TAU);
            ctx.fill();
          }
        } else if (t === TILE_HAZARD) {
          ctx.fillStyle = '#1a0f0c';
          ctx.fillRect(px, py, T, T);
          const grad = ctx.createRadialGradient(px + T / 2, py + T / 2, 2, px + T / 2, py + T / 2, T * 0.7);
          grad.addColorStop(0, 'rgba(255,120,40,0.85)');
          grad.addColorStop(0.5, 'rgba(180,50,20,0.5)');
          grad.addColorStop(1, 'rgba(60,10,5,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(px, py, T, T);
          ctx.strokeStyle = 'rgba(255,170,80,0.45)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(px + T * 0.15, py + T * 0.6);
          ctx.lineTo(px + T * 0.42, py + T * 0.35);
          ctx.lineTo(px + T * 0.66, py + T * 0.55);
          ctx.lineTo(px + T * 0.88, py + T * 0.3);
          ctx.stroke();
        } else {
          // 大面积柔光斑，打散格子的生硬边界
          if (r2 > 0.72) {
            const gx = px + T * 0.5;
            const gy = py + T * 0.5;
            const rad = T * (0.5 + r1 * 0.5);
            const soft = ctx.createRadialGradient(gx, gy, 1, gx, gy, rad);
            soft.addColorStop(0, 'rgba(255,255,255,0.035)');
            soft.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = soft;
            ctx.fillRect(px - T * 0.2, py - T * 0.2, T * 1.4, T * 1.4);
          }
          if (t === TILE_ROUGH) {
            ctx.fillStyle = 'rgba(0,0,0,0.13)';
            for (let k = 0; k < 3; k++) {
              const rx = px + U.hash2(x * 3 + k, y, map.seed + 3) * T;
              const ry = py + U.hash2(x, y * 3 + k, map.seed + 5) * T;
              ctx.beginPath();
              ctx.ellipse(rx, ry, 2 + r1 * 2, 1.2, r1 * 4, 0, TAU);
              ctx.fill();
            }
          }
          // 草叶 / 碎石 / 地砖缝
          if (r2 > 0.55) {
            ctx.strokeStyle = theme.detail;
            ctx.globalAlpha = 0.18 + r1 * 0.14;
            ctx.lineWidth = 1;
            ctx.beginPath();
            const gx = px + 6 + r1 * (T - 12);
            const gy = py + 8 + r2 * (T - 16);
            ctx.moveTo(gx, gy);
            ctx.lineTo(gx + (r1 - 0.5) * 7, gy - 5 - r2 * 4);
            ctx.moveTo(gx + 3, gy);
            ctx.lineTo(gx + 6 + (r1 - 0.5) * 5, gy - 3);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          if (r1 > 0.85) {
            ctx.fillStyle = theme.detail;
            ctx.globalAlpha = 0.22;
            ctx.beginPath();
            ctx.arc(px + T * r2, py + T * r1, 1.6, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
          // 地砖网格（寺庙）
          if (zone.style === 'temple' || zone.style === 'lair') {
            ctx.strokeStyle = 'rgba(0,0,0,0.16)';
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
          }
        }
      }
    }

    // 墙根阴影：给墙下侧的 floor 加一点暗
    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w; x++) {
        if (map.tiles[y * w + x] === TILE_WALL && map.tiles[(y + 1) * w + x] !== TILE_WALL) {
          const grad = ctx.createLinearGradient(0, (y + 1) * T, 0, (y + 2) * T);
          grad.addColorStop(0, 'rgba(0,0,0,0.38)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(x * T, (y + 1) * T, T, T);
        }
      }
    }

    return c;
  },

  blocked(map, px, py, radius = 12) {
    const minX = Math.floor((px - radius) / T);
    const maxX = Math.floor((px + radius) / T);
    const minY = Math.floor((py - radius) / T);
    const maxY = Math.floor((py + radius) / T);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (x < 0 || y < 0 || x >= map.w || y >= map.h) return true;
        if (this.tileBlocked(map.tiles[y * map.w + x])) {
          // 圆形近似检查
          const cx = U.clamp(px, x * T, x * T + T);
          const cy = U.clamp(py, y * T, y * T + T);
          if ((px - cx) ** 2 + (py - cy) ** 2 < radius * radius) return true;
        }
      }
    }
    return false;
  },

  move(map, x, y, nx, ny, radius = 12) {
    let rx = x;
    let ry = y;
    if (!this.blocked(map, nx, ry, radius)) rx = nx;
    if (!this.blocked(map, rx, ny, radius)) ry = ny;
    return { x: rx, y: ry };
  },

  // 两点之间是否没有墙（自动战斗 / 自动寻路共用）
  lineClear(map, x1, y1, x2, y2, radius = 10) {
    const d = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(d / (T * 0.35)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (this.blocked(map, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, radius)) return false;
    }
    return true;
  },

  // 找离目标最近的可行走格子（点击到墙里时自动修正）
  openTileNear(map, x, y, radius = 15, maxR = 6) {
    const tx = U.clamp(Math.floor(x / T), 0, map.w - 1);
    const ty = U.clamp(Math.floor(y / T), 0, map.h - 1);
    const walkable = (cx, cy) =>
      cx >= 0 && cy >= 0 && cx < map.w && cy < map.h &&
      !this.blocked(map, (cx + 0.5) * T, (cy + 0.5) * T, radius);
    if (walkable(tx, ty)) return { x: tx, y: ty };
    for (let r = 1; r <= maxR; r++) {
      let best = null;
      let bestD = Infinity;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const cx = tx + dx;
          const cy = ty + dy;
          if (!walkable(cx, cy)) continue;
          const d = dx * dx + dy * dy;
          if (d < bestD) {
            bestD = d;
            best = { x: cx, y: cy };
          }
        }
      }
      if (best) return best;
    }
    return null;
  },

  // BFS 寻路（8 方向，禁止穿墙角），返回世界坐标路径点
  findPath(map, sx, sy, tx, ty, radius = 15) {
    const W = map.w;
    const H = map.h;
    const start = this.openTileNear(map, sx, sy, radius, 3) || { x: Math.floor(sx / T), y: Math.floor(sy / T) };
    const goal = this.openTileNear(map, tx, ty, radius, 8);
    if (!goal) return null;
    const si = start.y * W + start.x;
    const gi = goal.y * W + goal.x;
    if (si === gi) {
      return this.blocked(map, tx, ty, radius) ? [{ x: (goal.x + 0.5) * T, y: (goal.y + 0.5) * T }] : [{ x: tx, y: ty }];
    }

    const total = W * H;
    const prev = new Int32Array(total).fill(-1);
    const visited = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;
    queue[tail++] = si;
    visited[si] = 1;
    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ];
    while (head < tail) {
      const cur = queue[head++];
      if (cur === gi) break;
      const cx = cur % W;
      const cy = (cur / W) | 0;
      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (visited[ni]) continue;
        if (this.blocked(map, (nx + 0.5) * T, (ny + 0.5) * T, radius)) continue;
        if (dx && dy) {
          // 斜向不允许贴墙角穿过
          if (this.blocked(map, (cx + dx + 0.5) * T, (cy + 0.5) * T, radius)) continue;
          if (this.blocked(map, (cx + 0.5) * T, (cy + dy + 0.5) * T, radius)) continue;
        }
        visited[ni] = 1;
        prev[ni] = cur;
        queue[tail++] = ni;
      }
    }
    if (!visited[gi]) return null;

    const tiles = [];
    let cur = gi;
    while (cur !== si && cur >= 0) {
      tiles.push({ x: cur % W, y: (cur / W) | 0 });
      cur = prev[cur];
    }
    tiles.reverse();

    let pts = tiles.map((t) => ({ x: (t.x + 0.5) * T, y: (t.y + 0.5) * T }));
    if (!this.blocked(map, tx, ty, radius)) pts[pts.length - 1] = { x: tx, y: ty };
    return this.smoothPath(map, sx, sy, pts, radius);
  },

  // 路径拉直：能直线到达的中间点全部跳过
  smoothPath(map, sx, sy, pts, radius = 15) {
    if (!pts.length) return pts;
    const out = [];
    let cx = sx;
    let cy = sy;
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      for (; j > i; j--) {
        if (this.lineClear(map, cx, cy, pts[j].x, pts[j].y, radius)) break;
      }
      out.push(pts[j]);
      cx = pts[j].x;
      cy = pts[j].y;
      i = j + 1;
    }
    return out;
  },

  randomFloor(map, rng = Math.random, awayFrom = null, minDist = 320) {
    for (let i = 0; i < 80; i++) {
      const tx = 1 + Math.floor(rng() * (map.w - 2));
      const ty = 1 + Math.floor(rng() * (map.h - 2));
      const t = map.tiles[ty * map.w + tx];
      if (t !== TILE_FLOOR && t !== TILE_ROUGH) continue;
      const px = (tx + 0.5) * T;
      const py = (ty + 0.5) * T;
      if (awayFrom && U.dist(px, py, awayFrom.x, awayFrom.y) < minDist) continue;
      return { x: px, y: py };
    }
    return { x: map.spawn.x, y: map.spawn.y };
  },
};
