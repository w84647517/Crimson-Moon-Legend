// 局域网联机（SSE 下行 + fetch 上行，无第三方依赖）
// 由 serve.mjs 提供 /api/net/*；file:// 或纯静态托管时自动降级为单机。
const SEND_INTERVAL = 0.08; // 秒
const PEER_TIMEOUT = 9000;

export const NET = {
  status: 'offline', // offline | connecting | online | unavailable
  room: '',
  id: '',
  peers: new Map(),
  onStatus: null,
  onPeers: null,
  onHit: null,
  onMon: null, // 队友的怪物快照
  onMonHit: null, // 队友打在我的怪身上

  _es: null,
  _timer: 0,
  _errors: 0,
  _want: false,

  available() {
    return location.protocol === 'http:' || location.protocol === 'https:';
  },

  isOnline() {
    return this.status === 'online';
  },

  connect({ room, name, clsId, level, zone }) {
    this.disconnect(true);
    if (!this.available()) {
      this.status = 'unavailable';
      this._notifyStatus('当前以 file:// 打开，无法联机。请运行 npm run serve 后用局域网地址访问。');
      return;
    }
    this._want = true;
    this.room = String(room || 'marfa').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 12) || 'marfa';
    this.id = this.id || this._newId();
    this.peers.clear();
    this._errors = 0;
    this.status = 'connecting';
    this._notifyStatus('正在连接…');
    this._open({ name, clsId, level, zone });
  },

  disconnect(silent = false) {
    this._want = false;
    if (this._es) {
      try { this._es.close(); } catch (e) { /* ignore */ }
      this._es = null;
    }
    this.peers.clear();
    if (!silent) {
      this.status = 'offline';
      this._notifyStatus('已断开联机');
      this._notifyPeers();
    }
  },

  _newId() {
    return Math.random().toString(36).slice(2, 10);
  },

  _notifyStatus(text) {
    if (this.onStatus) this.onStatus(this.status, text);
  },

  _notifyPeers() {
    if (this.onPeers) this.onPeers(this.peers);
  },

  _open(ctx) {
    const qs = new URLSearchParams({
      room: this.room,
      id: this.id,
      name: ctx.name || '无名',
      cls: ctx.clsId || 'warrior',
      lv: String(ctx.level || 1),
      zone: ctx.zone || 'bichi',
    });
    const es = new EventSource(`/api/net/stream?${qs.toString()}`);
    this._es = es;

    es.onopen = () => {
      this._errors = 0;
      this.status = 'online';
      this._notifyStatus(`已连接 · 房间 ${this.room}`);
    };

    es.onmessage = (ev) => {
      let msg = null;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (!msg || !msg.t) return;
      if (msg.t === 'welcome') {
        this.peers.clear();
        for (const p of msg.peers || []) this._upsert(p);
        this._notifyPeers();
      } else if (msg.t === 'join') {
        this._upsert(msg.peer);
        this._notifyPeers();
      } else if (msg.t === 'state') {
        this._upsert(msg.peer);
        this._notifyPeers();
      } else if (msg.t === 'leave') {
        this.peers.delete(msg.id);
        this._notifyPeers();
      } else if (msg.t === 'hit') {
        if (this.onHit) this.onHit(msg);
      } else if (msg.t === 'mon') {
        if (this.onMon) this.onMon(msg);
      } else if (msg.t === 'monhit') {
        if (this.onMonHit) this.onMonHit(msg);
      }
    };

    es.onerror = () => {
      if (!this._want) return;
      this._errors += 1;
      if (es.readyState === EventSource.CLOSED) {
        // 服务端明确关闭（房间已满 / 接口不存在），不要无限重试
        this.status = 'unavailable';
        this._notifyStatus('联机服务不可用：请运行 npm run serve 后重试');
        this._es = null;
        return;
      }
      this.status = 'connecting';
      this._notifyStatus('连接中断，正在重连…');
      if (this._errors >= 8) {
        this.status = 'unavailable';
        this._notifyStatus('联机服务不可用：请运行 npm run serve 后重试');
        try { es.close(); } catch (e) { /* ignore */ }
        this._es = null;
      }
    };
  },

  _upsert(peer) {
    if (!peer || !peer.id || peer.id === this.id) return;
    const prev = this.peers.get(peer.id);
    this.peers.set(peer.id, {
      ...(prev || {}),
      ...peer,
      animTime: prev ? prev.animTime : Math.random() * 10,
      lastAt: performance.now(),
    });
  },

  // 每帧调用：推进远端动画、清理超时玩家、按节奏上报自己的状态
  update(dt, game) {
    const p = game && game.player;
    if (!p) return;
    const now = performance.now();
    for (const [id, peer] of this.peers) {
      if (now - (peer.lastAt || 0) > PEER_TIMEOUT) {
        this.peers.delete(id);
        this._notifyPeers();
        continue;
      }
      if (peer.moving) peer.animTime += dt;
      peer.attackT = Math.max(0, (peer.attackT || 0) - dt);
    }
    if (this.status !== 'online') return;
    this._timer += dt;
    if (this._timer < SEND_INTERVAL) return;
    this._timer = 0;
    this._post({
      t: 'state',
      peer: {
        name: p.name,
        clsId: p.clsId,
        level: p.level,
        zone: p.zone,
        x: Math.round(p.x),
        y: Math.round(p.y),
        facing: p.facing >= 0 ? 1 : -1,
        dirMode: p.dirMode || 'down',
        moving: !!p.moving,
        attackT: p.attackT > 0 ? Math.min(0.2, p.attackT) : 0,
        hp: Math.max(0, Math.round(p.hp)),
        maxHp: Math.max(1, Math.round(p.stats.hp)),
        weapon: p.equip && p.equip.weapon ? p.equip.weapon.baseId : null,
        dead: !!p.dead,
      },
    });
  },

  sendHit(msg) {
    if (this.status !== 'online') return;
    this._post({ t: 'hit', zone: msg.zone, x: Math.round(msg.x), y: Math.round(msg.y), dmg: Math.round(msg.dmg || 0) });
  },

  // 把自己刷的怪物快照广播给同房间队友（字段已压缩）
  sendMonsters(zone, list) {
    if (this.status !== 'online') return;
    if (!Array.isArray(list) || list.length === 0) return;
    this._post({ t: 'mon', zone, list });
  },

  // 打别人家的怪：把伤害交给怪物主人结算
  sendMonHit(msg) {
    if (this.status !== 'online') return;
    if (!msg || !msg.owner || !msg.uid) return;
    this._post({
      t: 'monhit',
      owner: msg.owner,
      uid: msg.uid,
      zone: msg.zone,
      dmg: Math.max(1, Math.round(msg.dmg || 0)),
      element: msg.element || 'phys',
    });
  },

  _post(body) {
    const payload = JSON.stringify({ room: this.room, id: this.id, ...body });
    try {
      fetch('/api/net/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    } catch (e) {
      /* ignore */
    }
  },

  peerList() {
    return [...this.peers.values()];
  },

  describe() {
    if (this.status === 'online') return `房间 ${this.room} · ${this.peers.size + 1} 人在线`;
    if (this.status === 'connecting') return '连接中…';
    if (this.status === 'unavailable') return '联机不可用';
    return '未连接';
  },
};
