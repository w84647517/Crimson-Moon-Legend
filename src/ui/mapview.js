// 大地图：点击小地图打开，点击任意位置自动寻路
import { DATA } from '../data/gamedata.js';
import { HUD } from './hud.js';

const T = DATA.TILE;

export const MAPVIEW = {
  visible: false,
  game: null,
  el: {},
  ctx: null,

  init() {
    this.el = {
      layer: document.getElementById('mapLayer'),
      canvas: document.getElementById('bigmap'),
      close: document.getElementById('mapClose'),
      title: document.getElementById('mapTitle'),
      sub: document.getElementById('mapSub'),
    };
    if (!this.el.layer || !this.el.canvas) return;
    this.ctx = this.el.canvas.getContext('2d');
    this.el.close.addEventListener('click', () => this.hide());
    this.el.layer.addEventListener('click', (e) => {
      if (e.target === this.el.layer) this.hide();
    });
    this.el.canvas.addEventListener('click', (e) => this.pick(e));
  },

  toggle(game) {
    if (this.visible) this.hide();
    else this.show(game);
  },

  show(game) {
    if (!game || !game.player || game.player.dead) return;
    this.game = game;
    this.visible = true;
    this.el.layer.classList.remove('hidden');
    this.el.title.textContent = game.map.zone.name;
    this.el.sub.textContent = `${game.map.zone.sub} · 点击任意位置自动寻路`;
    this.render();
  },

  hide() {
    this.visible = false;
    if (this.el.layer) this.el.layer.classList.add('hidden');
  },

  render() {
    if (!this.visible || !this.game) return;
    const g = this.game;
    const map = g.map;
    const p = g.player;
    const c = this.el.canvas;
    const ctx = this.ctx;
    const S = c.width;
    const sc = S / (map.w * T);
    const toMap = (x, y) => ({ x: x * sc, y: y * sc });

    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#090706';
    ctx.fillRect(0, 0, S, S);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(map.mini, 0, 0, S, S);

    // 网格
    ctx.strokeStyle = 'rgba(217,172,92,0.06)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      const q = (S * i) / 8;
      ctx.beginPath();
      ctx.moveTo(q, 0);
      ctx.lineTo(q, S);
      ctx.moveTo(0, q);
      ctx.lineTo(S, q);
      ctx.stroke();
    }

    // 掉落
    for (const l of g.loot) {
      const q = toMap(l.x, l.y);
      ctx.fillStyle = l.kind === 'item' ? 'rgba(255,200,90,0.95)' : l.kind === 'frag' ? 'rgba(201,166,255,0.95)' : 'rgba(255,230,150,0.5)';
      ctx.fillRect(q.x - 1.5, q.y - 1.5, 3, 3);
    }

    // 怪物
    for (const m of g.monsters) {
      if (m.dead) continue;
      const q = toMap(m.x, m.y);
      ctx.fillStyle = m.remote ? '#6fd2ff' : m.boss ? '#ff4b3a' : m.elite ? '#7fc8ff' : 'rgba(226,130,96,0.85)';
      ctx.beginPath();
      ctx.arc(q.x, q.y, m.boss ? 5 : m.elite ? 3 : 2, 0, Math.PI * 2);
      ctx.fill();
      if (m.boss) {
        ctx.strokeStyle = 'rgba(255,90,70,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 9, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 当前寻路路径
    if (p.movePath && p.movePath.length) {
      ctx.strokeStyle = 'rgba(255,214,143,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const start = toMap(p.x, p.y);
      ctx.moveTo(start.x, start.y);
      for (const wp of p.movePath) {
        const q = toMap(wp.x, wp.y);
        ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
      const dst = toMap(p.movePath[p.movePath.length - 1].x, p.movePath[p.movePath.length - 1].y);
      ctx.strokeStyle = 'rgba(255,214,143,0.9)';
      ctx.beginPath();
      ctx.arc(dst.x, dst.y, 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 玩家
    const pc = toMap(p.x, p.y);
    const pulse = 9 + Math.sin(performance.now() / 260) * 2;
    ctx.strokeStyle = 'rgba(255,230,168,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pc.x, pc.y, pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffe6a8';
    ctx.beginPath();
    ctx.arc(pc.x, pc.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 边框
    ctx.strokeStyle = 'rgba(217,172,92,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
  },

  pick(e) {
    if (!this.game) return;
    const rect = this.el.canvas.getBoundingClientRect();
    const S = this.el.canvas.width;
    const px = ((e.clientX - rect.left) / rect.width) * S;
    const py = ((e.clientY - rect.top) / rect.height) * S;
    const map = this.game.map;
    const wx = (px / S) * map.w * T;
    const wy = (py / S) * map.h * T;
    const ok = this.game.moveTo(wx, wy);
    if (ok) HUD.toast('自动寻路中…', 'good');
    this.hide();
  },
};
