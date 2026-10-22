// 局域网联机冒烟测试：起本地服务 + 两个无头客户端，验证房间发现、位置同步与远程伤害。
// 用法：node tools/net.mjs
import { spawn } from 'child_process';
import fs from 'fs';
import net from 'net';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.PORT || 5199);
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const errors = [];

function freePort(p) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(p, '127.0.0.1');
  });
}

class Client {
  constructor(tag, cls, profile) {
    this.tag = tag;
    this.cls = cls;
    this.profile = profile;
    this.port = PORT + 1 + tag;
    this.id = 0;
    this.pending = new Map();
  }

  async open() {
    this.proc = spawn(CHROME, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--no-first-run', '--no-default-browser-check',
      `--user-data-dir=${this.profile}`,
      `--remote-debugging-port=${this.port}`, 'about:blank',
    ], { stdio: 'ignore' });

    for (let i = 0; i < 60; i++) {
      try {
        const list = await fetch(`http://127.0.0.1:${this.port}/json/list`).then((r) => r.json());
        const page = list.find((t) => t.type === 'page');
        if (page) {
          this.target = page;
          break;
        }
      } catch (e) { /* retry */ }
      await sleep(200);
    }
    if (!this.target) throw new Error(`${this.tag}: no target`);

    this.ws = new WebSocket(this.target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
    });
    await this.send('Page.navigate', { url: `${BASE}/#autostart=${this.cls}` });
    await sleep(13000);
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) {
      errors.push(`${this.tag}: ${res.exceptionDetails.text}`);
      return null;
    }
    return res.result && res.result.value;
  }

  async shot(path) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path, Buffer.from(r.data, 'base64'));
  }

  close() {
    try { this.ws.close(); } catch (e) { /* ignore */ }
    try { this.proc.kill('SIGKILL'); } catch (e) { /* ignore */ }
  }
}

if (!(await freePort(PORT))) {
  console.error(`端口 ${PORT} 被占用，用 PORT=xxxx node tools/net.mjs 换一个`);
  process.exit(1);
}

const server = spawn(process.execPath, ['serve.mjs'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});

let a;
let b;
try {
  await sleep(900);

  a = new Client(1, 'warrior', '/tmp/cq-net-a');
  b = new Client(2, 'mage', '/tmp/cq-net-b');
  await Promise.all([a.open(), b.open()]);

  const ready = await Promise.all([a.eval('document.documentElement.dataset.ready'), b.eval('document.documentElement.dataset.ready')]);
  console.log('ready:', ready);

  // 两个客户端加入同一房间
  await a.eval(`(() => { const C = window.__CM; C.NET.connect({ room: 'smoke', name: '甲', clsId: C.game.player.clsId, level: C.game.player.level, zone: C.game.player.zone }); return C.NET.status; })()`);
  await sleep(700);
  await b.eval(`(() => { const C = window.__CM; C.NET.connect({ room: 'smoke', name: '乙', clsId: C.game.player.clsId, level: C.game.player.level, zone: C.game.player.zone }); return C.NET.status; })()`);
  await sleep(1600);

  const status = {
    a: await a.eval('window.__CM.NET.status'),
    b: await b.eval('window.__CM.NET.status'),
    aPeers: await a.eval('window.__CM.NET.peers.size'),
    bPeers: await b.eval('window.__CM.NET.peers.size'),
  };
  console.log('status:', status);

  // 两个客户端出生在同一张图的同一复活点：把乙挪到甲身边，验证人物与怪物双向同步
  const aPos = await a.eval(`(() => { const p = window.__CM.game.player; p.auto = false; return { x: Math.round(p.x), y: Math.round(p.y), zone: p.zone }; })()`);
  await b.eval(`(() => { const p = window.__CM.game.player; p.auto = false; p.x = ${aPos.x + 90}; p.y = ${aPos.y + 10}; return [p.x, p.y]; })()`);
  await sleep(3000);

  const remotes = {
    a: await a.eval('window.__CM.game.remotes.map(r => ({ n: r.name, x: Math.round(r.x), y: Math.round(r.y), cls: r.clsId }))'),
    b: await b.eval('window.__CM.game.remotes.map(r => ({ n: r.name, x: Math.round(r.x), y: Math.round(r.y), cls: r.clsId }))'),
  };
  console.log('remotes:', JSON.stringify(remotes));

  // 关键：双方是否能看到对方刷的怪
  const mirrorInfo = (label) => `(() => {
    const C = window.__CM;
    const remote = C.game.monsters.filter((m) => m.remote);
    return {
      label: '${label}',
      selfId: C.NET.id,
      self: C.game.monsters.filter((m) => !m.remote).length,
      mirrors: remote.length,
      mirrorOwners: [...new Set(remote.map((m) => m.ownerId))],
      sample: remote.slice(0, 3).map((m) => ({ k: m.typeId, hp: Math.round(m.hp), x: Math.round(m.x), y: Math.round(m.y) })),
    };
  })()`;
  const mirrors = { a: await a.eval(mirrorInfo('a')), b: await b.eval(mirrorInfo('b')) };
  console.log('mirrors:', JSON.stringify(mirrors));

  // 协战：乙打甲刷的怪，伤害由甲那边结算
  const attack = await b.eval(`(() => {
    const C = window.__CM;
    const mon = C.game.monsters.find((m) => m.remote && !m.dead && m.hp > 60);
    if (!mon) return null;
    const before = mon.hp;
    for (let i = 0; i < 3; i++) C.game.playerHit(mon, 1, {});
    return { owner: mon.ownerId, uid: mon.rawUid, before, afterLocal: Math.round(mon.hp), pending: C.game._pendingMonHit.size };
  })()`);
  await sleep(1200);
  const ownerHp = attack
    ? await a.eval(`(() => {
        const m = window.__CM.game.monsters.find((x) => !x.remote && x.uid === '${attack.uid}');
        return m ? { hp: Math.round(m.hp), maxHp: m.maxHp, dead: !!m.dead } : null;
      })()`)
    : null;
  console.log('assist:', JSON.stringify({ attack, ownerHp }));

  // 死亡同步：甲杀死自己的怪，乙端镜像应自动消失
  const killed = await a.eval(`(() => {
    const C = window.__CM;
    const m = C.game.monsters.find((x) => !x.remote && !x.dead && !x.boss && x.hp > 0);
    if (!m) return null;
    C.game.killMonster(m);
    return { uid: m.uid, type: m.typeId };
  })()`);
  await sleep(2200);
  const mirrorGone = killed
    ? await b.eval(`(() => {
        const C = window.__CM;
        const all = C.game.monsters.filter((m) => m.remote);
        return {
          present: all.some((m) => m.rawUid === '${killed.uid}'),
          deadLeft: all.filter((m) => m.dead).length,
          tracked: C.game.remoteMons.size,
        };
      })()`)
    : null;
  console.log('mirror-death:', JSON.stringify({ killed, mirrorGone }));

  // 队友是否进入画面
  await sleep(600);
  await b.shot('/tmp/cq-net-b.png');
  await a.shot('/tmp/cq-net-a.png');

  const jsError = await b.eval('document.documentElement.dataset.jsError || document.documentElement.dataset.jsError2 || null');
  const jsErrorA = await a.eval('document.documentElement.dataset.jsError || document.documentElement.dataset.jsError2 || null');
  console.log(JSON.stringify({
    status,
    remotes,
    mirrors,
    attack,
    ownerHp,
    jsError,
    jsErrorA,
    errors,
  }, null, 2));
} finally {
  if (a) a.close();
  if (b) b.close();
  server.kill('SIGKILL');
}
