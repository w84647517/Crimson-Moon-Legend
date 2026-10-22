import { U } from '../core/util.js';
import { DATA } from '../data/gamedata.js';
import { AUDIO } from '../core/audio.js';
import { INPUT } from '../core/input.js';
import { ITEMS } from './items.js';
import { PLAYER } from './player.js';
import { WORLD } from './world.js';
import { SYSTEMS } from './systems.js';
import { RENDER } from '../ui/render.js';
import { HUD } from '../ui/hud.js';
import { PANELS } from '../ui/panels.js';
import { MAPVIEW } from '../ui/mapview.js';
import { NET } from '../net/net.js';

const T = DATA.TILE;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.player = null;
    this.map = null;
    this.terrain = null;
    this.monsters = [];
    this.remotes = [];
    this.remoteMons = new Map(); // 队友刷的怪（镜像），key = owner:uid
    this._monTomb = new Map(); // 已确认死亡的镜像 key，防止死亡快照重复重建
    this._monSyncT = 0;
    this._monHitT = 0;
    this._pendingMonHit = new Map();
    this.projectiles = [];
    this.loot = [];
    this.particles = [];
    this.texts = [];
    this.effects = [];
    this.camera = { x: 0, y: 0 };
    this.time = 0;
    this.zoneTime = 0;
    this.shake = 0;
    this.hitVignette = 0;
    this.target = null;
    this.activeBoss = null;
    this.skillCd = {};
    this.potionCd = { hp: 0, mp: 0 };
    this.attackHeld = false;
    this.spawnTimer = 1;
    this.bossRespawn = 0;
    this.trial = null;
    this._trialBanner = 0;
    this.bossRef = null;
    this.saveTimer = 0;
    this.regenTimer = 0;
    this.running = false;
    this.paused = false;
    this._lastHitSfx = 0;
    this._bagFullMsg = 0;
    this._manualUntil = 0;
    this.tapChase = 0;
    this._retargetT = 0;
    this._loopBound = this.loop.bind(this);
  }

  /* ------------------------------ 启动 ------------------------------ */
  hasSave() {
    try {
      return !!localStorage.getItem(DATA.SAVE_KEY);
    } catch (e) {
      return false;
    }
  }

  readSave() {
    try {
      const raw = localStorage.getItem(DATA.SAVE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || !obj.p) return null;
      return obj.p;
    } catch (e) {
      return null;
    }
  }

  newGame(clsId, name) {
    this.player = PLAYER.create(clsId, name);
    this.ensureBounty(true);
    this.enterZone(this.player.zone, true);
    HUD.resetCache();
    HUD.toast(`欢迎来到玛法大陆，${this.player.name}`, 'good');
    this.save();
  }

  loadGame(data) {
    const p = PLAYER.deserialize(data);
    if (!p) return false;
    this.player = p;
    this.ensureBounty(true);
    this.enterZone(p.zone, true);
    HUD.resetCache();
    HUD.toast(`欢迎回来，${p.name}`, 'good');
    return true;
  }

  start() {
    if (!this.running) {
      this.running = true;
      this.last = performance.now();
      requestAnimationFrame(this._loopBound);
    }
  }

  stop() {
    this.running = false;
  }

  loop(ts) {
    if (!this.running) return;
    const dt = Math.min(0.05, Math.max(0, (ts - this.last) / 1000));
    this.last = ts;
    this.paused = !!PANELS.visible || !!MAPVIEW.visible;
    if (!this.paused && this.player) this.update(dt);
    if (this.player) {
      RENDER.draw(this, dt);
      HUD.update(this);
    }
    requestAnimationFrame(this._loopBound);
  }

  /* ------------------------------ 地图 ------------------------------ */
  enterZone(zoneId, initial = false) {
    const p = this.player;
    this.trial = null;
    p.zone = zoneId;
    const map = WORLD.generate(zoneId);
    this.map = map;
    this.terrain = WORLD.buildTerrain(map);
    this.monsters = [];
    this.remoteMons.clear();
    this._monTomb.clear();
    this._pendingMonHit.clear();
    this.projectiles = [];
    this.loot = [];
    this.particles = [];
    this.texts = [];
    this.effects = [];
    this.target = null;
    this.activeBoss = null;
    this.bossRef = null;
    this.bossRespawn = 0;
    this.zoneTime = 0;
    this.spawnTimer = 1;

    p.x = map.spawn.x;
    p.y = map.spawn.y + 12;
    p.facing = 1;
    p.moving = false;
    p.dirMode = 'down';
    p.moveX = 0;
    p.moveY = 0;
    p.moveTarget = null;
    p.movePath = null;
    p.chasePath = null;
    p.dead = false;
    p.invuln = initial ? 2.5 : 1.5;
    p.hp = Math.max(p.hp, p.stats.hp * 0.35);
    this.camera.x = p.x;
    this.camera.y = p.y;

    // 出生点营地火光
    const camp = [
      { x: p.x - 82, y: p.y + 30, phase: 1.3 },
      { x: p.x + 82, y: p.y + 30, phase: 4.1 },
    ];
    for (const c of camp) {
      this.map.props.push({ type: 'brazier', x: c.x, y: c.y, scale: 1.05, phase: c.phase, flip: 1 });
      this.map.lights.push({ x: c.x, y: c.y - 8, r: 138, color: 'rgba(255,150,60,0.16)', phase: c.phase, type: 'brazier' });
    }

    for (let i = 0; i < (map.zone.spawn || 16); i++) {
      const pos = i < 8
        ? this.spawnPointNear(p.x, p.y, 150, 400)
        : WORLD.randomFloor(map, Math.random, { x: p.x, y: p.y }, 320);
      const def = this.pickMonster(map.zone);
      this.spawnMonster(def, pos.x, pos.y, { elite: Math.random() < 0.1 });
    }
    this.spawnBoss();
    this.effects.push({ type: 'teleport', x: p.x, y: p.y, t: 0, dur: 0.8 });
    if (!initial) {
      HUD.toast(`传送至 ${map.zone.name}`, 'good');
      AUDIO.play('teleport');
    }
    HUD.el.zoneName.textContent = map.zone.name;
    HUD.el.zoneLv.textContent = 'Lv.' + map.zone.lvl;
  }

  spawnPointNear(px, py, minD, maxD) {
    for (let i = 0; i < 36; i++) {
      const ang = Math.random() * U.TAU;
      const d = U.rand(minD, maxD);
      const x = px + Math.cos(ang) * d;
      const y = py + Math.sin(ang) * d;
      if (x < 60 || y < 60 || x > this.map.w * T - 60 || y > this.map.h * T - 60) continue;
      if (!WORLD.blocked(this.map, x, y, 18)) return { x, y };
    }
    return WORLD.randomFloor(this.map, Math.random, { x: px, y: py }, minD);
  }

  pickMonster(zone) {
    const pool = zone.monsters;
    let total = 0;
    for (const m of pool) total += m.w;
    let r = Math.random() * total;
    for (const m of pool) {
      r -= m.w;
      if (r <= 0) return DATA.MONSTERS[m.id];
    }
    return DATA.MONSTERS[pool[0].id];
  }

  spawnBoss() {
    if (this.trial || this._enterTrial) return;
    if (!this.map.boss) return;
    const def = DATA.MONSTERS[this.map.zone.boss];
    if (!def) return;
    const mon = this.spawnMonster(def, this.map.boss.x, this.map.boss.y, { boss: true });
    this.bossRef = mon;
    HUD.toast(`${def.name} 正在等待挑战者`, 'epic');
  }

  spawnMonster(def, x, y, opts = {}) {
    const zone = this.map.zone;
    const boss = !!opts.boss || !!def.boss;
    const elite = !boss && !!opts.elite;
    const lvl = opts.level
      ? U.clamp(Math.round(opts.level) + (elite ? 1 : 0), 1, 60)
      : boss
        ? def.lvl
        : U.clamp(zone.lvl + U.randInt(-2, 2), 1, 60);
    const diff = lvl - def.lvl;
    const hpScale = boss ? 1 : Math.pow(1.13, diff) * (elite ? 1.75 : 1);
    const atkScale = boss ? 1 : Math.pow(1.1, diff) * (elite ? 1.3 : 1);
    const hp = Math.round(def.hp * hpScale * (boss ? 1 : 1));
    const mon = {
      uid: U.uid(),
      typeId: Object.keys(DATA.MONSTERS).find((k) => DATA.MONSTERS[k] === def) || def.name,
      def,
      lvl,
      boss,
      elite,
      hp,
      maxHp: hp,
      atk: Math.round(def.atk * atkScale),
      armor: Math.round(def.def * (boss ? 1 : Math.max(0.3, atkScale))),
      exp: Math.round(def.exp * (1 + diff * 0.12) * (elite ? 1.6 : 1)),
      gold: Math.round(def.gold * (1 + diff * 0.1) * (elite ? 1.6 : 1)),
      x, y,
      homeX: x,
      homeY: y,
      facing: Math.random() < 0.5 ? -1 : 1,
      animTime: Math.random() * 10,
      moving: false,
      seed: Math.random() * 10,
      aggro: false,
      provoked: false,
      attackCd: U.rand(0.4, 1.2),
      abilityCd: boss ? 3.2 : 0,
      stun: 0,
      freeze: 0,
      poison: null,
      burn: null,
      hitFlash: 0,
      dead: false,
      chargeT: 0,
      chargeHit: false,
      wanderT: U.rand(0.5, 2),
      wanderAngle: Math.random() * U.TAU,
      size: def.size,
      trial: !!opts.trial,
    };
    if (elite) mon.size *= 1.06;
    if (opts.expMul) mon.exp = Math.round(mon.exp * opts.expMul);
    if (opts.goldMul) mon.gold = Math.round(mon.gold * opts.goldMul);
    if (opts.hpMul) {
      mon.maxHp = Math.round(mon.maxHp * opts.hpMul);
      mon.hp = mon.maxHp;
    }
    if (opts.atkMul) mon.atk = Math.round(mon.atk * opts.atkMul);
    if (opts.defMul) mon.armor = Math.round(mon.armor * opts.defMul);
    if (opts.spdMul) mon.def = Object.assign({}, mon.def, { spd: mon.def.spd * opts.spdMul });
    this.monsters.push(mon);
    return mon;
  }

  /* ------------------------------ 试炼塔 / 悬赏 ------------------------------ */
  ensureBounty(force = false) {
    const p = this.player;
    if (!p) return;
    const b = p.bounty;
    const stale =
      force ||
      !b ||
      !Array.isArray(b.tasks) ||
      b.tasks.length === 0 ||
      Date.now() - (Number(b.at) || 0) > 24 * 3600 * 1000 ||
      p.level - (Number(b.lv) || 0) >= 10;
    if (stale) p.bounty = SYSTEMS.rollBounty(p);
  }

  pickTrialMonster(cfg) {
    const pool = cfg.zone.monsters;
    let total = 0;
    for (const m of pool) total += m.w;
    let r = Math.random() * total;
    for (const m of pool) {
      r -= m.w;
      if (r <= 0) return DATA.MONSTERS[m.id];
    }
    return DATA.MONSTERS[pool[0].id];
  }

  enterTrial(floor) {
    const p = this.player;
    if (!p || p.dead) return;
    floor = U.clamp(Math.round(floor) || 1, 1, 999);
    const cfg = SYSTEMS.trialConfig(floor);
    this._enterTrial = true;
    this.enterZone(cfg.zoneId, false);
    this._enterTrial = false;
    // enterZone 生成的是常规地图，这里换成试炼场
    this.monsters = [];
    this.bossRef = null;
    this.bossRespawn = 0;
    this.loot = [];
    this.target = null;
    this.activeBoss = null;
    this.trial = { floor, cfg, need: cfg.count, killed: 0, timeLeft: cfg.time, state: 'fight', nextT: 0 };

    for (let i = 0; i < cfg.count; i++) {
      const pos = WORLD.randomFloor(this.map, Math.random, { x: p.x, y: p.y }, 200);
      const def = this.pickTrialMonster(cfg);
      this.spawnMonster(def, pos.x, pos.y, {
        trial: true,
        level: cfg.level,
        elite: Math.random() < cfg.eliteRate,
        hpMul: cfg.hpMul,
        atkMul: cfg.atkMul,
        defMul: cfg.defMul,
        spdMul: cfg.spdMul,
        expMul: cfg.expMul,
        goldMul: cfg.goldMul,
      });
    }

    HUD.el.zoneName.textContent = `试炼塔 · 第 ${floor} 层`;
    HUD.el.zoneLv.textContent = cfg.zone.name;
    HUD.toast(`试炼塔第 ${floor} 层 · 击杀 ${cfg.count} 只 · 限时 ${cfg.time}s`, 'epic');
    AUDIO.play('teleport');
    PANELS.refresh();
    this.save();
  }

  leaveTrial() {
    if (!this.trial) {
      HUD.toast('当前不在试炼塔中', '');
      return;
    }
    const floor = this.trial.floor;
    this.trial = null;
    const p = this.player;
    this.enterZone(p.zone === 'bichi' ? 'bichi' : p.zone, false);
    HUD.toast(`已离开试炼塔（第 ${floor} 层）`, '');
    this.save();
    PANELS.refresh();
  }

  collectAllLoot() {
    const p = this.player;
    if (!p) return;
    for (const l of this.loot) {
      if (l.picked) continue;
      if (l.kind === 'gold') {
        p.gold += Math.round(l.amount * (1 + p.stats.goldRate / 100));
      } else if (l.kind === 'potion') {
        p.potions[l.potion] = (p.potions[l.potion] || 0) + 1;
      } else if (l.kind === 'frag') {
        p.skillFrags = (p.skillFrags || 0) + Math.round(l.amount);
      } else if (l.kind === 'item') {
        if (this.autoSalvageItem(l.item)) continue;
        if (p.bag.length >= DATA.BAG_SIZE) {
          p.essence = (p.essence || 0) + ITEMS.salvageEssence(l.item);
          p.gold += ITEMS.salvageValue(l.item);
        } else {
          PLAYER.addItem(p, l.item);
        }
      }
      l.picked = true;
    }
    this.loot = [];
  }

  completeTrial() {
    const t = this.trial;
    const p = this.player;
    if (!t || t.state !== 'fight') return;
    t.state = 'clear';
    t.nextT = 3.2;
    this.collectAllLoot();

    const reward = SYSTEMS.trialReward(t.floor);
    p.gold += reward.gold;
    p.essence = (p.essence || 0) + reward.essence;
    p.towerBest = Math.max(p.towerBest || 0, t.floor);
    p.towerFloor = Math.max(p.towerFloor || 1, t.floor + 1);
    SYSTEMS.bountyProgress(p, 'tower', 1);

    const item = ITEMS.generate({
      level: reward.level,
      rarity: Math.max(1, reward.rarity),
      clsKind: DATA.CLASSES[p.clsId].weaponKind,
      clsId: p.clsId,
      setChance: 0.4,
    });
    if (p.bag.length < DATA.BAG_SIZE) PLAYER.addItem(p, item);
    else {
      p.essence += ITEMS.salvageEssence(item);
      p.gold += ITEMS.salvageValue(item);
    }

    this.addText(p.x, p.y - 90, `第 ${t.floor} 层通关!`, '#ffe28a', true);
    this.effects.push({ type: 'ring', x: p.x, y: p.y - 10, r0: 10, r1: 150, t: 0, dur: 1.0, color: '#ffd27a', width: 4 });
    this.burst(p.x, p.y - 30, 30, { color: '#ffd27a', speed: 200, size: 2.4, dur: 0.9, glow: true });
    HUD.toast(`第 ${t.floor} 层通关 · +${U.fmt(reward.gold)} 金币 · +${reward.essence} 精粹 · [${ITEMS.rarity(item).name}] ${item.name}`, 'epic');
    AUDIO.play('level');
    this.save();
    PANELS.refresh();
  }

  failTrial(reason) {
    const t = this.trial;
    if (!t) return;
    const floor = t.floor;
    this.trial = null;
    HUD.toast(`试炼失败：${reason}（止步第 ${floor} 层）`, 'bad');
    const p = this.player;
    this.enterZone(p.zone, false);
    PANELS.refresh();
  }

  /* ------------------------------ 主更新 ------------------------------ */
  update(dt) {
    const p = this.player;
    if (!p) return;
    this.time += dt;
    this.zoneTime += dt;
    if (!p.dead) p.playTime += dt;

    // 计时器
    for (const k in this.skillCd) {
      this.skillCd[k] = Math.max(0, this.skillCd[k] - dt);
    }
    this.potionCd.hp = Math.max(0, this.potionCd.hp - dt);
    this.potionCd.mp = Math.max(0, this.potionCd.mp - dt);
    this.shake = Math.max(0, this.shake - dt * 34);
    this.hitVignette = Math.max(0, this.hitVignette - dt * 3.4);
    this.tapChase = Math.max(0, this.tapChase - dt);
    p.invuln = Math.max(0, (p.invuln || 0) - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    p.attackT = Math.max(0, p.attackT - dt);
    p.attackCd = Math.max(0, (p.attackCd || 0) - dt);

    PLAYER.tickBuffs(p, dt);
    this._bagFullMsg = Math.max(0, this._bagFullMsg - dt);
    this._autoSalvageMsg = Math.max(0, (this._autoSalvageMsg || 0) - dt);

    if (!p.dead) this.updateTrial(dt);

    NET.update(dt, this);
    this.syncRemotes(dt);
    this.syncMonsters(dt);
    this.flushMonHits(dt);

    if (!p.dead) {
      this.updateAutoPotion();
      this.updatePlayer(dt);
      this.updateMonsters(dt);
      this.updateProjectiles(dt);
      this.updateLoot(dt);
      this.updateSpawning(dt);
      this.updateRegen(dt);
    }
    this.updateEffects(dt);
    this.updateParticles(dt);
    this.updateTexts(dt);
    this.updateCamera(dt);
    this.updateBossRef();
    this.checkLevelFx();

    this.saveTimer += dt;
    if (this.saveTimer > 18) {
      this.saveTimer = 0;
      this.save();
    }
  }

  updateTrial(dt) {
    const t = this.trial;
    if (!t) return;
    if (t.state === 'fight') {
      t.timeLeft -= dt;
      if (t.timeLeft <= 0) {
        t.timeLeft = 0;
        this.failTrial('时间耗尽');
      }
    } else if (t.state === 'clear') {
      t.nextT -= dt;
      if (t.nextT <= 0) this.enterTrial(t.floor + 1);
    }
  }

  updateAutoPotion() {
    const p = this.player;
    if (!p || p.dead || p.autoPotion === false) return;
    const st = p.stats;
    if (!st.hp) return;
    if (p.hp / st.hp < 0.45 && (p.potions.hp || 0) > 0 && this.potionCd.hp <= 0) {
      this.usePotion('hp');
    } else if (st.mp > 0 && p.mp / st.mp < 0.3 && (p.potions.mp || 0) > 0 && this.potionCd.mp <= 0) {
      this.usePotion('mp');
    }
  }

  /* ------------------------------ 玩家 ------------------------------ */
  updatePlayer(dt) {
    const p = this.player;
    if (p.dead) return;

    // 点击
    const tap = INPUT.consumeTap();
    if (tap) {
      const w = RENDER.screenToWorld(this, tap.x, tap.y);
      const mon = this.monsterAt(w.x, w.y);
      if (mon) {
        this.target = mon;
        this.tapChase = 4;
        p.moveTarget = null;
        p.movePath = null;
        p.chasePath = null;
      } else {
        this.moveTo(w.x, w.y);
      }
    }

    const mv = INPUT.move();
    const manual = INPUT.hasKeyboardMove() || (INPUT.joy.active && (Math.abs(INPUT.joy.x) > 0.05 || Math.abs(INPUT.joy.y) > 0.05));
    if (manual) {
      p.moveTarget = null;
      p.movePath = null;
      p.chasePath = null;
      this.tapChase = 0;
      this._manualUntil = this.time + 0.45;
    }

    // 自动索敌：总是选最近的、且中间没有墙的目标
    if (p.auto && !manual && !p.moveTarget && this.time > this._manualUntil) {
      if (this.tapChase > 0 && this.target && !this.target.dead) {
        // 点击锁定的目标还活着，先保持锁定
      } else {
        if (this.tapChase > 0) this.tapChase = 0;
        this._retargetT -= dt;
        if (this._retargetT <= 0) {
          this._retargetT = 0.18;
          this.target = this.nearestMonster(p.x, p.y, 520, true, true, true);
        }
      }
    }

    // 自动拾取：没有活着的目标时，寻路过去把东西捡起来
    if (p.autoPickup !== false && !manual && !p.moveTarget && this.time > this._manualUntil) {
      if (!this.target || this.target.dead) {
        const l = this.nearestLoot(p.x, p.y, 380);
        if (l) this.moveTo(l.x, l.y, true);
      }
    }

    let vx = 0;
    let vy = 0;
    if (manual) {
      vx = mv.x;
      vy = mv.y;
      if (mv.len < 0.12) {
        vx = 0;
        vy = 0;
      }
    } else if ((p.auto || this.tapChase > 0) && this.target && !this.target.dead) {
      const d = U.dist(p.x, p.y, this.target.x, this.target.y);
      const range = this.basicRange() * 0.82;
      if (d > range) {
        const clear = WORLD.lineClear(this.map, p.x, p.y, this.target.x, this.target.y, 12);
        if (clear) {
          p.chasePath = null;
          const dir = U.normalize(this.target.x - p.x, this.target.y - p.y);
          vx = dir.x;
          vy = dir.y;
        } else {
          // 中间隔墙：绕路寻路，每 0.4 秒重算一次
          if (!p.chasePath || this.time - (p.chaseT || 0) > 0.4) {
            p.chasePath = WORLD.findPath(this.map, p.x, p.y, this.target.x, this.target.y, 15) || [];
            p.chaseT = this.time;
          }
          let wp = p.chasePath[0];
          while (wp && U.dist(p.x, p.y, wp.x, wp.y) < 12) {
            p.chasePath.shift();
            wp = p.chasePath[0];
          }
          if (wp) {
            const dir = U.normalize(wp.x - p.x, wp.y - p.y);
            vx = dir.x;
            vy = dir.y;
          } else {
            const dir = U.normalize(this.target.x - p.x, this.target.y - p.y);
            vx = dir.x;
            vy = dir.y;
          }
        }
      } else {
        p.chasePath = null;
      }
    } else if (p.movePath && p.movePath.length) {
      let wp = p.movePath[0];
      while (wp && U.dist(p.x, p.y, wp.x, wp.y) < 10) {
        p.movePath.shift();
        wp = p.movePath[0];
      }
      if (wp) {
        const dir = U.normalize(wp.x - p.x, wp.y - p.y);
        vx = dir.x;
        vy = dir.y;
      } else {
        p.moveTarget = null;
      }
    } else if (p.moveTarget) {
      const d = U.dist(p.x, p.y, p.moveTarget.x, p.moveTarget.y);
      if (d < 8) p.moveTarget = null;
      else {
        const dir = U.normalize(p.moveTarget.x - p.x, p.moveTarget.y - p.y);
        vx = dir.x;
        vy = dir.y;
      }
    }

    p.moving = (vx !== 0 || vy !== 0);
    if (p.moving) {
      const spd = PLAYER.moveSpeed(p) * (p.dashT > 0 ? 4.6 : 1);
      const nx = p.x + vx * spd * dt;
      const ny = p.y + vy * spd * dt;
      const res = WORLD.move(this.map, p.x, p.y, nx, ny, 12);
      p.x = res.x;
      p.y = res.y;
      p.animTime += dt;
      p.moveX = vx;
      p.moveY = vy;
      if (Math.abs(vx) > 0.15) p.facing = vx > 0 ? 1 : -1;
      p.dirMode = Math.abs(vy) > Math.abs(vx) * 1.15
        ? (vy > 0 ? 'down' : 'up')
        : 'right';
    }
    if (p.dashT > 0) p.dashT = Math.max(0, p.dashT - dt);

    // 普攻
    const wantAttack = INPUT.attackHeld || this.attackHeld;
    const autoAttack = (p.auto || this.tapChase > 0) && !manual;
    if (p.attackCd <= 0 && (wantAttack || (autoAttack && this.target && !this.target.dead))) {
      const range = this.basicRange();
      let target = this.target;
      // 自动战斗：隔墙目标不攻击，改为继续绕路
      if (autoAttack && target && !target.dead && !WORLD.lineClear(this.map, p.x, p.y, target.x, target.y, 10)) {
        target = null;
      }
      if (!target || target.dead || U.dist(target.x, target.y, p.x, p.y) > range * 1.2) {
        const near = this.nearestMonster(p.x, p.y, range * 1.1, true, autoAttack, autoAttack);
        if (near) {
          target = near;
          if (autoAttack) this.target = near;
        }
      }
      if (target) {
        const d = U.dist(target.x, target.y, p.x, p.y);
        if (d <= range * 1.1) this.basicAttack(target);
      } else if (wantAttack) {
        this.basicAttack(null);
      }
    }
  }

  basicRange() {
    const cls = DATA.CLASSES[this.player.clsId];
    return cls.basic.range + 18;
  }

  basicAttack(target) {
    const p = this.player;
    const cls = DATA.CLASSES[p.clsId];
    const basic = cls.basic;
    p.attackCd = PLAYER.attackInterval(p);
    p.attackT = 0.2;
    if (target) {
      p.facing = target.x >= p.x ? 1 : -1;
      const ang = U.angle(p.x, p.y, target.x, target.y);
      if (basic.type === 'melee') {
        this.meleeSwing(basic.range + 22, basic.arc, ang, basic.power, '#ffe0b0', false);
      } else {
        this.spawnPlayerProjectile({
          x: p.x + Math.cos(ang) * 18,
          y: p.y - 26 + Math.sin(ang) * 8,
          angle: ang,
          speed: basic.speed,
          power: basic.power,
          color: basic.color,
          magic: true,
          radius: 8,
          homing: false,
          element: 'phys',
        });
      }
      AUDIO.play('skill');
    } else {
      // 空挥
      if (basic.type === 'melee') {
        const ang = p.facing > 0 ? 0 : Math.PI;
        this.effects.push({ type: 'slash', x: p.x, y: p.y - 24, angle: ang, arc: 1.1, range: 56, t: 0, dur: 0.2, color: 'rgba(255,230,190,0.8)' });
      }
    }
  }

  meleeSwing(range, arc, angle, power, color, skill, opts = {}) {
    const p = this.player;
    this.effects.push({
      type: opts.effect || 'slash',
      x: p.x,
      y: p.y - 24,
      angle,
      arc,
      range,
      t: 0,
      dur: opts.dur || 0.24,
      color,
      element: opts.element || 'phys',
    });
    let hits = 0;
    for (const mon of this.monsters) {
      if (mon.dead) continue;
      const d = U.dist(p.x, p.y - 20, mon.x, mon.y - 20);
      if (d > range + mon.size * 20) continue;
      const a = U.angle(p.x, p.y - 20, mon.x, mon.y - 20);
      if (Math.abs(U.angleDiff(angle, a)) > arc / 2 && d > 32) continue;
      if (!WORLD.lineClear(this.map, p.x, p.y - 20, mon.x, mon.y - 20, 10)) continue;
      this.playerHit(mon, power, {
        skill,
        magic: false,
        pen: opts.pen || 0,
        element: opts.element || 'phys',
        stunFixed: opts.stun,
        color,
      });
      hits++;
    }
    if (hits > 0) this.shake = Math.max(this.shake, skill ? 3.5 : 1.8);
  }

  spawnPlayerProjectile({ x, y, angle, speed, power, color, magic, radius, homing, element, aoe, target, extra }) {
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    this.projectiles.push({
      uid: U.uid(),
      x, y, vx, vy,
      speed,
      power,
      color,
      magic,
      radius: radius || 8,
      homing: !!homing,
      target: target || null,
      element: element || 'phys',
      aoe: aoe || 0,
      owner: 'player',
      life: 2.6,
      trail: [],
      extra: extra || null,
    });
  }

  /* ------------------------------ 伤害计算 ------------------------------ */
  playerHit(mon, power, opts = {}) {
    const p = this.player;
    if (!mon || mon.dead) return 0;
    const st = p.stats;
    const base = (opts.magic ? st.matk : st.atk) * power * U.rand(0.92, 1.08);
    let dmg = base;
    if (opts.skill) dmg *= 1 + st.skillDmg / 100;
    let crit = false;
    if (!opts.noCrit && Math.random() < st.crit / 100) {
      crit = true;
      dmg *= st.critDmg / 100;
    }
    const pen = U.clamp(st.pen + (opts.pen || 0), 0, 95);
    const armor = mon.armor * (1 - pen / 100);
    dmg = Math.max(1, dmg - armor) + st.trueDmg;
    if (mon.def.boss) dmg *= 1 + st.bossDmg / 100;
    if (mon.def.undead) dmg *= 1 + st.holy / 100;
    dmg = Math.round(dmg);

    if (mon.remote) this.damageRemoteMonster(mon, dmg, { crit, element: opts.element });
    else this.applyMonsterDamage(mon, dmg, { crit, element: opts.element, skill: opts.skill });

    // 联机：把伤害告知同房间队友（仅做同屏表现与协战）
    const netNow = performance.now();
    if (netNow - (this._lastNetHit || 0) > 110) {
      this._lastNetHit = netNow;
      NET.sendHit({ zone: p.zone, x: mon.x, y: mon.y, dmg });
    }

    // 吸血
    if (st.lifesteal > 0) {
      const heal = Math.max(1, Math.round((dmg * st.lifesteal) / 100));
      if (p.hp < st.hp) {
        PLAYER.heal(p, heal);
        if (Math.random() < 0.25) this.addText(p.x, p.y - 56, `+${heal}`, '#8ce69a');
      }
    }

    if (!opts.noTrigger && !mon.dead && !mon.remote) {
      this.applyStatus(mon, opts);
      this.triggerUniques(mon, dmg);
    }
    return dmg;
  }

  applyMonsterDamage(mon, dmg, opts = {}) {
    if (!mon || mon.dead) return;
    mon.hp -= dmg;
    mon.hitFlash = 0.22;
    mon.provoked = true;
    mon.aggro = true;
    const crit = !!opts.crit;
    let color = crit ? '#ffcf6a' : '#fff1d6';
    if (opts.element === 'fire') color = crit ? '#ffd07a' : '#ff9a5c';
    else if (opts.element === 'ice') color = '#a8ecff';
    else if (opts.element === 'holy') color = '#ffe8a0';
    else if (opts.element === 'poison') color = '#a6f08a';
    this.addText(mon.x + U.rand(-8, 8), mon.y - 58 - mon.size * 10, crit ? `${U.num(dmg)}!` : U.num(dmg), color, crit);
    const elem = opts.element || 'phys';
    const elemColor = elem === 'ice' ? '#bfeaff' : elem === 'poison' ? '#9ce08a' : elem === 'fire' ? '#ffb066' : elem === 'holy' ? '#ffe8a0' : '#ffcf9a';
    const shape = elem === 'fire' ? 'ember' : elem === 'ice' ? 'shard' : elem === 'poison' ? 'bubble' : 'spark';
    this.burst(mon.x, mon.y - 26, crit ? 10 : 6, {
      color: elemColor,
      speed: crit ? 140 : 90,
      size: 2,
      dur: 0.42,
      glow: true,
      shape,
    });
    if (this.effects.length < 70) {
      this.effects.push({
        type: 'impact',
        x: mon.x,
        y: mon.y - 26,
        t: 0,
        dur: crit ? 0.28 : 0.2,
        element: elem,
        seed: Math.random() * 6,
      });
    }
    if (crit) this.shake = Math.max(this.shake, 4);

    const now = performance.now();
    if (now - this._lastHitSfx > 55) {
      this._lastHitSfx = now;
      AUDIO.play(crit ? 'crit' : 'hit');
    }
    if (mon.hp <= 0) this.killMonster(mon);
  }

  applyStatus(mon, opts) {
    const st = this.player.stats;
    if (st.stun > 0 && U.chance(st.stun / 100)) {
      mon.stun = Math.max(mon.stun, 1.1);
      this.addText(mon.x, mon.y - 74, '麻痹', '#ffe08a');
    }
    if (st.freeze > 0 && U.chance(st.freeze / 100)) {
      mon.freeze = Math.max(mon.freeze, 1.5);
      this.addText(mon.x, mon.y - 74, '冰冻', '#a8ecff');
    }
    if (st.poison > 0 && U.chance(st.poison / 100)) {
      mon.poison = { t: 5, tick: 0.5, dps: Math.max(4, st.matk * 0.28) };
    }
    if (st.burn > 0 && U.chance(st.burn / 100)) {
      mon.burn = { t: 4, tick: 0.5, dps: Math.max(4, st.atk * 0.22) };
    }
    if (opts && opts.stunFixed) {
      mon.stun = Math.max(mon.stun, opts.stunFixed);
    }
    if (opts && opts.freezeFixed) {
      mon.freeze = Math.max(mon.freeze, opts.freezeFixed);
    }
  }

  triggerUniques(mon, dmg) {
    const p = this.player;
    const uniques = new Set();
    for (const slot in p.equip) {
      const it = p.equip[slot];
      if (it && it.uniqueId) uniques.add(it.uniqueId);
    }
    for (const id of uniques) {
      const def = DATA.UNIQUES[id];
      if (!def || !def.effect) continue;
      const e = def.effect;
      if (e.type === 'blaze' && U.chance(e.chance)) {
        this.burst(mon.x, mon.y - 20, 18, { color: '#ff8a3c', speed: 150, size: 2.6, dur: 0.55, glow: true });
        this.effects.push({ type: 'explode', x: mon.x, y: mon.y - 20, r: 62, t: 0, dur: 0.4, color: '#ff7a3a' });
        mon.burn = { t: 4, tick: 0.5, dps: Math.max(6, p.stats.atk * 0.26) };
        for (const m of this.monsters) {
          if (m === mon || m.dead) continue;
          if (U.dist(m.x, m.y, mon.x, mon.y) < 70) this.applyMonsterDamage(m, Math.round(p.stats.atk * e.power * 0.5), { element: 'fire' });
        }
        this.addText(mon.x, mon.y - 86, '烈焰', '#ff9a5c');
      }
      if (e.type === 'thunder' && U.chance(e.chance)) {
        let src = { x: mon.x, y: mon.y - 40 };
        const targets = [mon, ...this.nearestMonsters(mon.x, mon.y, 160, 3, mon)];
        for (let i = 0; i < Math.min(3, targets.length); i++) {
          const m = targets[i];
          const pts = this.jaggedLine(src.x, src.y, m.x, m.y - 30, 6);
          this.effects.push({ type: 'lightning', points: pts, t: 0, dur: 0.24 });
          this.applyMonsterDamage(m, Math.round(p.stats.atk * e.power), { element: 'holy' });
          src = { x: m.x, y: m.y - 30 };
        }
        this.addText(mon.x, mon.y - 86, '雷霆', '#bfe9ff');
      }
      if (e.type === 'frost' && U.chance(e.chance)) {
        mon.freeze = Math.max(mon.freeze, e.dur || 1.6);
        this.addText(mon.x, mon.y - 86, '冰封', '#a8ecff');
      }
      if (e.type === 'void' && U.chance(e.chance)) {
        this.applyMonsterDamage(mon, Math.round(dmg * 0.9), { crit: true, element: 'holy' });
        this.addText(mon.x, mon.y - 96, '虚空', '#c9a6ff');
      }
      if (e.type === 'holy' && mon.def.undead) {
        this.applyMonsterDamage(mon, Math.round(dmg * 0.22), { element: 'holy' });
      }
    }
    if (p.setEffects.includes('setShengzhan') && U.chance(0.1)) {
      mon.hp -= 0;
      const extra = Math.round(p.stats.atk * 2.2);
      this.applyMonsterDamage(mon, extra, { crit: true, element: 'holy' });
      this.addText(mon.x, mon.y - 100, '圣战一击', '#ffb15c', true);
      this.shake = Math.max(this.shake, 5);
    }
  }

  /* ------------------------------ 怪物 ------------------------------ */
  updateMonsters(dt) {
    const p = this.player;
    const alive = this.monsters.filter((m) => !m.dead);
    for (const mon of alive) {
      mon.hitFlash = Math.max(0, mon.hitFlash - dt);
      mon.animTime += dt;

      // 队友的怪：只做位置插值，行为完全由主人那一端决定
      if (mon.remote) {
        const k = Math.min(1, dt * 9);
        mon.x += (mon.tx - mon.x) * k;
        mon.y += (mon.ty - mon.y) * k;
        continue;
      }

      if (mon.stun > 0) mon.stun -= dt;
      if (mon.freeze > 0) mon.freeze -= dt;

      // DoT
      if (mon.poison && mon.poison.t > 0) {
        mon.poison.t -= dt;
        mon.poison.tick -= dt;
        if (mon.poison.tick <= 0) {
          mon.poison.tick = 0.5;
          this.rawDamage(mon, Math.max(1, Math.round(mon.poison.dps * 0.5)), '#8ce69a');
        }
        if (mon.poison.t <= 0) mon.poison = null;
      }
      if (mon.burn && mon.burn.t > 0) {
        mon.burn.t -= dt;
        mon.burn.tick -= dt;
        if (mon.burn.tick <= 0) {
          mon.burn.tick = 0.5;
          this.rawDamage(mon, Math.max(1, Math.round(mon.burn.dps * 0.5)), '#ff9a5c');
        }
        if (mon.burn.t <= 0) mon.burn = null;
      }
      if (mon.dead) continue;

      const dx = p.x - mon.x;
      const dy = p.y - mon.y;
      const dist = Math.hypot(dx, dy);
      if (mon.stun <= 0 && mon.freeze <= 0 && !p.dead) {
        // BOSS 技能
        if (mon.boss) {
          mon.abilityCd -= dt;
          if (mon.abilityCd <= 0 && mon.provoked && dist < 760) {
            this.bossAbility(mon, dist);
            mon.abilityCd = U.rand(5.5, 8.5);
          }
          if (mon.chargeT > 0) {
            mon.chargeT -= dt;
            const dir = U.normalize(dx, dy);
            const spd = 330;
            const res = WORLD.move(this.map, mon.x, mon.y, mon.x + dir.x * spd * dt, mon.y + dir.y * spd * dt, 14);
            mon.x = res.x;
            mon.y = res.y;
            mon.moving = true;
            mon.facing = dx >= 0 ? 1 : -1;
            if (!mon.chargeHit && dist < 46 + mon.size * 12) {
              mon.chargeHit = true;
              this.damagePlayer(mon.atk * 1.5, mon, { magic: false, name: mon.def.name });
              this.shake = Math.max(this.shake, 8);
            }
            continue;
          }
        }

        const aggroRange = mon.aggro ? 9999 : mon.def.aggro || 320;
        if (!mon.provoked && !mon.aggro && dist > aggroRange) {
          // 游荡
          mon.wanderT -= dt;
          if (mon.wanderT <= 0) {
            mon.wanderT = U.rand(1.2, 3.2);
            mon.wanderAngle = Math.random() * U.TAU;
            mon.moving = Math.random() < 0.7;
          }
          if (mon.moving && !mon.passive) {
            const spd = mon.def.spd * 0.35;
            const nx = mon.x + Math.cos(mon.wanderAngle) * spd * dt;
            const ny = mon.y + Math.sin(mon.wanderAngle) * spd * dt;
            const res = WORLD.move(this.map, mon.x, mon.y, nx, ny, 12);
            mon.x = res.x;
            mon.y = res.y;
            mon.facing = Math.cos(mon.wanderAngle) >= 0 ? 1 : -1;
          } else {
            mon.moving = false;
          }
          continue;
        }
        mon.aggro = true;
        mon.provoked = true;
        const range = mon.def.range || 40;
        const isRanged = !!mon.def.ranged;
        const desired = isRanged ? range * 0.8 : range * 0.72;
        if (isRanged && dist < 110) {
          // 后撤
          const dir = U.normalize(-dx, -dy);
          const spd = mon.def.spd * 0.8;
          const res = WORLD.move(this.map, mon.x, mon.y, mon.x + dir.x * spd * dt, mon.y + dir.y * spd * dt, 12);
          mon.x = res.x;
          mon.y = res.y;
          mon.moving = true;
          mon.facing = dx >= 0 ? 1 : -1;
        } else if (dist > desired) {
          const dir = U.normalize(dx, dy);
          let spd = mon.def.spd;
          if (mon.elite) spd *= 1.05;
          // 简单分离
          for (const other of alive) {
            if (other === mon || other.dead) continue;
            const ox = mon.x - other.x;
            const oy = mon.y - other.y;
            const od = Math.hypot(ox, oy);
            if (od > 0 && od < 30) {
              dir.x += (ox / od) * 0.6;
              dir.y += (oy / od) * 0.6;
            }
          }
          const len = Math.hypot(dir.x, dir.y) || 1;
          const nx = mon.x + (dir.x / len) * spd * dt;
          const ny = mon.y + (dir.y / len) * spd * dt;
          const res = WORLD.move(this.map, mon.x, mon.y, nx, ny, 12);
          if (res.x === mon.x && res.y === mon.y) {
            // 卡墙时侧移
            const ang = Math.atan2(dy, dx) + Math.PI / 2;
            const res2 = WORLD.move(this.map, mon.x, mon.y, mon.x + Math.cos(ang) * spd * dt, mon.y + Math.sin(ang) * spd * dt, 12);
            mon.x = res2.x;
            mon.y = res2.y;
          } else {
            mon.x = res.x;
            mon.y = res.y;
          }
          mon.moving = true;
          mon.facing = dx >= 0 ? 1 : -1;
        } else {
          mon.moving = false;
          mon.facing = dx >= 0 ? 1 : -1;
        }

        mon.attackCd -= dt;
        if (mon.attackCd <= 0 && dist <= range + 26) {
          mon.attackCd = mon.def.cd * (mon.elite ? 0.92 : 1);
          this.monsterAttack(mon);
        }
      } else {
        mon.moving = false;
        if (mon.stun > 0) mon.attackCd = Math.max(mon.attackCd, 0.25);
      }
    }

    // 定期清理久死怪物：否则数组只增不减，刷怪上限会被尸体占满
    this._monPruneT = (this._monPruneT || 0) + dt;
    if (this._monPruneT >= 4) {
      this._monPruneT = 0;
      const now = performance.now();
      this.monsters = this.monsters.filter((m) => !m.dead || m.remote || now - (m.deadAt || 0) < 8000);
    }
  }

  monsterAttack(mon) {
    const p = this.player;
    const def = mon.def;
    const ang = U.angle(mon.x, mon.y, p.x, p.y);
    if (def.ranged) {
      let color = '#c9a6ff';
      if (def.poisonHit) color = '#9ce08a';
      else if (def.magicHit) color = '#c9a6ff';
      else color = '#ffb066';
      this.projectiles.push({
        uid: U.uid(),
        x: mon.x,
        y: mon.y - 26 * mon.size,
        vx: Math.cos(ang) * 280,
        vy: Math.sin(ang) * 280,
        speed: 280,
        power: 1,
        color,
        magic: !!def.magicHit,
        radius: 7,
        homing: false,
        owner: 'mon',
        source: mon,
        life: 3,
        trail: [],
        poisonHit: !!def.poisonHit,
      });
      AUDIO.play('skill');
    } else {
      this.damagePlayer(mon.atk * U.rand(0.85, 1.15), mon, { magic: false, name: def.name });
    }
  }

  bossAbility(mon, dist) {
    const p = this.player;
    const def = mon.def;
    const abilities = def.abilities || ['slam'];
    const type = abilities[Math.floor(Math.random() * abilities.length)];
    if (type === 'summon' && this.monsters.filter((m) => !m.dead && !m.boss && !m.remote).length < 26) {
      const summonDef = DATA.MONSTERS[def.summon];
      if (summonDef) {
        for (let i = 0; i < (def.summonCount || 2); i++) {
          const ang = Math.random() * U.TAU;
          const sx = mon.x + Math.cos(ang) * U.rand(50, 100);
          const sy = mon.y + Math.sin(ang) * U.rand(50, 100);
          if (!WORLD.blocked(this.map, sx, sy, 12)) {
            this.spawnMonster(summonDef, sx, sy, { elite: Math.random() < 0.35 });
            this.effects.push({ type: 'summon', x: sx, y: sy, t: 0, dur: 0.7 });
          }
        }
        this.addText(mon.x, mon.y - 110 * mon.size, '召唤!', '#c9a6ff', true);
        AUDIO.play('boss');
      }
    } else if (type === 'charge') {
      mon.chargeT = 0.9;
      mon.chargeHit = false;
      this.effects.push({ type: 'telegraph', x: mon.x, y: mon.y, r: 40, t: 0, dur: 0.5, small: true });
      this.addText(mon.x, mon.y - 110 * mon.size, '冲锋!', '#ff9a6a', true);
    } else {
      const tx = p.x;
      const ty = p.y;
      const radius = def.slamRadius || 120;
      const amount = mon.atk * (def.slamPower || 2.2);
      this.effects.push({
        type: 'telegraph', x: tx, y: ty, r: radius, t: 0, dur: 1.05,
        onDone: () => {
          if (this.player.dead) return;
          if (U.dist(tx, ty, this.player.x, this.player.y) < radius + 14) {
            this.damagePlayer(amount, mon, { magic: false, name: def.name });
          }
          this.shake = Math.max(this.shake, 10);
          this.effects.push({ type: 'explode', x: tx, y: ty, r: radius, t: 0, dur: 0.45, color: '#ff5a3c' });
          this.burst(tx, ty, 26, { color: '#ff8a5c', speed: 190, size: 2.8, dur: 0.7, glow: true });
          AUDIO.play('fire');
        },
      });
      this.addText(mon.x, mon.y - 110 * mon.size, '重击!', '#ff6a4a', true);
    }
  }

  nearestMonster(x, y, maxDist, includeBoss = true, requireLos = false, preferOwn = false) {
    const max2 = maxDist * maxDist;
    let best = null;
    let bd = max2;
    let own = null;
    let ownD = Infinity;
    for (const m of this.monsters) {
      if (m.dead) continue;
      if (!includeBoss && m.boss) continue;
      const d = U.dist2(x, y, m.x, m.y);
      if (d >= max2) continue;
      if (requireLos && !WORLD.lineClear(this.map, x, y, m.x, m.y, 10)) continue;
      if (!m.remote && d < ownD) {
        ownD = d;
        own = m;
      }
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    // 自动战斗：1.35 倍距离内优先打自己的怪（队友的怪不计你的经验与掉落）
    if (preferOwn && best && best.remote && own && ownD <= bd * 1.35) return own;
    return best;
  }

  // 自动拾取用：优先装备，其次金币 / 药水
  nearestLoot(x, y, maxDist) {
    let best = null;
    let bd = maxDist * maxDist;
    for (const l of this.loot) {
      if (l.picked) continue;
      if (l.kind === 'item' && this.player.bag.length >= DATA.BAG_SIZE) continue;
      const d = U.dist2(x, y, l.x, l.y);
      const weight = l.kind === 'item' ? d : l.kind === 'frag' ? d * 0.6 : d * 2.4;
      if (weight < bd) {
        bd = weight;
        best = l;
      }
    }
    return best;
  }

  /* ------------------------------ 联机 ------------------------------ */
  syncRemotes(dt) {
    const p = this.player;
    const next = [];
    for (const peer of NET.peerList()) {
      if (!peer || peer.zone !== p.zone) continue;
      const prev = this.remotes.find((r) => r.id === peer.id);
      const k = Math.min(1, dt * 14);
      const rx = prev ? prev.rx + (peer.x - prev.rx) * k : peer.x;
      const ry = prev ? prev.ry + (peer.y - prev.ry) * k : peer.y;
      next.push(Object.assign({}, peer, { rx, ry }));
    }
    this.remotes = next;
  }

  applyRemoteHit(msg) {
    if (!msg || !this.player || msg.zone !== this.player.zone) return;
    const x = Number(msg.x) || 0;
    const y = Number(msg.y) || 0;
    // 只做位置表现：真实伤害由怪物主人在 monhit 里结算，避免两边各扣一次
    this.effects.push({ type: 'hit', x, y: y - 20, t: 0, dur: 0.28, color: '#8fd8ff' });
  }

  /* ---------- 怪物同步：自己刷的怪 = 自己的，镜像 = 队友的 ---------- */
  syncMonsters(dt) {
    const p = this.player;
    const now = performance.now();

    // 队友长时间没再报到 / 镜像已死亡，回收
    for (const [key, rec] of this.remoteMons) {
      const mon = rec.mon;
      const stale = now - rec.at > 3600;
      const gone = mon.dead && now - (mon.deadAt || 0) > 900;
      if (!stale && !gone) continue;
      this.remoteMons.delete(key);
      this._monTomb.set(key, now);
      const i = this.monsters.indexOf(mon);
      if (i >= 0) this.monsters.splice(i, 1);
      if (this.target === mon) this.target = null;
    }
    for (const [key, at] of this._monTomb) {
      if (now - at > 6000) this._monTomb.delete(key);
    }

    this._monSyncT -= dt;
    if (this._monSyncT > 0) return;
    this._monSyncT = 0.35;
    if (!NET.isOnline() || this.trial) return;

    const list = [];
    const max2 = 1300 * 1300;
    for (const m of this.monsters) {
      if (m.remote || m.trial) continue;
      if (m.dead && now - (m.deadAt || 0) > 3000) continue;
      if (U.dist2(p.x, p.y, m.x, m.y) > max2) continue;
      list.push({
        i: m.uid,
        k: m.typeId,
        x: Math.round(m.x),
        y: Math.round(m.y),
        s: Math.round((m.size || 1) * 100) / 100,
        h: m.dead ? 0 : Math.max(0, Math.round(m.hp)),
        m: Math.round(m.maxHp),
        l: m.lvl,
        e: m.elite ? 1 : 0,
        b: m.boss ? 1 : 0,
        f: m.facing >= 0 ? 1 : -1,
        v: m.moving && !m.dead ? 1 : 0,
      });
      if (list.length >= 40) break;
    }
    if (list.length) NET.sendMonsters(p.zone, list);
  }

  applyRemoteMonsters(ownerId, zone, list) {
    const p = this.player;
    if (!p || !ownerId || ownerId === NET.id) return;
    if (zone !== p.zone || !Array.isArray(list)) return;
    const now = performance.now();
    for (const s of list) {
      if (!s || !s.i || !s.k) continue;
      const def = DATA.MONSTERS[s.k];
      if (!def) continue;
      const key = ownerId + ':' + s.i;
      const tomb = this._monTomb.get(key);
      if (tomb) {
        if (now - tomb < 6000) continue;
        this._monTomb.delete(key);
      }
      const prev = this.remoteMons.get(key);
      let mon = prev ? prev.mon : null;
      if (!mon) {
        mon = {
          uid: key,
          rawUid: s.i,
          remote: true,
          ownerId,
          typeId: s.k,
          def,
          lvl: s.l || def.lvl,
          boss: !!s.b,
          elite: !!s.e,
          hp: s.h,
          maxHp: Math.max(1, s.m || def.hp),
          atk: 0,
          armor: def.def,
          exp: 0,
          gold: 0,
          x: s.x,
          y: s.y,
          tx: s.x,
          ty: s.y,
          homeX: s.x,
          homeY: s.y,
          facing: s.f >= 0 ? 1 : -1,
          animTime: Math.random() * 10,
          moving: !!s.v,
          seed: Math.random() * 10,
          aggro: true,
          provoked: true,
          attackCd: 999,
          abilityCd: 999,
          stun: 0,
          freeze: 0,
          poison: null,
          burn: null,
          hitFlash: 0,
          dead: false,
          chargeT: 0,
          chargeHit: true,
          wanderT: 999,
          wanderAngle: 0,
          size: s.s || def.size,
          trial: false,
        };
        if (mon.elite) mon.size *= 1.06;
        this.monsters.push(mon);
      }
      mon.tx = s.x;
      mon.ty = s.y;
      mon.maxHp = Math.max(1, s.m || mon.maxHp);
      mon.lvl = s.l || mon.lvl;
      mon.moving = !!s.v;
      mon.facing = s.f >= 0 ? 1 : -1;
      if (s.h <= 0) {
        if (!mon.dead) {
          mon.dead = true;
          mon.deadAt = now;
          this.burst(mon.x, mon.y - 24, mon.boss ? 50 : 12, {
            color: mon.boss ? '#ff8a4a' : '#9fb8c8',
            speed: mon.boss ? 220 : 100,
            size: mon.boss ? 3 : 2,
            dur: mon.boss ? 1 : 0.5,
            glow: mon.boss,
            gravity: 160,
          });
          if (this.target === mon) this.target = null;
        }
        mon.hp = 0;
      } else {
        mon.dead = false;
        mon.hp = s.h;
      }
      this.remoteMons.set(key, { mon, at: now, ownerId });
    }
  }

  // 队友打在我的怪身上：只由怪物主人结算
  applyRemoteMonHit(msg) {
    const p = this.player;
    if (!msg || !p || msg.zone !== p.zone) return;
    if (msg.from && msg.from === NET.id) return;
    let mon = null;
    for (const m of this.monsters) {
      if (!m.remote && m.uid === msg.uid) {
        mon = m;
        break;
      }
    }
    if (!mon || mon.dead) return;
    const dmg = Math.max(1, Math.round(Number(msg.dmg) || 0));
    this.applyMonsterDamage(mon, dmg, { element: msg.element || 'phys' });
  }

  // 打队友的怪：本地先扣血做表现，再把伤害还给怪物主人结算
  damageRemoteMonster(mon, dmg, opts = {}) {
    if (!mon || mon.dead || !mon.remote) return;
    const crit = !!opts.crit;
    mon.hp = Math.max(0, mon.hp - dmg);
    mon.hitFlash = 0.22;
    this.addText(mon.x + U.rand(-8, 8), mon.y - 58 - mon.size * 10, crit ? `${U.num(dmg)}!` : U.num(dmg), crit ? '#ffcf6a' : '#d7f2ff');
    this.burst(mon.x, mon.y - 26, crit ? 10 : 6, {
      color: '#a8e0ff',
      speed: crit ? 140 : 90,
      size: 2,
      dur: 0.42,
      glow: true,
      shape: 'spark',
    });
    if (crit) this.shake = Math.max(this.shake, 4);
    if (mon.hp <= 0) {
      mon.dead = true;
      mon.deadAt = performance.now();
      if (this.target === mon) this.target = null;
    }
    const key = mon.ownerId + ':' + mon.rawUid;
    const pending = this._pendingMonHit.get(key);
    if (pending) {
      pending.dmg += dmg;
      pending.element = opts.element || pending.element;
    } else {
      this._pendingMonHit.set(key, {
        owner: mon.ownerId,
        uid: mon.rawUid,
        dmg,
        element: opts.element || 'phys',
      });
    }
  }

  // 合并同一只怪的连续伤害，避免 AoE 打出 POST 风暴
  flushMonHits(dt) {
    this._monHitT += dt;
    if (this._monHitT < 0.12) return;
    this._monHitT = 0;
    if (!NET.isOnline()) {
      this._pendingMonHit.clear();
      return;
    }
    let sent = 0;
    for (const [key, v] of this._pendingMonHit) {
      NET.sendMonHit({ owner: v.owner, uid: v.uid, zone: this.player.zone, dmg: v.dmg, element: v.element });
      this._pendingMonHit.delete(key);
      if (++sent >= 10) break;
    }
  }

  nearestMonsters(x, y, maxDist, count, exclude) {
    const list = [];
    const max2 = maxDist * maxDist;
    for (const m of this.monsters) {
      if (m.dead || m === exclude) continue;
      const d = U.dist2(x, y, m.x, m.y);
      if (d < max2) list.push({ m, d });
    }
    list.sort((a, b) => a.d - b.d);
    return list.slice(0, count).map((o) => o.m);
  }

  monsterAt(x, y) {
    let best = null;
    let bd = 44 * 44;
    for (const m of this.monsters) {
      if (m.dead) continue;
      const d = U.dist2(x, y, m.x, m.y - 20);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    return best;
  }

  rawDamage(mon, amount, color) {
    if (!mon || mon.dead) return;
    mon.hp -= amount;
    this.addText(mon.x + U.rand(-6, 6), mon.y - 54 - mon.size * 8, U.num(amount), color || '#fff1d6');
    if (mon.hp <= 0) this.killMonster(mon);
  }

  killMonster(mon) {
    if (mon.dead) return;
    mon.dead = true;
    mon.deadAt = performance.now();
    // 队友的怪死亡由主人结算，镜像只做表现
    if (mon.remote) return;
    const p = this.player;
    p.kills += 1;

    SYSTEMS.bountyProgress(p, 'kill', 1);
    SYSTEMS.bountyProgress(p, 'killType', 1, mon.typeId);
    if (mon.boss) SYSTEMS.bountyProgress(p, 'boss', 1);
    else if (mon.elite) SYSTEMS.bountyProgress(p, 'elite', 1);

    this.burst(mon.x, mon.y - 24, mon.boss ? 60 : 14, {
      color: mon.boss ? '#ff8a4a' : '#c98a5a',
      speed: mon.boss ? 240 : 110,
      size: mon.boss ? 3.4 : 2,
      dur: mon.boss ? 1.1 : 0.55,
      glow: mon.boss,
      gravity: 160,
    });
    this.shake = Math.max(this.shake, mon.boss ? 14 : 2);
    AUDIO.play(mon.boss ? 'boss' : 'kill');

    // 经验
    const ups = PLAYER.gainExp(p, mon.exp);
    if (ups > 0) {
      this.addText(p.x, p.y - 76, `升级!`, '#ffe28a', true);
      this.effects.push({ type: 'levelup', x: p.x, y: p.y, t: 0, dur: 0.9 });
      AUDIO.play('level');
      HUD.toast(`等级提升至 Lv.${p.level}，属性已增强`, 'epic');
      this.save();
    }

    // 掉落
    this.dropLoot(mon);

    if (this.trial && this.trial.state === 'fight' && mon.trial) {
      this.trial.killed += 1;
      if (this.trial.killed >= this.trial.need) this.completeTrial();
    }
    if (p.stats.healOnKill > 0) PLAYER.heal(p, p.stats.hp * (p.stats.healOnKill / 100));
    if (this.hasUnique(p, 'bloodthirst')) PLAYER.heal(p, p.stats.hp * 0.06);
    if (p.setEffects.includes('tianzun')) PLAYER.heal(p, p.stats.hp * 0.03);

    if (mon.boss) {
      this.bossRef = null;
      this.bossRespawn = 80;
      p.bossKills[mon.typeId] = (p.bossKills[mon.typeId] || 0) + 1;
      HUD.toast(`击杀 ${mon.def.name}！掉落已散落`, 'epic');
      this.effects.push({ type: 'levelup', x: mon.x, y: mon.y, t: 0, dur: 1.2 });
      this.save();
    }
  }

  /* ------------------------------ 掉落 ------------------------------ */
  dropLoot(mon) {
    const p = this.player;
    const st = p.stats;
    const goldAmount = Math.round(mon.gold * U.rand(0.8, 1.2) * (1 + st.goldRate / 100));
    this.loot.push({ uid: U.uid(), x: mon.x + U.rand(-10, 10), y: mon.y + U.rand(-8, 8), kind: 'gold', amount: goldAmount, age: 0 });

    // 技能书碎片：BOSS 稳定产出，精英怪低概率掉落
    if (mon.boss) {
      const frag = U.randInt(8, 13) + Math.floor(mon.lvl / 4);
      this.loot.push({
        uid: U.uid(),
        x: mon.x + U.rand(-16, 16),
        y: mon.y + U.rand(-12, 12),
        kind: 'frag',
        amount: frag,
        age: 0,
      });
    } else if (mon.elite && Math.random() < 0.14) {
      this.loot.push({
        uid: U.uid(),
        x: mon.x + U.rand(-14, 14),
        y: mon.y + U.rand(-10, 10),
        kind: 'frag',
        amount: U.randInt(1, 2),
        age: 0,
      });
    }

    const potionChance = mon.boss ? 1 : mon.elite ? 0.4 : 0.2;
    if (Math.random() < potionChance) {
      this.loot.push({
        uid: U.uid(),
        x: mon.x + U.rand(-16, 16),
        y: mon.y + U.rand(-10, 12),
        kind: 'potion',
        potion: Math.random() < 0.6 ? 'hp' : 'mp',
        amount: 1,
        age: 0,
      });
    }

    const baseChance = mon.boss ? 1 : mon.elite ? 0.6 : 0.22;
    const chance = U.clamp(baseChance * (1 + (st.dropRate / 100) * 0.8) + (st.luck || 0) * 0.01, 0, 1);
    this.pity = (this.pity || 0) + 1;
    if (Math.random() > chance && this.pity < 5) return;
    this.pity = 0;

    const cls = DATA.CLASSES[p.clsId];
    const drops = mon.boss ? U.randInt(2, 4) : 1;
    const firstKill = mon.boss && (p.bossKills[mon.typeId] || 0) === 0;
    const bonus = (st.dropRate / 100) * 0.55 + (st.luck || 0) * 0.015 + (mon.boss ? 1.1 : mon.elite ? 0.35 : 0) + (mon.trial && this.trial ? this.trial.cfg.dropBonus : 0);
    for (let i = 0; i < drops; i++) {
      let rarity = ITEMS.rollRarity(bonus);
      if (mon.boss) {
        rarity = Math.max(rarity, mon.boss && i === 0 ? (firstKill ? 4 : 3) : 2);
      }
      const item = ITEMS.generate({
        level: mon.lvl + (mon.boss ? 2 : 0),
        rarity,
        clsKind: cls.weaponKind,
        clsId: p.clsId,
        setChance: mon.boss ? 0.5 : 0.28,
      });
      this.loot.push({
        uid: U.uid(),
        x: mon.x + U.rand(-26, 26),
        y: mon.y + U.rand(-20, 20),
        kind: 'item',
        item,
        age: 0,
      });
    }
    if (firstKill && mon.boss) {
      HUD.toast(`首杀 ${mon.def.name}，必得传说以上装备`, 'epic');
    }
  }

  updateLoot(dt) {
    const p = this.player;
    for (const l of this.loot) {
      l.age += dt;
      if (l.picked) continue;
      const d = U.dist(l.x, l.y, p.x, p.y);
      const base = l.kind === 'item' ? 52 : 66;
      const pickRange = p.autoPickup === false ? base : base + 34;
      if (d < pickRange) {
        if (l.kind === 'gold') {
          const amount = Math.round(l.amount * (1 + p.stats.goldRate / 100));
          p.gold += amount;
          l.picked = true;
          this.addText(p.x + U.rand(14, 26), p.y - 74, `+${U.fmt(amount)} 金币`, '#ffd27a');
          AUDIO.play('coin');
        } else if (l.kind === 'potion') {
          p.potions[l.potion] = (p.potions[l.potion] || 0) + 1;
          l.picked = true;
          this.addText(p.x + U.rand(12, 24), p.y - 74, l.potion === 'hp' ? '金创药 +1' : '魔法药 +1', l.potion === 'hp' ? '#ff9a86' : '#8fd8ff');
          AUDIO.play('pickup');
        } else if (l.kind === 'frag') {
          const amount = Math.round(l.amount);
          p.skillFrags = (p.skillFrags || 0) + amount;
          l.picked = true;
          this.addText(p.x + U.rand(10, 22), p.y - 76, `技能书碎片 +${amount}`, '#c9a6ff');
          HUD.toast(`获得技能书碎片 ×${amount}（${p.skillFrags} / ${DATA.ULTIMATE_FRAG_COST}）`, amount >= 8 ? 'epic' : 'good');
          AUDIO.play(amount >= 8 ? 'upgrade' : 'pickup');
        } else if (l.kind === 'item') {
          if (this.autoSalvageItem(l.item)) {
            l.picked = true;
            continue;
          }
          if (p.bag.length >= DATA.BAG_SIZE) {
            if (this._bagFullMsg <= 0) {
              HUD.toast('背包已满，无法拾取装备', 'bad');
              this._bagFullMsg = 3;
            }
            continue;
          }
          PLAYER.addItem(p, l.item);
          l.picked = true;
          SYSTEMS.bountyProgress(p, 'collect', 1);
          const rd = ITEMS.rarity(l.item);
          HUD.toast(`获得 [${rd.name}] ${l.item.name}`, l.item.rarity >= 4 ? 'epic' : l.item.rarity >= 2 ? 'good' : '');
          this.addText(p.x, p.y - 58, `+${l.item.name}`, rd.color);
          AUDIO.play(l.item.rarity >= 4 ? 'upgrade' : 'pickup');
          if (l.item.rarity >= 4) {
            this.effects.push({ type: 'ring', x: p.x, y: p.y - 10, r0: 6, r1: 90, t: 0, dur: 0.8, color: rd.color, width: 3 });
            this.save();
          }
        }
      }
    }
    this.loot = this.loot.filter((l) => !l.picked && l.age < 90);
    if (this.loot.length > 70) this.loot.splice(0, this.loot.length - 70);
  }

  /* ------------------------------ 投射物 ------------------------------ */
  updateProjectiles(dt) {
    const p = this.player;
    for (const pr of this.projectiles) {
      if (pr.dead) continue;
      pr.life -= dt;
      if (pr.life <= 0) {
        pr.dead = true;
        continue;
      }
      if (pr.homing && pr.target && !pr.target.dead) {
        const ang = U.angle(pr.x, pr.y, pr.target.x, pr.target.y - 20);
        pr.vx = Math.cos(ang) * pr.speed;
        pr.vy = Math.sin(ang) * pr.speed;
      }
      const nx = pr.x + pr.vx * dt;
      const ny = pr.y + pr.vy * dt;
      pr.trail.push({ x: pr.x, y: pr.y });
      if (pr.trail.length > 6) pr.trail.shift();
      pr.x = nx;
      pr.y = ny;
      if (WORLD.blocked(this.map, pr.x, pr.y, 4)) {
        pr.dead = true;
        this.projectileBurst(pr.x, pr.y, pr.color);
        continue;
      }

      if (pr.owner === 'player') {
        let hit = null;
        for (const m of this.monsters) {
          if (m.dead) continue;
          if (U.dist(pr.x, pr.y, m.x, m.y - 22) < pr.radius + 20 * m.size) {
            hit = m;
            break;
          }
        }
        if (hit) {
          pr.dead = true;
          const opts = { magic: pr.magic, element: pr.element, skill: true };
          if (pr.aoe) {
            this.effects.push({ type: 'explode', x: pr.x, y: pr.y, r: pr.aoe, t: 0, dur: 0.4, color: pr.color });
            this.burst(pr.x, pr.y, 16, { color: pr.color, speed: 150, size: 2.4, dur: 0.5, glow: true });
            for (const m of this.monsters) {
              if (m.dead) continue;
              if (U.dist(m.x, m.y - 16, pr.x, pr.y) < pr.aoe + 16 * m.size) {
                this.playerHit(m, pr.power, opts);
              }
            }
            AUDIO.play('fire');
            this.shake = Math.max(this.shake, 2.5);
          } else {
            this.playerHit(hit, pr.power, opts);
            this.projectileBurst(pr.x, pr.y, pr.color);
          }
        }
      } else {
        if (!p.dead && U.dist(pr.x, pr.y, p.x, p.y - 24) < pr.radius + 16) {
          pr.dead = true;
          this.projectileBurst(pr.x, pr.y, pr.color);
          this.damagePlayer(pr.source ? pr.source.atk : 10, pr.source, { magic: pr.magic, name: pr.source ? pr.source.def.name : '魔物' });
          if (pr.poisonHit) {
            this.playerPoison = 0;
            // 玩家中毒：以持续伤害 buff 形式表现
            this.addPlayerDot(pr.source ? pr.source.atk * 0.12 : 4);
          }
        }
      }
    }
    this.projectiles = this.projectiles.filter((pr) => !pr.dead);
  }

  projectileBurst(x, y, color) {
    this.burst(x, y, 8, { color: color || '#ffcf9a', speed: 90, size: 2, dur: 0.35, glow: true, shape: 'spark' });
    if (this.effects.length < 70) {
      this.effects.push({ type: 'impact', x, y, t: 0, dur: 0.22, element: 'phys', seed: Math.random() * 6 });
    }
  }

  addPlayerDot(dps) {
    const p = this.player;
    p.dot = { t: 4, dps };
  }

  /* ------------------------------ 玩家受伤 ------------------------------ */
  damagePlayer(raw, source, opts = {}) {
    const p = this.player;
    if (!p || p.dead || p.invuln > 0) return;
    const st = p.stats;
    const def = opts.magic ? st.mdef : st.def;
    let dmg = Math.max(1, raw - def * 0.55);
    let reduce = st.dmgReduce / 100;
    let guard = false;
    if (this.hasUnique(p, 'guard') && U.chance(0.2)) {
      reduce += 0.35;
      guard = true;
    }
    dmg *= 1 - Math.min(0.82, reduce);

    if (p.shield > 0) {
      const absorb = Math.min(p.shield, dmg);
      p.shield -= absorb;
      dmg -= absorb;
    }
    dmg = Math.round(dmg);
    if (dmg <= 0) return;
    p.hp -= dmg;
    p.hitFlash = 0.3;
    p.lastHurtAt = this.time;
    this.hitVignette = Math.min(0.2, this.hitVignette + 0.13);
    this.shake = Math.max(this.shake, 5);
    this.addText(p.x + U.rand(-6, 6), p.y - 64, `-${U.num(dmg)}`, '#ff8070', true);
    AUDIO.play('hurt');

    if (guard) {
      this.addText(p.x, p.y - 82, '守望', '#bfe9ff');
      if (source) this.applyMonsterDamage(source, Math.round(dmg * 0.3), { element: 'holy' });
    }
    if (st.reflect > 0 && source && !source.dead) {
      this.applyMonsterDamage(source, Math.max(1, Math.round(dmg * (st.reflect / 100))), { element: 'phys' });
    }

    if (p.hp <= 0) this.playerDie(source);
  }

  playerDie(source) {
    const p = this.player;
    if (this.trial) {
      const floor = this.trial.floor;
      this.trial = null;
      this._needZoneReset = true;
      HUD.toast(`试炼失败：倒在第 ${floor} 层`, 'bad');
    }
    p.hp = 0;
    p.dead = true;
    p.buffs = [];
    this.attackHeld = false;
    this.target = null;
    AUDIO.play('death');
    this.shake = 12;
    this.effects.push({ type: 'explode', x: p.x, y: p.y - 20, r: 90, t: 0, dur: 0.8, color: '#c03020' });
    const lost = Math.floor(p.gold * 0.1);
    HUD.showDeath(`你被 ${source ? source.def.name : '未知魔物'} 击倒。\n复活将损失 ${U.fmt(lost)} 金币，并回到安全区。`);
    PANELS.hide();
    this.save();
  }

  revive() {
    const p = this.player;
    const lost = Math.floor(p.gold * 0.1);
    p.gold = Math.max(0, p.gold - lost);
    if (this._needZoneReset) {
      this._needZoneReset = false;
      this.enterZone(p.zone, false);
    }
    p.dead = false;
    p.hp = Math.round(p.stats.hp * 0.65);
    p.mp = Math.round(p.stats.mp * 0.5);
    p.shield = p.stats.shield;
    p.invuln = 3;
    p.buffs = [];
    PLAYER.recalc(p, false);
    p.hp = Math.round(p.stats.hp * 0.65);
    p.x = this.map.spawn.x;
    p.y = this.map.spawn.y;
    p.moveTarget = null;
    this.camera.x = p.x;
    this.camera.y = p.y;
    for (const m of this.monsters) {
      if (m.boss || m.remote) continue;
      if (U.dist(m.x, m.y, p.x, p.y) < 460) {
        m.dead = true;
      }
    }
    HUD.hideDeath();
    HUD.toast('你已在安全区复活', 'good');
    this.effects.push({ type: 'teleport', x: p.x, y: p.y, t: 0, dur: 0.8 });
    this.save();
  }

  /* ------------------------------ 状态 / 粒子 ------------------------------ */
  updateRegen(dt) {
    const p = this.player;
    const st = p.stats;
    this.regenTimer += dt;
    if (this.regenTimer >= 1) {
      this.regenTimer -= 1;
      const hpGain = st.hpRegen / 5 + st.hp * (st.hpRegenPct || 0);
      if (hpGain > 0 && p.hp < st.hp) p.hp = Math.min(st.hp, p.hp + hpGain);
      const mpGain = st.mpRegen / 5;
      if (mpGain > 0 && p.mp < st.mp) p.mp = Math.min(st.mp, p.mp + mpGain);
      if (p.shieldMax > 0 && this.time - (p.lastHurtAt || 0) > 4) {
        p.shield = Math.min(p.shieldMax, (p.shield || 0) + p.shieldMax * 0.025);
      }
      if (p.dot && p.dot.t > 0) {
        p.dot.t -= 1;
        p.hp -= p.dot.dps;
        this.addText(p.x, p.y - 58, `-${Math.round(p.dot.dps)}`, '#9ce08a');
        if (p.hp <= 0) this.playerDie(null);
        if (p.dot.t <= 0) p.dot = null;
      }
    }
  }

  updateSpawning(dt) {
    if (this.trial) return;
    this.spawnTimer -= dt;
    const alive = this.monsters.filter((m) => !m.dead && !m.boss && !m.remote).length;
    const targetCount = this.map.zone.spawn || 16;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.6;
      if (alive < targetCount && this.monsters.filter((m) => !m.remote).length < 60) {
        const pos = this.spawnPointNear(this.player.x, this.player.y, 380, 780);
        const def = this.pickMonster(this.map.zone);
        this.spawnMonster(def, pos.x, pos.y, { elite: Math.random() < 0.12 });
      }
    }
    if (!this.bossRef || this.bossRef.dead) {
      if (this.bossRespawn > 0) {
        this.bossRespawn -= dt;
        if (this.bossRespawn <= 0) {
          this.spawnBoss();
        }
      } else if (this.map.boss && !this.bossRef) {
        this.bossRespawn = 80;
      }
    }
  }

  updateEffects(dt) {
    for (const e of this.effects) {
      e.t += dt;
      if (!e.done && e.t >= e.dur) {
        e.done = true;
        if (e.onDone) {
          try {
            e.onDone();
          } catch (err) {
            /* ignore */
          }
        }
      }
    }
    this.effects = this.effects.filter((e) => e.t < e.dur + 0.15);
    if (this.effects.length > 90) this.effects.splice(0, this.effects.length - 90);
  }

  updateParticles(dt) {
    for (const pa of this.particles) {
      pa.t += dt;
      pa.x += pa.vx * dt;
      pa.y += pa.vy * dt;
      if (pa.gravity) pa.vy += pa.gravity * dt;
      pa.vx *= 1 - 1.6 * dt;
      pa.vy *= 1 - 1.6 * dt;
    }
    this.particles = this.particles.filter((pa) => pa.t < pa.dur);
    if (this.particles.length > 380) this.particles.splice(0, this.particles.length - 380);
  }

  updateTexts(dt) {
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter((t) => t.t < t.dur);
    if (this.texts.length > 60) this.texts.splice(0, this.texts.length - 60);
  }

  addText(x, y, text, color, crit = false) {
    this.texts.push({
      x: x + U.rand(-3, 3),
      y,
      text,
      color: color || '#fff',
      crit: !!crit,
      t: 0,
      dur: crit ? 1.0 : 0.8,
    });
  }

  burst(x, y, count, opts = {}) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * U.TAU;
      const spd = (opts.speed || 100) * U.rand(0.35, 1);
      this.particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - (opts.up || 0),
        t: 0,
        dur: (opts.dur || 0.5) * U.rand(0.7, 1.2),
        size: (opts.size || 2) * U.rand(0.7, 1.3),
        color: opts.color || '#ffcf9a',
        glow: !!opts.glow,
        gravity: opts.gravity || 0,
        shape: opts.shape || 'circle',
      });
    }
  }

  updateCamera(dt) {
    const p = this.player;
    const speed = 7.5;
    this.camera.x = U.damp(this.camera.x, p.x, speed, dt);
    this.camera.y = U.damp(this.camera.y, p.y - 10, speed, dt);
    const halfW = RENDER.w / 2 / RENDER.scale;
    const halfH = RENDER.h / 2 / RENDER.scale;
    const mapW = this.map.w * T;
    const mapH = this.map.h * T;
    if (mapW > halfW * 2) this.camera.x = U.clamp(this.camera.x, halfW, mapW - halfW);
    else this.camera.x = mapW / 2;
    if (mapH > halfH * 2) this.camera.y = U.clamp(this.camera.y, halfH, mapH - halfH);
    else this.camera.y = mapH / 2;
  }

  updateBossRef() {
    let boss = null;
    let bd = Infinity;
    for (const m of this.monsters) {
      if (m.dead || !m.boss) continue;
      const d = U.dist(m.x, m.y, this.player.x, this.player.y);
      if (m.provoked || d < 900) {
        if (d < bd) {
          bd = d;
          boss = m;
        }
      }
    }
    this.activeBoss = boss;
  }

  checkLevelFx() {
    const p = this.player;
    if (p.maxLevelUpFx > 0) {
      p.maxLevelUpFx = 0;
      this.save();
    }
  }

  /* ------------------------------ 技能 ------------------------------ */
  useSkill(index) {
    const p = this.player;
    if (!p || p.dead) return;
    const cls = DATA.CLASSES[p.clsId];
    const ids = cls.skills.concat(
      (p.ultimates || []).filter((u) => DATA.ULTIMATES[u] && DATA.ULTIMATES[u].cls === p.clsId)
    );
    const id = ids[index];
    const sk = DATA.SKILLS[id] || DATA.ULTIMATES[id];
    if (!sk) return;
    if ((this.skillCd[id] || 0) > 0) return;
    if (p.mp < sk.mp) {
      HUD.toast('魔法值不足', 'bad');
      return;
    }
    p.mp -= sk.mp;
    this.skillCd[id] = sk.cd;
    AUDIO.play(sk.element === 'fire' ? 'fire' : sk.type === 'buff' || sk.type === 'ultGuard' ? 'heal' : 'skill');

    const magic = p.clsId !== 'warrior';
    const target = this.target && !this.target.dead ? this.target : this.nearestMonster(p.x, p.y, 520);
    if (target) p.facing = target.x >= p.x ? 1 : -1;

    switch (sk.type) {
      case 'meleeStrike': {
        const ang = target ? U.angle(p.x, p.y, target.x, target.y) : p.facing > 0 ? 0 : Math.PI;
        this.effects.push({ type: 'thrust', x: p.x, y: p.y - 24, angle: ang, range: sk.range + 26, t: 0, dur: 0.34 });
        this.shake = Math.max(this.shake, 2.5);
        this.burst(p.x + Math.cos(ang) * 40, p.y - 24 + Math.sin(ang) * 12, 10, {
          color: '#ffe0b0', speed: 130, size: 2.2, dur: 0.34, glow: true, shape: 'spark',
        });
        if (target && U.dist(p.x, p.y, target.x, target.y) < sk.range + 44) {
          this.playerHit(target, sk.power, { skill: true, pen: sk.pen, element: 'phys' });
          target.x += Math.cos(ang) * 10;
          target.y += Math.sin(ang) * 10;
        }
        break;
      }
      case 'meleeArc': {
        const ang = target ? U.angle(p.x, p.y, target.x, target.y) : p.facing > 0 ? 0 : Math.PI;
        this.meleeSwing(sk.range, sk.arc, ang, sk.power, '#ffe0b0', true, {
          effect: 'crescent', element: 'phys', dur: 0.3,
        });
        this.shake = Math.max(this.shake, 3);
        break;
      }
      case 'dash': {
        const ang = target ? U.angle(p.x, p.y, target.x, target.y) : p.facing > 0 ? 0 : Math.PI;
        const startX = p.x;
        const startY = p.y;
        let endX = startX;
        let endY = startY;
        const steps = 12;
        for (let i = 1; i <= steps; i++) {
          const nx = startX + Math.cos(ang) * (sk.dist * i) / steps;
          const ny = startY + Math.sin(ang) * (sk.dist * i) / steps;
          if (WORLD.blocked(this.map, nx, ny, 12)) break;
          endX = nx;
          endY = ny;
        }
        p.x = endX;
        p.y = endY;
        p.dashT = 0.18;
        p.facing = Math.cos(ang) >= 0 ? 1 : -1;
        this.effects.push({ type: 'shockwave', x: startX, y: startY, r: 60, t: 0, dur: 0.42, color: '#ffcf9a' });
        this.effects.push({ type: 'crescent', x: endX, y: endY - 24, angle: ang, arc: 1.6, range: 76, t: 0, dur: 0.28, color: '#ffd9a0', element: 'phys' });
        this.effects.push({ type: 'shockwave', x: endX, y: endY, r: 88, t: 0, dur: 0.5, color: '#ffcf9a' });
        this.burst(startX, startY, 10, { color: '#c0ad92', speed: 110, size: 3.4, dur: 0.6, shape: 'smoke' });
        this.burst(endX, endY - 20, 16, { color: '#ffe0b0', speed: 180, size: 2.4, dur: 0.45, glow: true, shape: 'spark' });
        for (const m of this.monsters) {
          if (m.dead) continue;
          if (U.dist(m.x, m.y, endX, endY) < 68 + m.size * 12) {
            this.playerHit(m, sk.power, { skill: true, element: 'phys', stunFixed: sk.stun });
          }
        }
        this.shake = Math.max(this.shake, 4);
        break;
      }
      case 'novaBuff': {
        this.effects.push({ type: 'fireNova', x: p.x, y: p.y - 6, r: sk.radius, t: 0, dur: 0.75, element: 'fire' });
        this.burst(p.x, p.y - 18, 30, {
          color: '#ff8a3c', speed: 190, size: 2.6, dur: 0.75, glow: true, shape: 'ember', up: 45,
        });
        this.burst(p.x, p.y - 10, 10, { color: '#5a4a3a', speed: 90, size: 4, dur: 0.8, shape: 'smoke' });
        for (const m of this.monsters) {
          if (m.dead) continue;
          if (U.dist(m.x, m.y, p.x, p.y) < sk.radius) {
            this.playerHit(m, sk.power, { skill: true, element: 'fire' });
            m.burn = { t: 4, tick: 0.5, dps: Math.max(6, this.player.stats.atk * 0.3) };
          }
        }
        PLAYER.addBuff(p, {
          id: 'flame',
          name: sk.buff.name,
          icon: sk.buff.icon,
          dur: sk.buff.dur,
          stats: { atkMul: sk.buff.atkMul },
        });
        this.addText(p.x, p.y - 84, '烈火附体', '#ffb06a', true);
        this.shake = Math.max(this.shake, 5);
        break;
      }
      case 'projectile': {
        const ang = target ? U.angle(p.x, p.y, target.x, target.y) : p.facing > 0 ? 0 : Math.PI;
        const talisman = sk.id === 'soulfire';
        this.spawnPlayerProjectile({
          x: p.x + Math.cos(ang) * 20,
          y: p.y - 26 + Math.sin(ang) * 10,
          angle: ang,
          speed: sk.speed || 420,
          power: sk.power,
          color: sk.color || '#ff9a4a',
          magic: true,
          radius: 9,
          homing: !!sk.homing,
          element: sk.element || 'phys',
          aoe: sk.radius || 0,
          target: sk.homing ? target : null,
          extra: talisman ? { talisman: true } : null,
        });
        this.effects.push({ type: 'ring', x: p.x, y: p.y - 4, r0: 6, r1: 34, t: 0, dur: 0.32, color: sk.color || '#ff9a4a', element: sk.element });
        this.burst(p.x + Math.cos(ang) * 22, p.y - 26 + Math.sin(ang) * 8, 8, {
          color: sk.color || '#ff9a4a', speed: 90, size: 2.2, dur: 0.35, glow: true, shape: 'ember',
        });
        break;
      }
      case 'chain': {
        const visited = new Set();
        let from = { x: p.x, y: p.y - 30 };
        let current = this.nearestMonster(p.x, p.y, sk.range);
        for (let i = 0; i < sk.jumps && current; i++) {
          visited.add(current);
          const pts = this.jaggedLine(from.x, from.y, current.x, current.y - 26, 7);
          this.effects.push({ type: 'lightning', points: pts, t: 0, dur: 0.28 });
          this.effects.push({ type: 'impact', x: current.x, y: current.y - 26, t: 0, dur: 0.26, element: 'bolt', seed: Math.random() * 6 });
          this.burst(current.x, current.y - 26, 10, {
            color: '#bfe9ff', speed: 160, size: 2, dur: 0.4, glow: true, shape: 'spark',
          });
          this.playerHit(current, sk.power * Math.pow(0.85, i), { skill: true, magic: true, element: 'holy' });
          if (!current.dead) current.freeze = Math.max(current.freeze || 0, 0.25);
          from = { x: current.x, y: current.y - 26 };
          let next = null;
          let nd = 240 * 240;
          for (const m of this.monsters) {
            if (m.dead || visited.has(m)) continue;
            const d = U.dist2(m.x, m.y, from.x, from.y);
            if (d < nd) {
              nd = d;
              next = m;
            }
          }
          current = next;
        }
        this.shake = Math.max(this.shake, 3);
        break;
      }
      case 'aoe': {
        const px = target ? target.x : p.x + p.facing * 90;
        const py = target ? target.y : p.y;
        this.effects.push({ type: 'frost', x: px, y: py, r: sk.radius, t: 0, dur: 0.8, element: 'ice' });
        this.burst(px, py, 26, { color: '#bfeaff', speed: 170, size: 2.6, dur: 0.7, glow: true, shape: 'shard' });
        for (const m of this.monsters) {
          if (m.dead) continue;
          if (U.dist(m.x, m.y, px, py) < sk.radius + m.size * 10) {
            this.playerHit(m, sk.power, { skill: true, magic: true, element: 'ice' });
            m.freeze = Math.max(m.freeze, sk.freeze || 1.5);
          }
        }
        AUDIO.play('ice');
        this.shake = Math.max(this.shake, 4);
        break;
      }
      case 'buff': {
        const stats = {};
        if (sk.buff.atkMul) stats.atkMul = sk.buff.atkMul;
        if (sk.buff.defMul) stats.defMul = sk.buff.defMul;
        if (sk.buff.mdefMul) stats.mdefMul = sk.buff.mdefMul;
        if (sk.buff.dmgReduce) stats.dmgReduce = sk.buff.dmgReduce;
        if (sk.buff.hpRegenPct) stats.hpRegenPct = sk.buff.hpRegenPct;
        PLAYER.addBuff(p, {
          id: sk.id,
          name: sk.buff.name,
          icon: sk.buff.icon,
          dur: sk.buff.dur,
          stats,
          shieldPct: sk.buff.shieldPct || 0,
        });
        this.effects.push({ type: sk.id === 'armor' ? 'holyRune' : 'shieldRune', x: p.x, y: p.y - 4, t: 0, dur: 0.65 });
        this.effects.push({ type: 'ring', x: p.x, y: p.y - 4, r0: 8, r1: 62, t: 0, dur: 0.55, color: sk.id === 'armor' ? '#ffe08a' : '#8fd8ff', width: 3, element: sk.id === 'armor' ? 'holy' : 'bolt' });
        this.addText(p.x, p.y - 84, sk.buff.name, '#bfe9ff');
        break;
      }
      case 'poisonAoe': {
        const px = target ? target.x : p.x;
        const py = target ? target.y : p.y;
        this.effects.push({ type: 'poison', x: px, y: py, r: sk.radius, t: 0, dur: 0.85, element: 'poison' });
        for (const m of this.monsters) {
          if (m.dead) continue;
          if (U.dist(m.x, m.y, px, py) < sk.radius) {
            this.playerHit(m, 0.6, { skill: true, magic: true, element: 'poison' });
            m.poison = { t: sk.dur, tick: 0.5, dps: Math.max(6, p.stats.matk * (sk.power + 0.15)) };
          }
        }
        this.burst(px, py, 16, { color: '#9ce08a', speed: 80, size: 2.2, dur: 0.7, glow: true, shape: 'bubble', up: 26 });
        break;
      }
      case 'heal': {
        const healMul = this.trial ? this.trial.cfg.healMul : 1;
        const heal = Math.round(p.stats.hp * sk.pct * healMul);
        PLAYER.heal(p, heal);
        this.addText(p.x, p.y - 62, `+${U.num(heal)}`, '#8ce69a', true);
        this.effects.push({ type: 'heal', x: p.x, y: p.y - 26, t: 0, dur: 0.8 });
        this.burst(p.x, p.y - 10, 14, { color: '#8cffae', speed: 60, size: 2.2, dur: 0.9, glow: true, up: 40, shape: 'ember' });
        PLAYER.addBuff(p, {
          id: 'healhot',
          name: '治愈',
          icon: '愈',
          dur: 4,
          stats: { hpRegenPct: (sk.hot || 0) / 4 },
        });
        AUDIO.play('heal');
        break;
      }
      case 'ultDash': {
        const ang = target ? U.angle(p.x, p.y, target.x, target.y) : p.facing > 0 ? 0 : Math.PI;
        const sx = p.x;
        const sy = p.y;
        let ex = sx;
        let ey = sy;
        const steps = 20;
        for (let i = 1; i <= steps; i++) {
          const nx = sx + (Math.cos(ang) * sk.dist * i) / steps;
          const ny = sy + (Math.sin(ang) * sk.dist * i) / steps;
          if (WORLD.blocked(this.map, nx, ny, 12)) break;
          ex = nx;
          ey = ny;
        }
        const dx = ex - sx;
        const dy = ey - sy;
        const len2 = dx * dx + dy * dy || 1;
        for (const m of this.monsters) {
          if (m.dead) continue;
          const t = U.clamp(((m.x - sx) * dx + (m.y - sy) * dy) / len2, 0, 1);
          if (U.dist(m.x, m.y, sx + dx * t, sy + dy * t) < 70 + m.size * 14) {
            this.playerHit(m, sk.power, { skill: true, element: 'phys', stunFixed: sk.stun });
          }
        }
        p.x = ex;
        p.y = ey;
        p.dashT = 0.32;
        p.facing = Math.cos(ang) >= 0 ? 1 : -1;
        this.effects.push({ type: 'shockwave', x: sx, y: sy, r: 54, t: 0, dur: 0.45, color: '#ff5a3c' });
        for (let i = 1; i <= 5; i++) {
          const t = i / 5;
          this.effects.push({
            type: 'crescent',
            x: U.lerp(sx, ex, t),
            y: U.lerp(sy, ey, t) - 24,
            angle: ang, arc: 1.5, range: 84, t: 0, dur: 0.28,
            color: i === 5 ? '#ffd27a' : '#ff8a5c', element: 'phys',
          });
        }
        this.effects.push({ type: 'shockwave', x: ex, y: ey, r: 120, t: 0, dur: 0.6, color: '#ff6a3c' });
        this.burst(ex, ey - 20, 34, { color: '#ff8a5c', speed: 240, size: 3, dur: 0.7, glow: true, shape: 'spark' });
        this.burst(sx, sy - 10, 14, { color: '#c0ad92', speed: 130, size: 3.6, dur: 0.7, shape: 'smoke' });
        this.addText(p.x, p.y - 92, sk.name, '#ff9a6a', true);
        this.shake = Math.max(this.shake, 10);
        break;
      }
      case 'ultArc': {
        const ang = target ? U.angle(p.x, p.y, target.x, target.y) : p.facing > 0 ? 0 : Math.PI;
        for (let i = 0; i < sk.hits; i++) {
          const off = (i - (sk.hits - 1) / 2) * 0.2;
          this.meleeSwing(sk.range, sk.arc, ang + off, sk.power, i === sk.hits - 1 ? '#ffd27a' : '#ffb066', true, {
            effect: 'crescent', element: 'fire', dur: 0.34, pen: sk.pen,
          });
        }
        for (const m of this.monsters) {
          if (m.dead) continue;
          const d = U.dist(p.x, p.y - 20, m.x, m.y - 20);
          if (d > sk.range + m.size * 20) continue;
          const a = U.angle(p.x, p.y - 20, m.x, m.y - 20);
          if (Math.abs(U.angleDiff(ang, a)) > sk.arc / 2 && d > 32) continue;
          m.burn = { t: 5, tick: 0.5, dps: Math.max(8, p.stats.atk * 0.45) };
        }
        this.effects.push({
          type: 'fireNova', x: p.x + Math.cos(ang) * 90, y: p.y - 10 + Math.sin(ang) * 40,
          r: 150, t: 0, dur: 0.8, element: 'fire',
        });
        this.addText(p.x, p.y - 92, sk.name, '#ffcf7a', true);
        this.shake = Math.max(this.shake, 9);
        break;
      }
      case 'ultMeteor': {
        const cx = target ? target.x : p.x + p.facing * 150;
        const cy = target ? target.y : p.y;
        const hitCount = new Map();
        for (let i = 0; i < sk.meteors; i++) {
          const a = Math.random() * U.TAU;
          const r = Math.sqrt(Math.random()) * sk.radius;
          const mx = cx + Math.cos(a) * r;
          const my = cy + Math.sin(a) * r;
          this.effects.push({ type: 'impact', x: mx, y: my, t: 0, dur: 0.4, element: 'fire', seed: Math.random() * 6 });
          this.effects.push({ type: 'ring', x: mx, y: my, r0: 8, r1: 48, t: 0, dur: 0.4, color: '#ff8a3c', width: 2, element: 'fire' });
          this.burst(mx, my - 6, 12, { color: '#ff9a4a', speed: 150, size: 2.6, dur: 0.5, glow: true, shape: 'ember', up: 40 });
          for (const m of this.monsters) {
            if (m.dead) continue;
            if (U.dist(m.x, m.y, mx, my) > 62 + m.size * 10) continue;
            const n = hitCount.get(m) || 0;
            if (n >= 3) continue;
            hitCount.set(m, n + 1);
            this.playerHit(m, sk.power, { skill: true, magic: true, element: 'fire' });
            m.burn = { t: 5, tick: 0.5, dps: Math.max(8, p.stats.matk * 0.5) };
          }
        }
        this.effects.push({ type: 'fireNova', x: cx, y: cy - 6, r: sk.radius, t: 0, dur: 0.9, element: 'fire' });
        this.addText(cx, cy - 110, sk.name, '#ff9a5c', true);
        this.shake = Math.max(this.shake, 9);
        break;
      }
      case 'ultBeam': {
        const ang = target ? U.angle(p.x, p.y, target.x, target.y) : p.facing > 0 ? 0 : Math.PI;
        const ex = p.x + Math.cos(ang) * sk.range;
        const ey = p.y + Math.sin(ang) * sk.range;
        for (let i = 1; i <= 9; i++) {
          const t = i / 9;
          const x = U.lerp(p.x, ex, t);
          const y = U.lerp(p.y, ey, t) - 20;
          this.effects.push({ type: 'frost', x, y, r: 44, t: 0, dur: 0.7, element: 'ice' });
          this.burst(x, y, 6, { color: '#bfeaff', speed: 130, size: 2.4, dur: 0.55, glow: true, shape: 'shard' });
        }
        const dx = ex - p.x;
        const dy = ey - p.y;
        const len2 = dx * dx + dy * dy || 1;
        for (const m of this.monsters) {
          if (m.dead) continue;
          const t = U.clamp(((m.x - p.x) * dx + (m.y - p.y) * dy) / len2, 0, 1);
          if (U.dist(m.x, m.y, p.x + dx * t, p.y + dy * t) < sk.width + m.size * 12) {
            this.playerHit(m, sk.power, { skill: true, magic: true, element: 'ice' });
            m.freeze = Math.max(m.freeze || 0, sk.freeze);
          }
        }
        this.addText(p.x, p.y - 92, sk.name, '#bfeaff', true);
        this.shake = Math.max(this.shake, 8);
        break;
      }
      case 'ultSwamp': {
        const cx = target ? target.x : p.x;
        const cy = target ? target.y : p.y;
        this.effects.push({ type: 'poison', x: cx, y: cy, r: sk.radius, t: 0, dur: 1.6, element: 'poison' });
        this.effects.push({ type: 'ring', x: cx, y: cy, r0: 10, r1: sk.radius, t: 0, dur: 0.9, color: '#7ad86a', width: 3, element: 'poison' });
        let total = 0;
        for (const m of this.monsters) {
          if (m.dead) continue;
          if (U.dist(m.x, m.y, cx, cy) > sk.radius + m.size * 12) continue;
          total += this.playerHit(m, sk.power, { skill: true, magic: true, element: 'poison' });
          m.poison = { t: sk.dur, tick: 0.5, dps: Math.max(8, p.stats.matk * 1.1) };
          m.freeze = Math.max(m.freeze || 0, 0.8);
        }
        const heal = Math.round(total * sk.lifesteal);
        if (heal > 0) {
          PLAYER.heal(p, heal);
          this.addText(p.x, p.y - 62, `+${U.num(heal)}`, '#8ce69a', true);
        }
        this.burst(cx, cy - 8, 26, { color: '#9ce08a', speed: 90, size: 3, dur: 0.9, glow: true, shape: 'bubble', up: 30 });
        this.addText(cx, cy - 110, sk.name, '#9ce08a', true);
        this.shake = Math.max(this.shake, 6);
        break;
      }
      case 'ultGuard': {
        const heal = Math.round(p.stats.hp * sk.healPct * (this.trial ? this.trial.cfg.healMul : 1));
        PLAYER.heal(p, heal);
        PLAYER.addBuff(p, {
          id: 'tiangang',
          name: sk.name,
          icon: sk.icon,
          dur: sk.dur,
          stats: {
            dmgReduce: sk.dmgReduce,
            defMul: sk.defMul,
            mdefMul: sk.mdefMul,
            reflect: sk.reflect,
            hpRegenPct: sk.regen,
          },
          shieldPct: sk.shieldPct,
        });
        this.effects.push({ type: 'holyRune', x: p.x, y: p.y - 4, t: 0, dur: 0.9 });
        this.effects.push({ type: 'shieldRune', x: p.x, y: p.y - 4, t: 0, dur: 0.9 });
        this.effects.push({ type: 'ring', x: p.x, y: p.y - 4, r0: 10, r1: 120, t: 0, dur: 0.9, color: '#ffe08a', width: 4, element: 'holy' });
        this.burst(p.x, p.y - 24, 26, { color: '#ffe08a', speed: 140, size: 2.6, dur: 0.9, glow: true, up: 50 });
        this.addText(p.x, p.y - 92, sk.name, '#ffe08a', true);
        this.shake = Math.max(this.shake, 5);
        break;
      }
      default:
        break;
    }
    this.saveTimer = Math.max(this.saveTimer, 10);
  }

  jaggedLine(x1, y1, x2, y2, segs) {
    const pts = [{ x: x1, y: y1 }];
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const nx = U.lerp(x1, x2, t) + U.rand(-10, 10);
      const ny = U.lerp(y1, y2, t) + U.rand(-10, 10);
      pts.push({ x: nx, y: ny });
    }
    pts.push({ x: x2, y: y2 });
    return pts;
  }

  hasUnique(p, id) {
    for (const slot in p.equip) {
      const it = p.equip[slot];
      if (it && it.uniqueId === id) return true;
    }
    return false;
  }

  /* ------------------------------ 系统操作 ------------------------------ */
  usePotion(kind) {
    const p = this.player;
    if (!p || p.dead) return;
    if (this.potionCd[kind] > 0) return;
    if ((p.potions[kind] || 0) <= 0) {
      HUD.toast(kind === 'hp' ? '没有金创药了' : '没有魔法药了', 'bad');
      return;
    }
    const def = DATA.POTIONS[kind];
    p.potions[kind] -= 1;
    this.potionCd[kind] = def.cd;
    if (kind === 'hp') {
      const healMul = this.trial ? this.trial.cfg.healMul : 1;
      const healed = PLAYER.heal(p, p.stats.hp * def.pct * healMul);
      this.addText(p.x, p.y - 60, `+${U.num(healed)}`, '#8ce69a', true);
      this.effects.push({ type: 'heal', x: p.x, y: p.y - 20, t: 0, dur: 0.5 });
    } else {
      const got = PLAYER.restoreMp(p, p.stats.mp * def.pct);
      this.addText(p.x, p.y - 60, `+${U.num(got)} 魔法`, '#8fd8ff');
    }
    AUDIO.play('pickup');
  }

  moveTo(x, y, quiet = false) {
    const p = this.player;
    if (!p || p.dead) return false;
    const path = WORLD.findPath(this.map, p.x, p.y, x, y, 15);
    if (!path || !path.length) {
      if (!WORLD.blocked(this.map, x, y, 12)) {
        p.movePath = [{ x, y }];
        p.moveTarget = { x, y };
        p.chasePath = null;
        this.target = null;
        this.tapChase = 0;
        return true;
      }
      if (!quiet) HUD.toast('那里无法到达', 'bad');
      return false;
    }
    p.movePath = path;
    p.moveTarget = { x, y };
    p.chasePath = null;
    p.facing = path[0].x >= p.x ? 1 : -1;
    this.target = null;
    this.tapChase = 0;
    return true;
  }

  travel(zoneId) {
    const p = this.player;
    const zone = DATA.ZONES.find((z) => z.id === zoneId);
    if (!zone || zone.id === p.zone) return;
    if (p.level < zone.req) {
      HUD.toast(`需要 Lv.${zone.req} 才能进入 ${zone.name}`, 'bad');
      return;
    }
    this.enterZone(zone.id, false);
    this.save();
    PANELS.refresh();
  }

  tryEquip(uid) {
    const p = this.player;
    const found = PLAYER.findItem(p, uid);
    if (!found || found.equipped) return;
    const before = PLAYER.power(p);
    const res = PLAYER.equip(p, found.item);
    if (!res.ok) {
      if (res.reason === 'level') HUD.toast(`需要等级 Lv.${found.item.req}`, 'bad');
      else HUD.toast('无法装备', 'bad');
      return;
    }
    HUD.toast(`已装备 ${found.item.name}`, 'good');
    AUDIO.play('upgrade');
    this.save();
    PANELS.refresh();
  }

  tryUnequip(slotId) {
    const p = this.player;
    const res = PLAYER.unequip(p, slotId);
    if (!res.ok) {
      if (res.reason === 'bag') HUD.toast('背包已满，无法卸下', 'bad');
      return;
    }
    HUD.toast(`已卸下 ${res.item.name}`);
    AUDIO.play('ui');
    this.save();
    PANELS.refresh();
  }

  trySalvage(uid) {
    const p = this.player;
    const found = PLAYER.findItem(p, uid);
    if (!found || found.equipped) return;
    const item = PLAYER.removeItem(p, uid);
    if (!item) return;
    const gold = ITEMS.salvageValue(item);
    const essence = ITEMS.salvageEssence(item);
    p.gold += gold;
    p.essence = (p.essence || 0) + essence;
    SYSTEMS.bountyProgress(p, 'salvage', 1);
    HUD.toast(`分解 ${item.name}，获得 ${gold} 金币 · ${essence} 精粹`, 'good');
    AUDIO.play('coin');
    this.save();
    PANELS.refresh();
  }

  tryUpgrade(uid) {
    const p = this.player;
    const found = PLAYER.findItem(p, uid);
    if (!found) return;
    const item = found.item;
    if (item.upgrade >= 15) {
      HUD.toast('已达到最高强化等级', 'bad');
      return;
    }
    const cost = ITEMS.upgradeCost(item);
    if (p.gold < cost) {
      HUD.toast(`金币不足，需要 ${U.fmt(cost)}`, 'bad');
      return;
    }
    p.gold -= cost;
    const res = ITEMS.attemptUpgrade(item);
    if (found.equipped) PLAYER.recalc(p, true);
    if (res.ok) {
      HUD.toast(`强化成功！${item.name} +${item.upgrade}`, 'epic');
      SYSTEMS.bountyProgress(p, 'upgrade', 1);
      AUDIO.play('upgrade');
      this.effects.push({ type: 'ring', x: p.x, y: p.y - 6, r0: 6, r1: 70, t: 0, dur: 0.6, color: '#ffd27a', width: 3 });
    } else {
      HUD.toast(res.downgraded ? `强化失败，${item.name} 降至 +${item.upgrade}` : '强化失败，装备未受损', 'bad');
      AUDIO.play('fail');
    }
    this.save();
    PANELS.refresh();
  }

  tryReroll(uid) {
    const p = this.player;
    const found = PLAYER.findItem(p, uid);
    if (!found) return;
    const item = found.item;
    if (!item.affixes.length) {
      HUD.toast('该装备没有可洗练的特殊参数', 'bad');
      return;
    }
    const cost = ITEMS.rerollCost(item);
    if (p.gold < cost) {
      HUD.toast(`金币不足，需要 ${U.fmt(cost)}`, 'bad');
      return;
    }
    p.gold -= cost;
    ITEMS.reroll(item);
    if (found.equipped) PLAYER.recalc(p, true);
    HUD.toast('洗练完成，特殊参数已重铸', 'epic');
    AUDIO.play('upgrade');
    this.save();
    PANELS.refresh();
  }

  sortBag() {
    const p = this.player;
    p.bag.sort((a, b) => b.rarity - a.rarity || ITEMS.power(b) - ITEMS.power(a));
    AUDIO.play('ui');
    PANELS.refresh();
  }

  // 按品级分解：rarity 为精确品级
  salvageRarity(rarity) {
    const p = this.player;
    const list = p.bag.filter((it) => it.rarity === rarity);
    if (!list.length) {
      HUD.toast(`背包里没有${DATA.RARITIES[rarity] ? DATA.RARITIES[rarity].name : ''}装备`, 'bad');
      return;
    }
    const gold = list.reduce((sum, it) => sum + ITEMS.salvageValue(it), 0);
    const essence = list.reduce((sum, it) => sum + ITEMS.salvageEssence(it), 0);
    const keep = new Set(list.map((it) => it.uid));
    p.bag = p.bag.filter((it) => !keep.has(it.uid));
    p.gold += gold;
    p.essence = (p.essence || 0) + essence;
    SYSTEMS.bountyProgress(p, 'salvage', list.length);
    HUD.toast(`分解 ${list.length} 件${DATA.RARITIES[rarity].name}装备，获得 ${U.fmt(gold)} 金币 · ${essence} 精粹`, 'good');
    AUDIO.play('coin');
    this.save();
    PANELS.refresh();
  }

  /* ------------------------------ 悬赏 / 锻造 / 转生 ------------------------------ */
  mergeUltBook() {
    const p = this.player;
    const cost = DATA.ULTIMATE_FRAG_COST;
    const all = DATA.CLASSES[p.clsId].ultimates || [];
    if ((p.ultimates || []).length >= all.length) {
      HUD.toast('已习得本职业全部终极技能', 'bad');
      return;
    }
    if ((p.skillFrags || 0) < cost) {
      HUD.toast(`技能书碎片不足，需要 ${cost}（当前 ${p.skillFrags || 0}）`, 'bad');
      return;
    }
    p.skillFrags -= cost;
    p.ultBooks = (p.ultBooks || 0) + 1;
    HUD.toast(`合成终极技能书 ×1（剩余碎片 ${p.skillFrags}）`, 'epic');
    AUDIO.play('upgrade');
    this.effects.push({ type: 'ring', x: p.x, y: p.y - 6, r0: 8, r1: 96, t: 0, dur: 0.7, color: '#c9a6ff', width: 3 });
    this.effects.push({ type: 'levelup', x: p.x, y: p.y, t: 0, dur: 0.8 });
    this.save();
    PANELS.refresh();
  }

  learnUltimate(id) {
    const p = this.player;
    const sk = DATA.ULTIMATES[id];
    if (!sk || sk.cls !== p.clsId) return;
    if ((p.ultimates || []).includes(id)) return;
    if (!(p.ultBooks > 0)) {
      HUD.toast('需要一本终极技能书', 'bad');
      return;
    }
    p.ultBooks -= 1;
    p.ultimates = [...(p.ultimates || []), id].slice(0, 2);
    HUD.toast(`习得终极技能【${sk.name}】`, 'epic');
    AUDIO.play('level');
    this.effects.push({ type: 'levelup', x: p.x, y: p.y, t: 0, dur: 1.0 });
    this.effects.push({ type: 'ring', x: p.x, y: p.y - 6, r0: 10, r1: 130, t: 0, dur: 0.9, color: '#ffd27a', width: 4 });
    this.save();
    PANELS.refresh();
  }

  claimBounty(id) {
    const p = this.player;
    const t = p.bounty && p.bounty.tasks.find((q) => q.id === id);
    if (!t || t.claimed || t.prog < t.need) return;
    t.claimed = true;
    const r = t.reward || {};
    p.gold += r.gold || 0;
    p.essence = (p.essence || 0) + (r.essence || 0);
    if (r.potion) {
      p.potions.hp += r.potion.hp || 0;
      p.potions.mp += r.potion.mp || 0;
    }
    HUD.toast(`悬赏完成：${t.title} · +${U.fmt(r.gold || 0)} 金币 · +${r.essence || 0} 精粹`, 'epic');
    AUDIO.play('upgrade');
    this.save();
    PANELS.refresh();
  }

  refreshBounty() {
    const p = this.player;
    p.bounty = SYSTEMS.rollBounty(p);
    HUD.toast('悬赏榜已刷新，新的悬赏已张贴', 'good');
    AUDIO.play('ui');
    this.save();
    PANELS.refresh();
  }

  fuseItem(uid) {
    const p = this.player;
    const found = PLAYER.findItem(p, uid);
    if (!found || found.equipped) return;
    const base = found.item;
    if (base.rarity >= 5) {
      HUD.toast('神话装备已是最高品级', 'bad');
      return;
    }
    const partner = SYSTEMS.findFusePartner(p, base);
    if (!partner) {
      HUD.toast('需要另一件同部位、同品级的装备', 'bad');
      return;
    }
    const cost = SYSTEMS.fuseCost(base);
    if (p.gold < cost) {
      HUD.toast(`金币不足，合成需要 ${U.fmt(cost)}`, 'bad');
      return;
    }
    p.gold -= cost;
    PLAYER.removeItem(p, base.uid);
    PLAYER.removeItem(p, partner.uid);
    const item = ITEMS.fuseResult(base, partner, Math.max(base.level, partner.level));
    PLAYER.addItem(p, item);
    HUD.toast(`合成成功：[${ITEMS.rarity(item).name}] ${item.name}`, 'epic');
    AUDIO.play('upgrade');
    this.save();
    PANELS.refresh();
  }

  fuseAll() {
    const p = this.player;
    let made = 0;
    let spent = 0;
    for (let guard = 0; guard < 300; guard++) {
      const pairs = SYSTEMS.fuseCandidates(p);
      if (!pairs.length) break;
      let did = false;
      for (const [a, b] of pairs) {
        const cost = SYSTEMS.fuseCost(a);
        if (p.gold < cost) continue;
        p.gold -= cost;
        spent += cost;
        PLAYER.removeItem(p, a.uid);
        PLAYER.removeItem(p, b.uid);
        PLAYER.addItem(p, ITEMS.fuseResult(a, b, Math.max(a.level, b.level)));
        made += 1;
        did = true;
        break;
      }
      if (!did) break;
    }
    if (!made) {
      HUD.toast('没有可合成的同部位同品级装备', 'bad');
      return;
    }
    HUD.toast(`一键合成 ${made} 件，消耗 ${U.fmt(spent)} 金币`, 'epic');
    AUDIO.play('upgrade');
    this.save();
    PANELS.refresh();
  }

  craftItem(slotId, rarity) {
    const p = this.player;
    const entry = SYSTEMS.craftEntry(rarity);
    if (!entry) return;
    if (p.level < entry.levelReq) {
      HUD.toast(`打造 ${DATA.RARITIES[rarity].name} 需要 Lv.${entry.levelReq}`, 'bad');
      return;
    }
    if ((p.essence || 0) < entry.essence) {
      HUD.toast(`精粹不足，需要 ${entry.essence}`, 'bad');
      return;
    }
    if (p.gold < entry.gold) {
      HUD.toast(`金币不足，需要 ${U.fmt(entry.gold)}`, 'bad');
      return;
    }
    if (p.bag.length >= DATA.BAG_SIZE) {
      HUD.toast('背包已满', 'bad');
      return;
    }
    p.essence -= entry.essence;
    p.gold -= entry.gold;
    const item = ITEMS.generate({
      level: p.level,
      slot: slotId,
      rarity,
      clsKind: DATA.CLASSES[p.clsId].weaponKind,
      clsId: p.clsId,
      setChance: 0.45,
    });
    PLAYER.addItem(p, item);
    HUD.toast(`打造出 [${ITEMS.rarity(item).name}] ${item.name}`, 'epic');
    AUDIO.play('upgrade');
    this.save();
    PANELS.refresh();
  }

  rebirth() {
    const p = this.player;
    if ((p.rebirth || 0) >= DATA.REBIRTH.max) {
      HUD.toast('已达到最高转生次数', 'bad');
      return;
    }
    if (p.level < DATA.REBIRTH.levelReq) {
      HUD.toast(`需要 Lv.${DATA.REBIRTH.levelReq} 才能转生`, 'bad');
      return;
    }
    const cost = SYSTEMS.rebirthCost(p);
    if (p.gold < cost) {
      HUD.toast(`转生需要 ${U.fmt(cost)} 金币`, 'bad');
      return;
    }
    p.gold -= cost;
    p.rebirth = (p.rebirth || 0) + 1;
    p.level = 1;
    p.exp = 0;
    p.towerFloor = 1;
    p.buffs = [];
    PLAYER.recalc(p, false);
    p.hp = p.stats.hp;
    p.mp = p.stats.mp;
    p.shield = p.stats.shield;
    p.zone = 'bichi';
    this.enterZone('bichi', false);
    HUD.toast(`第 ${p.rebirth} 转成功！永久全属性 +${Math.round(p.rebirth * DATA.REBIRTH.bonus * 100)}%`, 'epic');
    AUDIO.play('level');
    this.save();
    PANELS.refresh();
  }

  // 捡到装备时自动回收低品级；比身上更强、且背包里还没有更好的会留下
  autoSalvageItem(item) {
    const p = this.player;
    const max = p.autoSalvage;
    if (!(max >= 0) || item.rarity > max) return false;
    if (PLAYER.powerDelta(p, item) > 0) {
      const bestInBag = p.bag.reduce(
        (best, it) => (it.slot === item.slot ? Math.max(best, ITEMS.power(it)) : best),
        0
      );
      if (ITEMS.power(item) > bestInBag) return false;
    }
    const gold = ITEMS.salvageValue(item);
    p.gold += gold;
    p.essence = (p.essence || 0) + ITEMS.salvageEssence(item);
    SYSTEMS.bountyProgress(p, 'salvage', 1);
    this._salvageBatch = this._salvageBatch || { count: 0, gold: 0 };
    this._salvageBatch.count += 1;
    this._salvageBatch.gold += gold;
    if (this._autoSalvageMsg <= 0) {
      this._autoSalvageMsg = 2;
      HUD.toast(`自动回收 ${this._salvageBatch.count} 件 · +${U.fmt(this._salvageBatch.gold)} 金币`, 'good');
      this._salvageBatch = { count: 0, gold: 0 };
    }
    return true;
  }

  toggleAutoPickup() {
    const p = this.player;
    p.autoPickup = p.autoPickup === false;
    HUD.toast(p.autoPickup ? '自动拾取：开' : '自动拾取：关', p.autoPickup ? 'good' : '');
    AUDIO.play('ui');
    this.save();
    PANELS.refresh();
  }

  toggleAutoPotion() {
    const p = this.player;
    p.autoPotion = p.autoPotion === false;
    HUD.toast(p.autoPotion ? '自动喝药：开' : '自动喝药：关', p.autoPotion ? 'good' : '');
    AUDIO.play('ui');
    this.save();
    PANELS.refresh();
  }

  cycleAutoSalvage() {
    const p = this.player;
    const next = (p.autoSalvage == null ? -1 : p.autoSalvage) + 1;
    p.autoSalvage = next > 4 ? -1 : next;
    const text = p.autoSalvage < 0
      ? '自动回收：关'
      : `自动回收 ≤ ${DATA.RARITIES[p.autoSalvage].name}`;
    HUD.toast(text, p.autoSalvage >= 0 ? 'good' : '');
    AUDIO.play('ui');
    this.save();
    PANELS.refresh();
  }

  toggleAuto() {
    const p = this.player;
    p.auto = !p.auto;
    HUD.toast(p.auto ? '自动战斗：开' : '自动战斗：关');
    AUDIO.play('ui');
    if (!p.auto) this.target = null;
    this.save();
  }

  toggleSound() {
    const p = this.player;
    p.sound = !p.sound;
    AUDIO.setEnabled(p.sound);
    HUD.toast(p.sound ? '音效：开' : '音效：关');
    this.save();
  }

  setAttackHeld(v) {
    this.attackHeld = !!v;
  }

  save() {
    if (!this.player) return;
    this.ensureBounty();
    try {
      localStorage.setItem(DATA.SAVE_KEY, JSON.stringify({ v: DATA.VERSION, p: PLAYER.serialize(this.player) }));
    } catch (e) {
      /* 存储失败时静默，避免影响游戏 */
    }
  }

  clearSave() {
    try {
      localStorage.removeItem(DATA.SAVE_KEY);
    } catch (e) {
      /* ignore */
    }
  }
}
