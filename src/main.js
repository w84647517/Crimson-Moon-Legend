import { U } from './core/util.js';
import { DATA } from './data/gamedata.js';
import { AUDIO } from './core/audio.js';
import { INPUT } from './core/input.js';
import { Game } from './game/game.js';
import { PLAYER } from './game/player.js';
import { ITEMS } from './game/items.js';
import { SYSTEMS } from './game/systems.js';
import { WORLD } from './game/world.js';
import { RENDER } from './ui/render.js';
import { HUD } from './ui/hud.js';
import { PANELS } from './ui/panels.js';
import { MAPVIEW } from './ui/mapview.js';
import { ASSETS } from './ui/assets.js';
import { NET } from './net/net.js';

// 便于无头冒烟测试捕获运行时错误
window.addEventListener('error', (e) => {
  const msg = (e && (e.message || e.error)) || 'unknown';
  document.documentElement.setAttribute('data-js-error', String(msg).slice(0, 160));
});
window.addEventListener('unhandledrejection', (e) => {
  const msg = e && e.reason ? String(e.reason) : 'rejection';
  document.documentElement.setAttribute('data-js-error', msg.slice(0, 160));
});

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const game = new Game(canvas);

let selectedCls = 'warrior';
let autoName = U.randomName(selectedCls);
let started = false;

/* ------------------------------ 动作接线 ------------------------------ */
const actions = {
  getGame: () => game,
  equip: (uid) => game.tryEquip(uid),
  unequip: (slot) => game.tryUnequip(slot),
  salvage: (uid) => game.trySalvage(uid),
  upgrade: (uid) => game.tryUpgrade(uid),
  reroll: (uid) => game.tryReroll(uid),
  travel: (zone) => game.travel(zone),
  usePotion: (kind) => game.usePotion(kind),
  useSkill: (i) => game.useSkill(i),
  setAttack: (v) => game.setAttackHeld(v),
  toggleAuto: () => game.toggleAuto(),
  toggleSound: () => game.toggleSound(),
  revive: () => game.revive(),
  openPanel: (tab) => {
    if (game.player && !game.player.dead) PANELS.toggle(tab);
  },
  sortBag: () => game.sortBag(),
  salvageRarity: (r) => game.salvageRarity(r),
  toggleAutoPickup: () => game.toggleAutoPickup(),
  cycleAutoSalvage: () => game.cycleAutoSalvage(),
  toggleAutoPotion: () => game.toggleAutoPotion(),
  enterTrial: (floor) => game.enterTrial(floor),
  leaveTrial: () => game.leaveTrial(),
  claimBounty: (id) => game.claimBounty(id),
  refreshBounty: () => game.refreshBounty(),
  fuseItem: (uid) => game.fuseItem(uid),
  fuseAll: () => game.fuseAll(),
  craftItem: (slot, rarity) => game.craftItem(slot, rarity),
  mergeUltBook: () => game.mergeUltBook(),
  learnUltimate: (id) => game.learnUltimate(id),
  rebirth: () => game.rebirth(),
  onClosed: () => {},
};

HUD.init(actions);
PANELS.init(actions);
MAPVIEW.init();
RENDER.init(canvas);
INPUT.init(canvas);
INPUT.bindJoystick($('joystick'), $('stick'));
INPUT.handlers.onSkill = (i) => game.useSkill(i);
INPUT.handlers.onEscape = () => {
  if (MAPVIEW.visible) MAPVIEW.hide();
  else PANELS.hide();
};
INPUT.handlers.onMap = () => {
  if (game.player && !game.player.dead) MAPVIEW.toggle(game);
};
INPUT.handlers.onJoy = () => {
  if (game.player) game.player.moveTarget = null;
};

$('minimap').addEventListener('click', () => {
  if (game.player && !game.player.dead) MAPVIEW.toggle(game);
});

/* ------------------------------ 局域网联机 ------------------------------ */
const netEl = {
  layer: $('netLayer'),
  room: $('netRoom'),
  btn: $('netBtn'),
  connect: $('netConnect'),
  status: $('netStatus'),
  peers: $('netPeers'),
  close: $('netClose'),
};
const ROOM_KEY = 'crimson-moon-room';
const savedRoom = (() => {
  try { return localStorage.getItem(ROOM_KEY) || ''; } catch (e) { return ''; }
})();
if (savedRoom && netEl.room) netEl.room.value = savedRoom;

function paintNet() {
  if (!netEl.status) return;
  netEl.status.textContent = NET.describe();
  const zone = game.player && game.player.zone;
  const list = NET.peerList();
  const here = list.filter((p) => !zone || p.zone === zone);
  netEl.peers.innerHTML = here.length
    ? here
        .map(
          (p) =>
            `<div class="net-peer"><span class="dotp"></span><span>${U.esc(p.name || '队友')}</span>` +
            `<span class="lv">${DATA.CLASSES[p.clsId] ? DATA.CLASSES[p.clsId].name : '冒险者'} · Lv.${p.level || 1}</span></div>`
        )
        .join('')
    : '<div class="net-empty">同房间还没有其他玩家</div>';
  netEl.btn.classList.toggle('on', NET.isOnline());
  netEl.btn.textContent = NET.isOnline() ? '联机中' : '联机';
  netEl.connect.textContent = NET.status === 'online' || NET.status === 'connecting' ? '断开' : '连接';
}

function connectNet(room) {
  if (!game.player) return;
  const r = String(room || netEl.room.value || 'marfa').trim() || 'marfa';
  try { localStorage.setItem(ROOM_KEY, r); } catch (e) { /* ignore */ }
  netEl.room.value = r;
  NET.connect({
    room: r,
    name: game.player.name,
    clsId: game.player.clsId,
    level: game.player.level,
    zone: game.player.zone,
  });
  paintNet();
}

function toggleNet() {
  if (NET.status === 'online' || NET.status === 'connecting') {
    NET.disconnect();
    paintNet();
  } else {
    connectNet();
  }
}

NET.onStatus = () => paintNet();
NET.onPeers = () => paintNet();
NET.onHit = (msg) => { if (game.player) game.applyRemoteHit(msg); };
NET.onMon = (msg) => { if (game.player) game.applyRemoteMonsters(msg.id, msg.zone, msg.list); };
NET.onMonHit = (msg) => { if (game.player) game.applyRemoteMonHit(msg); };

netEl.btn.addEventListener('click', () => {
  netEl.layer.classList.toggle('hidden');
  paintNet();
});
netEl.close.addEventListener('click', () => netEl.layer.classList.add('hidden'));
netEl.connect.addEventListener('click', toggleNet);
netEl.room.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') connectNet();
});
paintNet();

/* ------------------------------ 启动界面 ------------------------------ */
function buildEmbers() {
  const wrap = $('embers');
  for (let i = 0; i < 22; i++) {
    const e = document.createElement('span');
    e.className = 'ember';
    e.style.left = U.rand(0, 100) + '%';
    e.style.animationDuration = U.rand(6, 14) + 's';
    e.style.animationDelay = U.rand(0, 9) + 's';
    e.style.setProperty('--dx', U.rand(-60, 60) + 'px');
    const s = U.rand(2, 5);
    e.style.width = s + 'px';
    e.style.height = s + 'px';
    wrap.appendChild(e);
  }
}

function classCards() {
  return Object.values(DATA.CLASSES)
    .map((c) => {
      const first = DATA.SKILLS[c.skills[0]];
      return `<button class="class-card ${c.id === selectedCls ? 'selected' : ''}" data-cls="${c.id}">
        <div class="cc-glyph" style="color:${c.color};text-shadow:0 0 18px ${U.rgba(c.color, 0.45)}">${c.glyph}</div>
        <h3>${c.name}</h3>
        <div class="cc-role">${c.role}</div>
        <p class="cc-desc">${c.desc}</p>
        <div class="cc-chips">${c.chips.map((ch) => `<span class="chip">${ch}</span>`).join('')}</div>
        <div class="cc-skill">招牌技能：<b>${first.name}</b> · ${first.desc}</div>
      </button>`;
    })
    .join('');
}

function renderStart() {
  const list = $('classList');
  list.innerHTML = classCards();
  bindClassCards();

  const save = game.readSave();
  $('resumeWrap').innerHTML = save
    ? `<div class="resume-card">
        <span>本地存档：<b>Lv.${save.level} ${DATA.CLASSES[save.clsId] ? DATA.CLASSES[save.clsId].name : ''} · ${(DATA.ZONES.find((z) => z.id === save.zone) || {}).name || '比奇郊野'}</b></span>
        <button id="resumeBtn">继续游戏</button>
      </div>`
    : '';
  if (save) {
    $('resumeBtn').addEventListener('click', () => {
      AUDIO.init();
      if (game.loadGame(save)) {
        started = true;
        AUDIO.setEnabled(!!game.player.sound);
        enterGame();
        HUD.toast('存档已载入', 'good');
      }
    });
  }
}

function bindClassCards() {
  $('classList').querySelectorAll('[data-cls]').forEach((el) => {
    el.addEventListener('click', () => {
      selectedCls = el.dataset.cls;
      const input = $('nameInput');
      if (!input.value || input.value === autoName) {
        autoName = U.randomName(selectedCls);
        input.value = autoName;
      }
      $('classList').innerHTML = classCards();
      bindClassCards();
      AUDIO.play('ui');
    });
  });
}

function enterGame() {
  $('startScreen').classList.add('hidden');
  $('hud').classList.remove('hidden');
  document.documentElement.dataset.ready = '1';
  game.start();
  if (savedRoom && NET.available()) {
    connectNet(savedRoom);
    HUD.toast(`已加入房间 ${NET.room}`, 'good');
  }
}

function startNewGame(clsId, name) {
  AUDIO.init();
  AUDIO.setEnabled(true);
  game.newGame(clsId, name);
  started = true;
  enterGame();
}

function requestStart() {
  const name = ($('nameInput').value || '').trim() || U.randomName(selectedCls);
  const save = game.readSave();
  if (save && started === false) {
    // 已有存档：二次确认覆盖
    const dialog = $('dialogLayer');
    dialog.style.zIndex = '30';
    PANELS.confirm(
      '覆盖存档',
      `本地已有 Lv.${save.level} 的角色存档，开始新角色会覆盖它。确定继续吗？`,
      () => startNewGame(selectedCls, name)
    );
    return;
  }
  startNewGame(selectedCls, name);
}

$('startBtn').addEventListener('click', requestStart);
$('randomName').addEventListener('click', () => {
  autoName = U.randomName(selectedCls);
  $('nameInput').value = autoName;
  AUDIO.init();
  AUDIO.play('ui');
});
$('nameInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') requestStart();
});

/* ------------------------------ 存档保护 ------------------------------ */
window.addEventListener('beforeunload', () => {
  if (game.player && started) game.save();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.player && started) game.save();
});
window.addEventListener('pagehide', () => {
  if (game.player && started) game.save();
  NET.disconnect(true);
});

/* ------------------------------ 初始化 ------------------------------ */
buildEmbers();
renderStart();
$('nameInput').value = autoName;

// 点击任意位置解锁音频
window.addEventListener('pointerdown', () => AUDIO.init(), { once: true });

// 无头/调试：URL 带 #autostart 直接进入游戏
const hash = location.hash || '';
if (hash.includes('autostart')) {
  const m = hash.match(/autostart=(\w+)/);
  const cls = m && DATA.CLASSES[m[1]] ? m[1] : 'warrior';
  selectedCls = cls;
  try {
    startNewGame(cls, '测试勇士');
  } catch (e) {
    document.documentElement.setAttribute('data-js-error', String(e && e.message ? e.message : e).slice(0, 160));
  }
}

// 暴露少量调试信息（不参与游戏逻辑）
window.__CM = { game, PANELS, HUD, RENDER, ITEMS, PLAYER, DATA, ASSETS, NET, SYSTEMS, MAPVIEW, WORLD };
