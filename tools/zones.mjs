import { spawn } from 'child_process';
import fs from 'fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_PATH = 'file:///Users/wangsen/Documents/githubCode/cq/dist/index.html';
const BASE = BASE_PATH + '#autostart=warrior';
const port = 9337;
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
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
    errors.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception && msg.params.exceptionDetails.exception.description || ''));
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

const zones = ['bichi', 'woma', 'zuma', 'chiyue', 'molong'];
const report = {};
for (const zid of zones) {
  await send('Page.navigate', { url: 'about:blank' });
  await sleep(250);
  await send('Page.navigate', { url: BASE_PATH + '?z=' + zid + '#autostart=warrior' });
  await sleep(1500);
  const state = await evalJs(`(() => {
    const C = window.__CM, p = C.game.player;
    p.level = 50; C.PLAYER.recalc(p); p.hp = p.stats.hp; p.mp = p.stats.mp;
    if ('${zid}' !== 'bichi') C.game.travel('${zid}');
    return { zone: p.zone, name: C.game.map.zone.name, size: C.game.map.w, monsters: C.game.monsters.length, boss: C.game.map.boss, props: C.game.map.props.length, player: { x: Math.round(p.x), y: Math.round(p.y) } };
  })()`);
  await sleep(1300);
  const after = await evalJs(`(() => { const C = window.__CM; return { error: document.documentElement.getAttribute('data-js-error'), time: Math.round(C.game.time * 10) / 10, monsters: C.game.monsters.length, effects: C.game.effects.length, paused: C.game.paused }; })()`);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`/tmp/cq-zone-${zid}.png`, Buffer.from(shot.data, 'base64'));
  report[zid] = { ...state, after };
}

// 窄屏布局检查
await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 720, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: 'about:blank' });
await sleep(250);
await send('Page.navigate', { url: BASE_PATH + '?w=320#autostart=warrior' });
await sleep(1200);
report.narrow = await evalJs(`(() => {
  const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), right: Math.round(b.right) }; };
  return { inner: [innerWidth, innerHeight], scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight], joystick: r('#joystick'), potions: r('.bottom-center'), cluster: r('.action-cluster'), attack: r('#attackBtn'), card: r('.char-card'), topRight: r('.top-right'), error: document.documentElement.getAttribute('data-js-error') };
})()`);
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('/tmp/cq-zone-narrow.png', Buffer.from(shot.data, 'base64'));
report.errors = errors;
console.log(JSON.stringify(report, null, 2));
ws.close();
chrome.kill('SIGKILL');
