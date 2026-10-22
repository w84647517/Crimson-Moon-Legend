import { spawn } from 'child_process';
import fs from 'fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'file:///Users/wangsen/Documents/githubCode/cq/dist/index.html';
const port = 9334;

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
const consoleErrors = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception && msg.params.exceptionDetails.exception.description || ''));
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
await sleep(2500);

const report = {};
report.initial = await evalJs(`(() => { const C = window.__CM; return { level: C.game.player.level, zone: C.game.player.zone, weapon: C.game.player.equip.weapon.name, power: C.PLAYER.power(C.game.player), error: document.documentElement.getAttribute('data-js-error') }; })()`);

report.items = await evalJs(`(() => {
  const C = window.__CM, p = C.game.player;
  p.level = 10;
  p.gold = 99999;
  C.PLAYER.recalc(p);
  p.hp = p.stats.hp;
  p.mp = p.stats.mp;
  const w = C.ITEMS.generate({ level: 9, slot: 'weapon', rarity: 5, clsKind: 'melee', clsId: 'warrior', setChance: 1 });
  const a = C.ITEMS.generate({ level: 9, slot: 'armor', rarity: 4, clsKind: 'melee', clsId: 'warrior', setChance: 0 });
  C.PLAYER.addItem(p, w); C.PLAYER.addItem(p, a);
  C.PANELS.show('bag');
  return { weapon: { uid: w.uid, name: w.name, req: w.req, affixes: w.affixes.length, unique: w.uniqueId, set: w.setId, power: C.ITEMS.power(w) }, armor: { uid: a.uid, name: a.name }, bag: p.bag.length, gold: p.gold, level: p.level };
})()`);
await sleep(400);

const weaponUid = report.items.weapon.uid;
await evalJs(`document.querySelector('[data-uid="${weaponUid}"]').click()`);
await sleep(400);
report.detail = await evalJs(`(() => { const el = document.querySelector('.detail-card'); return { shown: !!el, specialLines: el ? el.querySelectorAll('.dline.special').length : 0, unique: !!document.querySelector('.unique-box'), setBox: !!document.querySelector('.set-box'), buttons: Array.from(document.querySelectorAll('.detail-actions [data-act]')).map(b => b.dataset.act + ':' + b.disabled) }; })()`);

await evalJs(`document.querySelector('.detail-actions [data-act="equip"]').click()`);
await sleep(350);
report.equipped = await evalJs(`(() => { const C = window.__CM, p = C.game.player; return { uid: p.equip.weapon.uid, name: p.equip.weapon.name, power: C.PLAYER.power(p), gold: p.gold, detailOpen: !!document.querySelector('.detail-card') }; })()`);

report.beforeUpgrade = await evalJs(`(() => { const C = window.__CM; const it = C.PLAYER.findItem(C.game.player, '${weaponUid}').item; return { upgrade: it.upgrade, gold: C.game.player.gold, affixSig: JSON.stringify(it.affixes), equipped: C.game.player.equip.weapon.uid === '${weaponUid}' }; })()`);
await evalJs(`document.querySelector('.detail-actions [data-act="upgrade"]').click()`);
await sleep(350);
report.afterUpgrade = await evalJs(`(() => { const C = window.__CM; const it = C.PLAYER.findItem(C.game.player, '${weaponUid}').item; return { upgrade: it.upgrade, gold: C.game.player.gold, weaponPower: C.ITEMS.power(it), equipped: C.game.player.equip.weapon.uid === '${weaponUid}' }; })()`);

await evalJs(`document.querySelector('.detail-actions [data-act="reroll"]').click()`);
await sleep(350);
report.afterReroll = await evalJs(`(() => { const C = window.__CM; const it = C.PLAYER.findItem(C.game.player, '${weaponUid}').item; return { affixSig: JSON.stringify(it.affixes), gold: C.game.player.gold }; })()`);

await evalJs(`document.querySelector('[data-act="close-detail"]').click()`);
await sleep(200);
await evalJs(`window.__CM.PANELS.hide()`);
await sleep(300);

report.skill = await evalJs(`(() => { const C = window.__CM, p = C.game.player; const mp = p.mp; C.game.useSkill(0); return { mpBefore: Math.round(mp), mpAfter: Math.round(p.mp), cd: C.game.skillCd.thrust, effects: C.game.effects.length }; })()`);
await sleep(200);

report.potion = await evalJs(`(() => { const C = window.__CM, p = C.game.player; p.hp = p.stats.hp * 0.4; const before = p.potions.hp; C.game.usePotion('hp'); return { before, after: p.potions.hp, hpPct: Math.round(p.hp / p.stats.hp * 100), cd: C.game.potionCd.hp }; })()`);

report.travelLocked = await evalJs(`(() => { const C = window.__CM; C.game.travel('molong'); return { zone: C.game.player.zone, toast: document.querySelector('#toasts .toast') ? document.querySelector('#toasts .toast').textContent : '' }; })()`);

report.saved = await evalJs(`(() => { const C = window.__CM; C.game.save(); const raw = localStorage.getItem('crimson-moon-save-v3'); const obj = JSON.parse(raw); return { level: obj.p.level, weapon: obj.p.equip.weapon.name, upgrade: obj.p.equip.weapon.upgrade, gold: obj.p.gold, bag: obj.p.bag.length }; })()`);

// 刷新并走“继续游戏”
await send('Page.navigate', { url: BASE });
await sleep(1500);
report.resumeVisible = await evalJs(`!!document.getElementById('resumeBtn')`);
await evalJs(`document.getElementById('resumeBtn') && document.getElementById('resumeBtn').click()`);
await sleep(1200);
report.resumed = await evalJs(`(() => { const C = window.__CM; return { name: C.game.player.name, level: C.game.player.level, weapon: C.game.player.equip.weapon.name, upgrade: C.game.player.equip.weapon.upgrade, zone: C.game.player.zone, hud: document.getElementById('charLv').textContent, error: document.documentElement.getAttribute('data-js-error') }; })()`);

report.consoleErrors = consoleErrors;
console.log(JSON.stringify(report, null, 2));

ws.close();
chrome.kill('SIGKILL');
