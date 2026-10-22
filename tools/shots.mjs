// 生成新玩法面板截图：tool/新面板视觉检查用
import { spawn } from 'child_process';
import fs from 'fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'file:///Users/wangsen/Documents/githubCode/cq/dist/index.html';
const port = 9422;
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
const evalJs = (expression) => send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: BASE + '#autostart=warrior' });
await sleep(1600);

await evalJs(`(() => {
  const C = window.__CM, p = C.game.player;
  p.level = 52; p.gold = 2600000; p.essence = 860;
  p.skillFrags = 60; p.ultBooks = 2;
  C.PLAYER.recalc(p); p.hp = p.stats.hp; p.mp = p.stats.mp;
  C.game.learnUltimate(C.DATA.CLASSES[p.clsId].ultimates[0]);
  C.game.ensureBounty(true);
  p.bounty.tasks[0].prog = p.bounty.tasks[0].need;
  p.bounty.tasks[1].prog = Math.floor(p.bounty.tasks[1].need / 2);
  C.PANELS.show('trial');
})()`);
await sleep(500);

for (const [tab, file] of [['trial', 'screenshot-trial.png'], ['bounty', 'screenshot-bounty.png'], ['forge', 'screenshot-forge.png'], ['skills', 'screenshot-skills.png'], ['character', 'screenshot-character.png']]) {
  await evalJs(`(() => { const C = window.__CM; C.PANELS.tab = '${tab}'; C.PANELS.render(); })()`);
  await sleep(350);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('docs/' + file, Buffer.from(shot.data, 'base64'));
  console.log('saved docs/' + file);
}

// 大地图截图
await evalJs(`(() => { const C = window.__CM; C.PANELS.hide(); C.MAPVIEW.show(C.game); })()`);
await sleep(350);
const mapShot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('docs/screenshot-map.png', Buffer.from(mapShot.data, 'base64'));
console.log('saved docs/screenshot-map.png');

ws.close();
chrome.kill('SIGKILL');
