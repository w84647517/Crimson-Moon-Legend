// 地图 / 自动寻路 / 隔墙判定 / 自动索敌测试
import { spawn } from 'child_process';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'file:///Users/wangsen/Documents/githubCode/cq/dist/index.html';
const port = 9423;
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  `--remote-debugging-port=${port}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch (e) { /* retry */ }
    await sleep(200);
  }
  throw new Error('no target');
}

const target = await getTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(msg.params.exceptionDetails.text);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id;
  pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const evalJs = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) return { exception: res.exceptionDetails.text, detail: res.exceptionDetails.exception && res.exceptionDetails.exception.description };
  return res.result && res.result.value;
};

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: BASE + '#autostart=warrior' });
await sleep(1600);

const report = { errors };

// 1. 小地图点击打开大地图
report.openMap = await evalJs(`(() => {
  document.getElementById('minimap').click();
  const layer = document.getElementById('mapLayer');
  return {
    visible: window.__CM.MAPVIEW.visible,
    shown: !layer.classList.contains('hidden'),
    canvas: !!document.getElementById('bigmap'),
    title: document.getElementById('mapTitle').textContent,
    error: document.documentElement.getAttribute('data-js-error'),
  };
})()`);

// 2. 点击大地图自动寻路
const rect = await evalJs(`(() => { const r = document.getElementById('bigmap').getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; })()`);
const point = await evalJs(`(() => {
  const C = window.__CM, map = C.game.map, T = C.DATA.TILE;
  // 找一个距离玩家较远、可站立的格子
  const p = C.game.player;
  let best = null;
  for (let i = 0; i < 800; i++) {
    const x = 2 + Math.floor(Math.random() * (map.w - 4));
    const y = 2 + Math.floor(Math.random() * (map.h - 4));
    const wx = (x + 0.5) * T, wy = (y + 0.5) * T;
    if (!C.WORLD || !C.WORLD.blocked) break;
    if (C.WORLD.blocked(map, wx, wy, 16)) continue;
    const d = Math.hypot(wx - p.x, wy - p.y);
    if (d < 420) continue;
    // 故意找一条被墙挡住视线的目标，强制寻路绕行
    if (C.WORLD.lineClear(map, p.x, p.y, wx, wy, 12)) continue;
    best = { wx, wy, d };
    break;
  }
  if (!best) return null;
  const S = document.getElementById('bigmap').width;
  return { wx: best.wx, wy: best.wy, fx: best.wx / (map.w * T), fy: best.wy / (map.h * T), S };
})()`);

let mapClick = { skipped: true };
if (point && rect) {
  const cx = rect.left + point.fx * rect.width;
  const cy = rect.top + point.fy * rect.height;
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
  await sleep(250);
  mapClick = await evalJs(`(() => {
    const C = window.__CM, p = C.game.player;
    return {
      closed: !document.getElementById('mapLayer').classList.contains('hidden') ? false : true,
      pathLen: p.movePath ? p.movePath.length : 0,
      goal: p.moveTarget ? { x: Math.round(p.moveTarget.x), y: Math.round(p.moveTarget.y) } : null,
      want: { x: ${Math.round(point.wx)}, y: ${Math.round(point.wy)} },
      error: document.documentElement.getAttribute('data-js-error'),
    };
  })()`);
}
report.mapClick = mapClick;

const startPos = await evalJs(`(() => { const p = window.__CM.game.player; return { x: Math.round(p.x), y: Math.round(p.y) }; })()`);
const initialPath = await evalJs(`(() => { const p = window.__CM.game.player; return p.movePath ? p.movePath.slice(0, 80) : []; })()`);
report.pathClear = await evalJs(`(() => {
  const C = window.__CM;
  const pts = ${JSON.stringify(initialPath)};
  if (!pts.length) return { skipped: true };
  let ok = true, bad = null;
  let from = { x: ${startPos.x}, y: ${startPos.y} };
  for (const wp of pts) {
    if (C.WORLD.blocked(C.game.map, wp.x, wp.y, 12)) { ok = false; bad = { kind: 'blocked', wp }; break; }
    if (!C.WORLD.lineClear(C.game.map, from.x, from.y, wp.x, wp.y, 12)) { ok = false; bad = { kind: 'segment', from, wp }; break; }
    from = wp;
  }
  return { ok, bad, segments: pts.length, error: document.documentElement.getAttribute('data-js-error') };
})()`);
await sleep(900);
report.movement = await evalJs(`(() => {
  const C = window.__CM, p = C.game.player;
  return {
    start: ${JSON.stringify(startPos)},
    x: Math.round(p.x), y: Math.round(p.y),
    moved: Math.round(Math.hypot(p.x - ${startPos.x}, p.y - ${startPos.y})),
    pathLeft: p.movePath ? p.movePath.length : 0,
    error: document.documentElement.getAttribute('data-js-error'),
  };
})()`);

// 4. 自动索敌 = 最近
report.nearestTarget = await evalJs(`(() => {
  const C = window.__CM, g = C.game, p = g.player;
  p.moveTarget = null; p.movePath = null; p.chasePath = null;
  g.monsters = [];
  const def = C.DATA.MONSTERS.orc;
  const far = g.spawnMonster(def, p.x + 360, p.y, {});
  const near = g.spawnMonster(def, p.x + 110, p.y, {});
  g.target = far;
  g.tapChase = 0;
  g._retargetT = 0;
  p.auto = true;
  g.updatePlayer(0.016);
  return {
    pickedNearest: g.target === near,
    targetX: g.target ? Math.round(g.target.x - p.x) : null,
    error: document.documentElement.getAttribute('data-js-error'),
  };
})()`);

// 5. 隔墙不攻击 / 不索敌
report.wall = await evalJs(`(() => {
  const C = window.__CM, g = C.game, p = g.player, map = g.map, T = C.DATA.TILE;
  let spot = null;
  for (let y = 2; y < map.h - 2 && !spot; y++) {
    for (let x = 2; x < map.w - 2; x++) {
      if (!C.WORLD.tileBlocked(map.tiles[y * map.w + x])) continue;
      const l = C.WORLD.tileBlocked(map.tiles[y * map.w + x - 1]);
      const r = C.WORLD.tileBlocked(map.tiles[y * map.w + x + 1]);
      if (!l && !r) { spot = { x, y }; break; }
    }
  }
  if (!spot) return { skipped: true };
  g.monsters = [];
  g.loot = [];
  p.x = (spot.x - 0.5) * T;
  p.y = (spot.y + 0.5) * T;
  p.moveTarget = null; p.movePath = null; p.chasePath = null;
  g.camera.x = p.x; g.camera.y = p.y;
  const def = C.DATA.MONSTERS.orc;
  const mon = g.spawnMonster(def, (spot.x + 1.5) * T, (spot.y + 0.5) * T, {});
  mon.attackCd = 99;
  const hp0 = mon.hp;
  const los = C.WORLD.lineClear(map, p.x, p.y, mon.x, mon.y, 10);
  const foundNoLos = g.nearestMonster(p.x, p.y, 400, true, true);
  const foundLos = g.nearestMonster(p.x, p.y, 400, true, false);
  g.target = mon;
  p.auto = true;
  p.attackCd = 0;
  g.updatePlayer(0.016);
  return {
    spot,
    los,
    losTarget: foundLos ? foundLos.uid === mon.uid : false,
    blockedTarget: foundNoLos ? foundNoLos.uid : null,
    hpBefore: Math.round(hp0),
    hpAfter: Math.round(mon.hp),
    error: document.documentElement.getAttribute('data-js-error'),
  };
})()`);

// 6. 隔墙状态：保持在原地，不穿墙
report.wallState = await evalJs(`(() => {
  const C = window.__CM, p = C.game.player;
  return { x: Math.round(p.x), y: Math.round(p.y), pathLeft: p.movePath ? p.movePath.length : 0, error: document.documentElement.getAttribute('data-js-error') };
})()`);

console.log(JSON.stringify(report, null, 2));
ws.close();
chrome.kill('SIGKILL');
