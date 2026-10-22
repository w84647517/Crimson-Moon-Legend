import { spawn } from 'child_process';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'file:///Users/wangsen/Documents/githubCode/cq/dist/index.html';
const port = 9335;
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

const report = { classes: {}, errors };
for (const cls of ['warrior', 'mage', 'taoist']) {
  await send('Page.navigate', { url: 'about:blank' });
  await sleep(300);
  await send('Page.navigate', { url: BASE + '#autostart=' + cls });
  await sleep(1600);
  const cast = await evalJs(`(() => {
    const C = window.__CM, p = C.game.player;
    p.level = 20;
    C.PLAYER.recalc(p);
    p.hp = p.stats.hp; p.mp = p.stats.mp;
    C.game.monsters = [];
    const def = C.DATA.MONSTERS.womaGuard;
    for (let i = 0; i < 3; i++) C.game.spawnMonster(def, p.x + 70 + i * 26, p.y + 6, {});
    C.game.target = C.game.monsters[0];
    const out = [];
    for (let i = 0; i < 4; i++) {
      const before = p.mp;
      C.game.useSkill(i);
      out.push({ i, skill: C.DATA.CLASSES[p.clsId].skills[i], mpBefore: Math.round(before), mpAfter: Math.round(p.mp), cd: C.game.skillCd[C.DATA.CLASSES[p.clsId].skills[i]] || 0 });
    }
    return { cls: p.clsId, level: p.level, maxHp: p.stats.hp, maxMp: p.stats.mp, out, errors: document.documentElement.getAttribute('data-js-error') };
  })()`);
  await sleep(700);
  cast.after = await evalJs(`(() => { const C = window.__CM, p = C.game.player; return { monHp: C.game.monsters.map(m => Math.round(m.hp)), monMax: C.game.monsters.map(m => m.maxHp), mp: Math.round(p.mp), buffs: p.buffs.map(b => b.name), projectiles: C.game.projectiles.length, effects: C.game.effects.length, error: document.documentElement.getAttribute('data-js-error') }; })()`);
  report.classes[cls] = cast;
}

// 传送（当前角色等级 20，可去沃玛森林）
report.travel = await evalJs(`(() => { const C = window.__CM; C.game.travel('woma'); return { zone: C.game.player.zone, name: C.game.map.zone.name, monsters: C.game.monsters.length, boss: !!C.game.bossRef, terrain: !!C.game.terrain, error: document.documentElement.getAttribute('data-js-error') }; })()`);
await sleep(800);

// BOSS 战：把玩家放到 BOSS 身边，跑 4 秒
report.boss = await evalJs(`(() => { const C = window.__CM, p = C.game.player, b = C.game.bossRef; if (!b) return { noBoss: true }; b.provoked = true; b.aggro = true; p.x = b.x + 90; p.y = b.y; p.invuln = 0; C.game.camera.x = p.x; C.game.camera.y = p.y; return { boss: b.def.name, hp: b.hp, dist: Math.round(Math.hypot(b.x - p.x, b.y - p.y)) }; })()`);
await sleep(4200);
report.boss.after = await evalJs(`(() => { const C = window.__CM, p = C.game.player; return { hp: Math.round(p.hp), dead: p.dead, bossHp: C.game.bossRef ? C.game.bossRef.hp : null, effects: C.game.effects.map(e => e.type), monsterCount: C.game.monsters.length, error: document.documentElement.getAttribute('data-js-error') }; })()`);

// 死亡与复活
report.death = await evalJs(`(() => { const C = window.__CM; C.game.player.invuln = 0; C.game.damagePlayer(999999, null); return { dead: C.game.player.dead, deathVisible: !document.getElementById('deathScreen').classList.contains('hidden'), gold: C.game.player.gold }; })()`);
await sleep(300);
report.revive = await evalJs(`(() => { const C = window.__CM; const before = C.game.player.gold; C.game.revive(); return { dead: C.game.player.dead, hp: Math.round(C.game.player.hp), maxHp: C.game.player.stats.hp, goldBefore: before, goldAfter: C.game.player.gold, deathVisible: !document.getElementById('deathScreen').classList.contains('hidden'), error: document.documentElement.getAttribute('data-js-error') }; })()`);

console.log(JSON.stringify(report, null, 2));
ws.close();
chrome.kill('SIGKILL');
