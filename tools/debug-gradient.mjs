import { spawn } from 'child_process';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'file:///Users/wangsen/Documents/githubCode/cq/dist/index.html#autostart=warrior';
const port = 9336;
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
const exceptions = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    exceptions.push({
      text: d.text,
      desc: d.exception && d.exception.description,
      stack: d.stackTrace && d.stackTrace.callFrames ? d.stackTrace.callFrames.slice(0, 6).map((f) => `${f.functionName}@${f.url}:${f.lineNumber}:${f.columnNumber}`) : null,
    });
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
await send('Page.navigate', { url: BASE });
await sleep(1800);

await evalJs(`(() => {
  window.__grad = [];
  const proto = CanvasRenderingContext2D.prototype;
  const orig = proto.createRadialGradient;
  proto.createRadialGradient = function (x0, y0, r0, x1, y1, r1) {
    if (![x0, y0, r0, x1, y1, r1].every(Number.isFinite)) {
      window.__grad.push({ x0, y0, r0, x1, y1, r1, stack: new Error().stack });
    }
    return orig.apply(this, arguments);
  };
  return true;
})()`);

const state = await evalJs(`(() => { const C = window.__CM, p = C.game.player; p.level = 20; C.PLAYER.recalc(p); C.game.travel('woma'); return { zone: C.game.player.zone, boss: C.game.map.boss, lights: C.game.map.lights.slice(0, 3), props: C.game.map.props.length, player: { x: p.x, y: p.y } }; })()`);
await sleep(1200);
const after = await evalJs(`(() => ({ grad: window.__grad, error: document.documentElement.getAttribute('data-js-error'), time: window.__CM.game.time, paused: window.__CM.game.paused, running: window.__CM.game.running, effects: window.__CM.game.effects.length, monsters: window.__CM.game.monsters.length }))()`);

console.log(JSON.stringify({ state, after, exceptions }, null, 2));
ws.close();
chrome.kill('SIGKILL');
