// 玩法系统冒烟测试：试炼塔 / 悬赏 / 锻造 / 转生 + 面板渲染
import { spawn } from 'child_process';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'file:///Users/wangsen/Documents/githubCode/cq/dist/index.html';
const port = 9421;
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

// 把角色推到满级并给足资源
report.setup = await evalJs(`(() => {
  const C = window.__CM, p = C.game.player;
  p.level = 60; p.exp = 0; p.gold = 5000000; p.essence = 5000;
  C.PLAYER.recalc(p); p.hp = p.stats.hp; p.mp = p.stats.mp;
  C.game.save();
  return { level: p.level, gold: p.gold, essence: p.essence, bounty: p.bounty && p.bounty.tasks.length, error: document.documentElement.getAttribute('data-js-error') };
})()`);

// 悬赏
report.bounty = await evalJs(`(() => {
  const C = window.__CM, p = C.game.player;
  const t = p.bounty.tasks[0];
  const gold0 = p.gold, ess0 = p.essence;
  t.prog = t.need;
  C.game.claimBounty(t.id);
  return {
    tasks: p.bounty.tasks.length,
    kinds: p.bounty.tasks.map(q => q.kind),
    claimed: t.claimed,
    goldGain: p.gold - gold0,
    essenceGain: p.essence - ess0,
    claimable: C.SYSTEMS.bountyClaimable(p),
    error: document.documentElement.getAttribute('data-js-error'),
  };
})()`);

// 试炼塔 1 层
report.trial = await evalJs(`(() => {
  const C = window.__CM, p = C.game.player;
  C.game.enterTrial(1);
  const t = C.game.trial;
  return {
    floor: t.floor,
    need: t.need,
    spawned: C.game.monsters.length,
    allTrial: C.game.monsters.every(m => m.trial),
    bossRef: !!C.game.bossRef,
    mods: t.cfg.mods.map(m => m.name),
    time: t.cfg.time,
    error: document.documentElement.getAttribute('data-js-error'),
  };
})()`);

await sleep(1300);
report.trialTick = await evalJs(`(() => {
  const C = window.__CM, t = C.game.trial;
  return {
    timeLeft: t && Math.round(t.timeLeft),
    monsters: C.game.monsters.length,
    alive: C.game.monsters.filter(m => !m.dead).length,
    state: t && t.state,
    error: document.documentElement.getAttribute('data-js-error'),
  };
})()`);

report.trialClear = await evalJs(`(() => {
  const C = window.__CM, p = C.game.player;
  for (const m of [...C.game.monsters]) C.game.rawDamage(m, 1e9);
  const t = C.game.trial;
  return {
    state: t && t.state,
    killed: t && t.killed,
    towerBest: p.towerBest,
    towerFloor: p.towerFloor,
    bag: p.bag.length,
    error: document.documentElement.getAttribute('data-js-error'),
  };
})()`);

report.trialClearPanel = await evalJs(`(() => {
  const C = window.__CM;
  C.PANELS.tab = 'trial';
  const html = C.PANELS.trialHtml(C.game);
  return { clear: html.includes('已通关'), next: html.includes('立即进入'), error: document.documentElement.getAttribute('data-js-error') };
})()`);

report.trialNext = await evalJs(`(() => {
  const C = window.__CM;
  C.game.updateTrial(10);
  const t = C.game.trial;
  return {
    floor: t && t.floor,
    spawned: C.game.monsters.length,
    state: t && t.state,
    error: document.documentElement.getAttribute('data-js-error'),
  };
})()`);

report.trialLeave = await evalJs(`(() => {
  const C = window.__CM;
  C.game.leaveTrial();
  return { trial: !!C.game.trial, zone: C.game.player.zone, monsters: C.game.monsters.length, error: document.documentElement.getAttribute('data-js-error') };
})()`);

// 锻造：合成
report.fuse = await evalJs(`(() => {
  const C = window.__CM, p = C.game.player;
  p.bag = [];
  const a = C.ITEMS.generate({ level: 40, slot: 'ring1', rarity: 2, clsId: 'warrior' });
  const b = C.ITEMS.generate({ level: 40, slot: 'ring1', rarity: 2, clsId: 'warrior' });
  p.bag.push(a, b);
  const before = { count: p.bag.length, rarity: a.rarity, gold: p.gold };
  C.game.fuseItem(a.uid);
  return {
    before,
    after: { count: p.bag.length, rarity: p.bag[0] && p.bag[0].rarity, slot: p.bag[0] && p.bag[0].slot },
    error: document.documentElement.getAttribute('data-js-error'),
  };
})()`);

// 锻造：定向打造
report.craft = await evalJs(`(() => {
  const C = window.__CM, p = C.game.player;
  p.bag = [];
  const ess0 = p.essence, gold0 = p.gold;
  C.game.craftItem('weapon', 3);
  return {
    bag: p.bag.length,
    rarity: p.bag[0] && p.bag[0].rarity,
    slot: p.bag[0] && p.bag[0].slot,
    essenceSpent: ess0 - p.essence,
    goldSpent: gold0 - p.gold,
    error: document.documentElement.getAttribute('data-js-error'),
  };
})()`);

// 自动喝药
report.autoPotion = await evalJs(`(() => {
  const C = window.__CM, p = C.game.player;
  p.level = 60; C.PLAYER.recalc(p);
  p.hp = Math.round(p.stats.hp * 0.2);
  p.potions.hp = 5;
  C.game.potionCd.hp = 0;
  const before = p.potions.hp, hp0 = p.hp;
  C.game.updateAutoPotion();
  return { before, after: p.potions.hp, hpBefore: Math.round(hp0), hpAfter: Math.round(p.hp), error: document.documentElement.getAttribute('data-js-error') };
})()`);

// 面板渲染
report.panels = await evalJs(`(() => {
  const C = window.__CM;
  const out = {};
  for (const tab of ['trial', 'bounty', 'forge', 'character']) {
    C.PANELS.show(tab);
    const body = document.getElementById('panelBody');
    out[tab] = { len: body.innerHTML.length, tabs: document.querySelectorAll('#panelTabs .tab').length };
  }
  C.PANELS.hide();
  return { ...out, error: document.documentElement.getAttribute('data-js-error') };
})()`);

// 转生
report.rebirth = await evalJs(`(() => {
  const C = window.__CM, p = C.game.player;
  const power0 = C.PLAYER.power(p);
  p.level = 60; p.gold = 5000000;
  C.PLAYER.recalc(p);
  C.game.rebirth();
  return {
    rebirth: p.rebirth,
    level: p.level,
    gold: p.gold,
    zone: p.zone,
    bonusPct: Math.round((p.rebirth) * C.DATA.REBIRTH.bonus * 100),
    powerBefore: power0,
    error: document.documentElement.getAttribute('data-js-error'),
  };
})()`);

// 终极技能：每个职业用 200 碎片合成 2 本书，习得并释放两个终极
report.ultimates = {};
for (const cls of ['warrior', 'mage', 'taoist']) {
  await send('Page.navigate', { url: 'about:blank' });
  await sleep(250);
  await send('Page.navigate', { url: BASE + '#autostart=' + cls });
  await sleep(1500);
  const r = await evalJs(`(() => {
    const C = window.__CM, p = C.game.player;
    p.level = 60;
    C.PLAYER.recalc(p);
    p.hp = p.stats.hp;
    p.mp = p.stats.mp;

    // BOSS 掉落碎片
    C.game.monsters = [];
    C.game.loot = [];
    const bossId = C.DATA.ZONES.find((z) => z.id === 'bichi').boss;
    const boss = C.game.spawnMonster(C.DATA.MONSTERS[bossId], p.x + 150, p.y, { boss: true });
    C.game.rawDamage(boss, 1e9);
    const fragLoot = C.game.loot.filter((l) => l.kind === 'frag').reduce((a, l) => a + l.amount, 0);

    // 200 碎片 → 2 本书 → 习得两个终极
    p.skillFrags = C.DATA.ULTIMATE_FRAG_COST * 2;
    C.game.mergeUltBook();
    C.game.mergeUltBook();
    const books = p.ultBooks;
    const [u1, u2] = C.DATA.CLASSES[p.clsId].ultimates;
    C.game.learnUltimate(u1);
    C.game.learnUltimate(u2);

    // 造怪并逐个释放终极
    C.game.monsters = [];
    const def = C.DATA.MONSTERS.womaGuard;
    for (let i = 0; i < 6; i++) C.game.spawnMonster(def, p.x + 70 + i * 24, p.y, {});
    C.game.target = C.game.monsters[0];
    p.mp = 9999;
    p.stats.mp = 9999;
    const hpBefore = C.game.monsters.reduce((a, m) => a + Math.max(0, m.hp), 0);
    const cast = [];
    for (let i = 0; i < 2; i++) {
      C.game.skillCd = {};
      C.game.useSkill(4 + i);
      const sk = C.DATA.ULTIMATES[C.DATA.CLASSES[p.clsId].ultimates[i]];
      cast.push({ name: sk.name, cd: C.game.skillCd[sk.id] || 0, mp: Math.round(p.mp) });
    }
    return {
      cls: p.clsId,
      fragLoot,
      books,
      learned: p.ultimates.slice(),
      booksLeft: p.ultBooks,
      fragmentLeft: p.skillFrags,
      hpBefore: Math.round(hpBefore),
      cast,
      buffs: p.buffs.map((b) => b.name),
      error: document.documentElement.getAttribute('data-js-error'),
    };
  })()`);
  await sleep(450);
  r.after = await evalJs(`(() => {
    const C = window.__CM;
    return {
      monsterHp: Math.round(C.game.monsters.reduce((a, m) => a + Math.max(0, m.hp), 0)),
      hudSkills: document.querySelectorAll('#skillRow .skill-btn').length,
      ultButtons: document.querySelectorAll('#skillRow .skill-btn.ult').length,
      skillRow: (() => { const r = document.getElementById('skillRow').getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) }; })(),
      viewport: innerWidth,
      error: document.documentElement.getAttribute('data-js-error'),
    };
  })()`);
  report.ultimates[cls] = r;
}

console.log(JSON.stringify(report, null, 2));
ws.close();
chrome.kill('SIGKILL');
