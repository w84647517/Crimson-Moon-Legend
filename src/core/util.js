// 通用工具：数学、随机、格式化、颜色与画布小助手
export const U = {
  TAU: Math.PI * 2,

  clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  },
  lerp(a, b, t) {
    return a + (b - a) * t;
  },
  approach(cur, target, delta) {
    if (cur < target) return Math.min(cur + delta, target);
    return Math.max(cur - delta, target);
  },
  damp(cur, target, speed, dt) {
    return target + (cur - target) * Math.exp(-speed * dt);
  },
  rand(a = 0, b = 1) {
    return a + Math.random() * (b - a);
  },
  randInt(a, b) {
    return Math.floor(a + Math.random() * (b - a + 1));
  },
  chance(p) {
    return Math.random() < p;
  },
  pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
  dist(ax, ay, bx, by) {
    return Math.hypot(bx - ax, by - ay);
  },
  dist2(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    return dx * dx + dy * dy;
  },
  angle(ax, ay, bx, by) {
    return Math.atan2(by - ay, bx - ax);
  },
  angleDiff(a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  },
  normalize(x, y) {
    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l };
  },

  // 确定性随机（地图生成用）
  seeded(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  hash2(x, y, seed = 0) {
    let h = (x * 374761393 + y * 668265263 + seed * 69069) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  },

  fmt(n) {
    n = Math.round(n);
    const abs = Math.abs(n);
    if (abs >= 1e8) return (n / 1e8).toFixed(abs >= 1e9 ? 1 : 2).replace(/\.0+$/, '') + '亿';
    if (abs >= 1e4) return (n / 1e4).toFixed(abs >= 1e5 ? 1 : 2).replace(/\.0+$/, '') + '万';
    return String(n);
  },
  num(n, digits = 0) {
    const v = Number(n) || 0;
    const fixed = digits ? v.toFixed(digits) : String(Math.round(v));
    return fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },
  pct(v, digits = 1) {
    return (Math.round(v * 10 ** digits) / 10 ** digits).toFixed(digits) + '%';
  },
  timeText(sec) {
    sec = Math.max(0, Math.ceil(sec));
    if (sec < 60) return sec + 's';
    const m = Math.floor(sec / 60);
    return m + 'm' + String(sec % 60).padStart(2, '0') + 's';
  },
  esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  },
  uid() {
    U._id = (U._id || 0) + 1;
    return Date.now().toString(36) + '_' + U._id.toString(36) + Math.random().toString(36).slice(2, 6);
  },

  rgba(hex, alpha = 1) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const num = parseInt(h, 16);
    return `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${alpha})`;
  },
  shade(hex, amt) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const num = parseInt(h, 16);
    const r = U.clamp(((num >> 16) & 255) + amt, 0, 255);
    const g = U.clamp(((num >> 8) & 255) + amt, 0, 255);
    const b = U.clamp((num & 255) + amt, 0, 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  },

  mix(hex1, hex2, t) {
    const parse = (h) => {
      let s = h.replace('#', '');
      if (s.length === 3) s = s.split('').map((c) => c + c).join('');
      const n = parseInt(s, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const a = parse(hex1);
    const b = parse(hex2);
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * U.clamp(t, 0, 1)));
    return '#' + ((1 << 24) | (c[0] << 16) | (c[1] << 8) | c[2]).toString(16).slice(1);
  },

  roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  strokeText(ctx, text, x, y, { font, fill, stroke, lineWidth = 3, align = 'center', baseline = 'middle' } = {}) {
    if (font) ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (stroke) {
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = stroke;
      ctx.lineJoin = 'round';
      ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = fill || '#fff';
    ctx.fillText(text, x, y);
  },

  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  },
  easeInCubic(t) {
    return t * t * t;
  },
  easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },

  // 解析 CSS 类名用的稀有度
  rarityClass(r) {
    return 'r' + r;
  },

  randomName(cls) {
    const first = ['孤', '苍', '血', '烈', '冷', '夜', '雷', '铁', '青', '焚'];
    const second = ['狼', '月', '刃', '影', '山', '河', '风', '羽', '锋', '尘'];
    const titles = { warrior: '战', mage: '法', taoist: '道' };
    return U.pick(first) + U.pick(second) + (titles[cls] || '');
  },
};
