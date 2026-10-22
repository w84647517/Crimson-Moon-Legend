import { spawn } from 'child_process';
import fs from 'fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url = process.argv[2] || 'file:///Users/wangsen/Documents/githubCode/cq/dist/index.html#autostart=warrior';
const prefix = process.argv[3] || '/tmp/cq-shot';
const port = 9333;

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  `--remote-debugging-port=${port}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 50; i++) {
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
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id;
  pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
});
await send('Page.navigate', { url });
await sleep(15000);

const evalJs = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) return { exception: res.exceptionDetails.text };
  return res.result && res.result.value;
};

const metrics = await evalJs(`(() => {
  const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return {x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height)}; };
  return {
    inner: [innerWidth, innerHeight],
    doc: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
    dpr: devicePixelRatio,
    charCard: r('.char-card'),
    topRight: r('.top-right'),
    minimap: r('.minimap-wrap'),
    hudBottom: r('.hud-bottom'),
    joystick: r('#joystick'),
    potions: r('.bottom-center'),
    cluster: r('.action-cluster'),
    skillRow: r('.skill-row'),
    attack: r('#attackBtn'),
    rail: r('.side-rail'),
    boss: r('.boss-bar'),
    error: document.documentElement.getAttribute('data-js-error'),
    ready: document.documentElement.getAttribute('data-ready'),
    lv: document.querySelector('#charLv')?.textContent,
    hp: document.querySelector('#hpText')?.textContent,
    player: window.__CM && window.__CM.game.player ? {x: Math.round(window.__CM.game.player.x), y: Math.round(window.__CM.game.player.y), hp: Math.round(window.__CM.game.player.hp), monsters: window.__CM.game.monsters.length, zone: window.__CM.game.player.zone, gold: window.__CM.game.player.gold} : null,
    extra: window.__CM && window.__CM.game.player ? {level: window.__CM.game.player.level, exp: Math.round(window.__CM.game.player.exp), need: window.__CM.DATA.expNeed(window.__CM.game.player.level), kills: window.__CM.game.player.kills, bag: window.__CM.game.player.bag.length, mp: Math.round(window.__CM.game.player.mp), pity: window.__CM.game.pity || 0, effects: window.__CM.game.effects.length} : null,
    save: !!localStorage.getItem('crimson-moon-save-v3'),
  };
})()`);
console.log(JSON.stringify(metrics, null, 2));

let shotRes = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(prefix + '-game.png', Buffer.from(shotRes.data, 'base64'));

// 打开角色面板
await evalJs(`window.__CM.PANELS.show('character')`);
await sleep(600);
shotRes = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(prefix + '-character.png', Buffer.from(shotRes.data, 'base64'));

// 打开背包并点第一件物品
await evalJs(`(() => {
  const C = window.__CM;
  const p = C.game.player;
  for (let i = 0; i < 6; i++) {
    const it = C.ITEMS.generate({ level: 22 + i * 4, rarity: i, clsKind: 'melee', clsId: 'warrior', setChance: 0.85 });
    C.PLAYER.addItem(p, it);
  }
  C.PANELS.show('bag');
  return p.bag.length;
})()`);
await sleep(400);
await evalJs(`(() => { const cells = document.querySelectorAll('#panelBody [data-uid]'); if (cells.length) cells[cells.length - 1].click(); return cells.length; })()`);
await sleep(600);
shotRes = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(prefix + '-item.png', Buffer.from(shotRes.data, 'base64'));

ws.close();
chrome.kill('SIGKILL');
