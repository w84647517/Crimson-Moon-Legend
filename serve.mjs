import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';

const root = path.resolve('dist');
const port = Number(process.env.PORT || 5173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/* ------------------------------ 联机房间 ------------------------------ */
// 极简房间广播：SSE 下行 + POST 上行。没有第三方依赖。
// 每个客户端只保存最近一次状态，用于新加入者补全。
const rooms = new Map();
const MAX_PEERS = 8;
const PEER_TTL = 20000;

function roomOf(name) {
  const key = String(name || 'marfa').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 12) || 'marfa';
  if (!rooms.has(key)) rooms.set(key, new Map());
  return rooms.get(key);
}

function send(res, obj) {
  try {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  } catch (e) {
    /* 连接已断开，交给 close 事件清理 */
  }
}

function broadcast(room, obj, exceptId) {
  const peers = rooms.get(room);
  if (!peers) return;
  for (const [id, rec] of peers) {
    if (id === exceptId) continue;
    send(rec.res, obj);
  }
}

function peerList(room) {
  const peers = rooms.get(room);
  if (!peers) return [];
  return [...peers.values()].map((r) => r.state);
}

function dropPeer(room, id) {
  const peers = rooms.get(room);
  if (!peers) return;
  const rec = peers.get(id);
  if (!rec) return;
  peers.delete(id);
  broadcast(room, { t: 'leave', id });
  if (!peers.size) rooms.delete(room);
  console.log(`[net] ${room} ← ${rec.state.name || id} 离开（${peers.size}）`);
}

function handleStream(req, res, url) {
  const room = String(url.searchParams.get('room') || 'marfa')
    .toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 12) || 'marfa';
  const id = String(url.searchParams.get('id') || '').slice(0, 24);
  if (!id) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }).end('missing id');
    return;
  }
  const peers = roomOf(room);
  if (!peers.has(id) && peers.size >= MAX_PEERS) {
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' }).end('房间已满');
    return;
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  res.flushHeaders && res.flushHeaders();
  req.socket.setTimeout(0);
  req.socket.setNoDelay(true);

  const state = {
    id,
    name: String(url.searchParams.get('name') || '无名').slice(0, 8),
    clsId: String(url.searchParams.get('cls') || 'warrior').slice(0, 12),
    level: Number(url.searchParams.get('lv')) || 1,
    zone: String(url.searchParams.get('zone') || 'bichi').slice(0, 20),
    x: 0,
    y: 0,
    facing: 1,
    dirMode: 'down',
    moving: false,
    attackT: 0,
    hp: 1,
    maxHp: 1,
    dead: false,
    at: Date.now(),
  };
  peers.set(id, { res, state, at: Date.now() });

  send(res, { t: 'welcome', id, room, peers: peerList(room).filter((s) => s.id !== id) });
  broadcast(room, { t: 'join', peer: state }, id);
  console.log(`[net] ${room} → ${state.name} 加入（${peers.size}）`);

  const hb = setInterval(() => {
    try {
      res.write(':hb\n\n');
    } catch (e) {
      clearInterval(hb);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(hb);
    dropPeer(room, id);
  });
  res.on('error', () => {
    clearInterval(hb);
    dropPeer(room, id);
  });
}

function handleSend(req, res, body) {
  let msg;
  try {
    msg = JSON.parse(body || '{}');
  } catch (e) {
    res.writeHead(400, { 'content-type': 'text/plain' }).end('bad json');
    return;
  }
  const room = String(msg.room || 'marfa').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 12) || 'marfa';
  const id = String(msg.id || '').slice(0, 24);
  const peers = rooms.get(room);
  const rec = peers && peers.get(id);
  if (!rec) {
    res.writeHead(409, { 'content-type': 'text/plain' }).end('not in room');
    return;
  }
  rec.at = Date.now();
  if (msg.t === 'state' && msg.peer) {
    rec.state = Object.assign({}, rec.state, msg.peer, { id, at: Date.now() });
    broadcast(room, { t: 'state', peer: rec.state }, id);
  } else if (msg.t === 'hit') {
    broadcast(room, { t: 'hit', id, zone: msg.zone, x: msg.x, y: msg.y, dmg: msg.dmg }, id);
  } else if (msg.t === 'mon') {
    // 房主（每个客户端自己刷的怪）广播怪物快照
    broadcast(room, { t: 'mon', id, zone: msg.zone, list: Array.isArray(msg.list) ? msg.list : [] }, id);
  } else if (msg.t === 'monhit') {
    // 远程玩家对某只怪造成伤害，由怪物主人结算
    broadcast(room, {
      t: 'monhit', from: id, owner: msg.owner, uid: msg.uid, dmg: msg.dmg, zone: msg.zone, element: msg.element,
    }, id);
  }
  res.writeHead(204).end();
}

// 定期清理失联客户端
setInterval(() => {
  const now = Date.now();
  for (const [room, peers] of rooms) {
    for (const [id, rec] of peers) {
      if (now - rec.at > PEER_TTL) dropPeer(room, id);
    }
  }
}, 5000);

/* ------------------------------ HTTP ------------------------------ */
http
  .createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/api/net/stream') {
      handleStream(req, res, url);
      return;
    }
    if (url.pathname === '/api/net/send' && req.method === 'POST') {
      let body = '';
      let tooBig = false;
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 65536) {
          tooBig = true;
          req.destroy();
        }
      });
      req.on('end', () => {
        if (!tooBig) handleSend(req, res, body);
      });
      return;
    }
    if (url.pathname === '/api/net/status') {
      const out = {};
      for (const [room, peers] of rooms) out[room] = peers.size;
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, rooms: out }));
      return;
    }

    const urlPath = decodeURIComponent(url.pathname);
    let file = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
    if (!file.startsWith(root)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('先运行 npm run build');
        return;
      }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  })
  .listen(port, () => {
    console.log(`赤月传说 → http://localhost:${port}`);
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const n of nets[name] || []) {
        if (n.family === 'IPv4' && !n.internal) {
          console.log(`局域网联机 → http://${n.address}:${port}`);
        }
      }
    }
  });
