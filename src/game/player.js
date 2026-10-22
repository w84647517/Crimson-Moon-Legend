import { U } from '../core/util.js';
import { DATA } from '../data/gamedata.js';
import { ITEMS } from './items.js';

const PERCENT_STATS = new Set([
  'crit', 'critDmg', 'pen', 'lifesteal', 'reflect', 'stun', 'freeze', 'poison', 'burn',
  'atkSpeed', 'moveSpeed', 'dropRate', 'expRate', 'goldRate', 'bossDmg', 'holy',
  'healOnKill', 'dmgReduce', 'skillDmg',
]);

function blankStats() {
  const s = {
    hp: 0, mp: 0, atk: 0, matk: 0, def: 0, mdef: 0, acc: 0, agi: 0,
    crit: 5, critDmg: 150, pen: 0, trueDmg: 0, lifesteal: 0, reflect: 0,
    stun: 0, freeze: 0, poison: 0, burn: 0, atkSpeed: 0, moveSpeed: 0,
    luck: 0, dropRate: 0, expRate: 0, goldRate: 0, bossDmg: 0, holy: 0,
    hpRegen: 0, mpRegen: 0, healOnKill: 0, shield: 0, dmgReduce: 0,
    allStats: 0, skillDmg: 0,
    atkMul: 0, matkMul: 0, defMul: 0, mdefMul: 0, hpRegenPct: 0,
  };
  return s;
}

export const PLAYER = {
  create(clsId, name) {
    const cls = DATA.CLASSES[clsId] || DATA.CLASSES.warrior;
    const p = {
      clsId: cls.id,
      name: (name || '').trim().slice(0, 8) || U.randomName(cls.id),
      level: 1,
      exp: 0,
      gold: 120,
      essence: 0,
      skillFrags: 0,
      ultBooks: 0,
      ultimates: [],
      potions: { hp: 4, mp: 3 },
      hp: 0,
      mp: 0,
      shield: 0,
      shieldMax: 0,
      lastHurtAt: -99,
      equip: {},
      bag: [],
      zone: 'bichi',
      buffs: [],
      kills: 0,
      bossKills: {},
      playTime: 0,
      rebirth: 0,
      towerFloor: 1,
      towerBest: 0,
      bounty: null,
      auto: true,
      autoPickup: true,
      autoSalvage: -1,
      autoPotion: true,
      sound: true,
      facing: 1,
      dirMode: 'down',
      moveX: 0,
      moveY: 0,
      animTime: 0,
      dead: false,
      attackCd: 0,
      attackT: 0,
      dashT: 0,
      moveTarget: null,
      movePath: null,
      chasePath: null,
      dot: null,
      invuln: 0,
      stats: blankStats(),
      activeSets: [],
      setEffects: [],
      maxLevelUpFx: 0,
    };
    for (const s of DATA.SLOTS) p.equip[s.id] = null;
    const starter = ITEMS.starter(cls.id);
    for (const item of starter) p.equip[item.slot] = item;
    this.recalc(p, true);
    p.hp = p.stats.hp;
    p.mp = p.stats.mp;
    p.shield = p.stats.shield;
    return p;
  },

  expNeed(level) {
    return DATA.expNeed(level);
  },

  baseStats(p) {
    const cls = DATA.CLASSES[p.clsId];
    const s = blankStats();
    const lv = p.level - 1;
    const rb = 1 + (p.rebirth || 0) * DATA.REBIRTH.bonus;
    s.hp = Math.round((cls.base.hp + cls.growth.hp * lv) * rb);
    s.mp = Math.round((cls.base.mp + cls.growth.mp * lv) * rb);
    s.atk = (cls.base.atk + cls.growth.atk * lv) * rb;
    s.matk = (cls.base.matk + cls.growth.matk * lv) * rb;
    s.def = (cls.base.def + cls.growth.def * lv) * rb;
    s.mdef = (cls.base.mdef + cls.growth.mdef * lv) * rb;
    s.acc = (cls.base.acc + cls.growth.acc * lv) * rb;
    s.agi = (cls.base.agi + cls.growth.agi * lv) * rb;
    return s;
  },

  setCounts(p) {
    const counts = {};
    for (const slot of Object.keys(p.equip)) {
      const it = p.equip[slot];
      if (it && it.setId) counts[it.setId] = (counts[it.setId] || 0) + 1;
    }
    return counts;
  },

  recalc(p, keepRatio = false) {
    const oldHp = p.stats ? p.stats.hp : 0;
    const oldMp = p.stats ? p.stats.mp : 0;
    const s = this.baseStats(p);

    const add = (src) => {
      for (const k in src) {
        if (!(k in s)) s[k] = src[k];
        else s[k] += src[k];
      }
    };

    for (const slot of Object.keys(p.equip)) {
      const it = p.equip[slot];
      if (it) add(ITEMS.statsOf(it));
    }

    // 全属性：附加到攻防主属性
    const all = s.allStats || 0;
    if (all) {
      s.atk += all;
      s.matk += all;
      s.def += all;
      s.mdef += all;
      s.acc += all * 0.5;
      s.agi += all * 0.5;
    }

    // 套装
    const counts = this.setCounts(p);
    p.activeSets = [];
    p.setEffects = [];
    for (const setId in counts) {
      const set = DATA.SETS[setId];
      if (!set) continue;
      const count = counts[setId];
      const active = [];
      for (const b of set.bonuses) {
        if (count >= b.need) {
          active.push(b);
          add(b.stats || {});
        }
      }
      if (active.length) p.activeSets.push({ id: setId, count, active, total: set.slots.length });
      if (count >= 6) {
        if (setId === 'shengzhan') p.setEffects.push('setShengzhan');
        if (setId === 'fashen') p.setEffects.push('setFashen');
        if (setId === 'tianzun') p.setEffects.push('setTianzun');
      }
    }

    // Buff
    for (const b of p.buffs) {
      if (b.stats) add(b.stats);
    }

    // 乘区
    s.atk *= 1 + (s.atkMul || 0);
    s.matk *= 1 + (s.matkMul || 0);
    s.def *= 1 + (s.defMul || 0);
    s.mdef *= 1 + (s.mdefMul || 0);

    // 上限
    s.crit = U.clamp(s.crit, 0, 75);
    s.pen = U.clamp(s.pen, 0, 70);
    s.dmgReduce = U.clamp(s.dmgReduce, 0, 65);
    s.lifesteal = U.clamp(s.lifesteal, 0, 45);
    s.atkSpeed = U.clamp(s.atkSpeed, 0, 160);
    s.moveSpeed = U.clamp(s.moveSpeed, -20, 90);
    s.stun = U.clamp(s.stun, 0, 25);
    s.freeze = U.clamp(s.freeze, 0, 22);
    s.hpRegenPct = U.clamp(s.hpRegenPct || 0, 0, 0.05);

    for (const k in s) {
      if (PERCENT_STATS.has(k)) s[k] = Math.round(s[k] * 10) / 10;
      else s[k] = Math.round(s[k]);
    }
    s.atk = Math.max(1, Math.round(s.atk));
    s.matk = Math.max(1, Math.round(s.matk));
    s.hp = Math.max(1, Math.round(s.hp));
    s.mp = Math.max(0, Math.round(s.mp));

    p.stats = s;
    p.shieldMax = s.shield;
    if (keepRatio && oldHp > 0) {
      p.hp = Math.max(1, Math.round((p.hp / oldHp) * s.hp));
      p.mp = Math.max(0, Math.round((p.mp / oldMp) * s.mp));
    }
    p.hp = U.clamp(p.hp || s.hp, 0, s.hp);
    p.mp = U.clamp(p.mp || s.mp, 0, s.mp);
    p.shield = U.clamp(p.shield || 0, 0, Math.max(p.shieldMax, s.hp));
    return s;
  },

  addBuff(p, buff) {
    const existing = p.buffs.find((b) => b.id === buff.id);
    if (existing) {
      existing.t = buff.dur;
      existing.max = buff.dur;
      existing.stats = buff.stats || existing.stats;
      existing.name = buff.name || existing.name;
      existing.icon = buff.icon || existing.icon;
    } else {
      p.buffs.push({
        id: buff.id,
        name: buff.name || '增益',
        icon: buff.icon || '增',
        t: buff.dur,
        max: buff.dur,
        stats: buff.stats || {},
        shieldPct: buff.shieldPct || 0,
      });
    }
    this.recalc(p, true);
    if (buff.shieldPct) {
      p.shield = Math.min(p.stats.hp, (p.shield || 0) + p.stats.hp * buff.shieldPct);
    }
    return p;
  },

  tickBuffs(p, dt) {
    let changed = false;
    for (let i = p.buffs.length - 1; i >= 0; i--) {
      p.buffs[i].t -= dt;
      if (p.buffs[i].t <= 0) {
        p.buffs.splice(i, 1);
        changed = true;
      }
    }
    if (changed) this.recalc(p, true);
  },

  gainExp(p, amount) {
    if (p.level >= DATA.MAX_LEVEL) return 0;
    p.exp += amount * (1 + (p.stats.expRate || 0) / 100);
    let ups = 0;
    while (p.level < DATA.MAX_LEVEL && p.exp >= this.expNeed(p.level)) {
      p.exp -= this.expNeed(p.level);
      p.level += 1;
      ups++;
    }
    if (p.level >= DATA.MAX_LEVEL) p.exp = 0;
    if (ups) {
      this.recalc(p, false);
      p.hp = p.stats.hp;
      p.mp = p.stats.mp;
      p.maxLevelUpFx = ups;
    }
    return ups;
  },

  heal(p, amount) {
    const before = p.hp;
    p.hp = U.clamp(p.hp + amount, 0, p.stats.hp);
    return p.hp - before;
  },
  restoreMp(p, amount) {
    const before = p.mp;
    p.mp = U.clamp(p.mp + amount, 0, p.stats.mp);
    return p.mp - before;
  },

  addItem(p, item) {
    if (p.bag.length >= DATA.BAG_SIZE) return false;
    p.bag.push(item);
    return true;
  },

  removeItem(p, uid) {
    const idx = p.bag.findIndex((i) => i.uid === uid);
    if (idx < 0) return null;
    return p.bag.splice(idx, 1)[0];
  },

  findItem(p, uid) {
    if (!uid) return null;
    for (const slot of Object.keys(p.equip)) {
      if (p.equip[slot] && p.equip[slot].uid === uid) return { item: p.equip[slot], equipped: true, slot };
    }
    const bagItem = p.bag.find((i) => i.uid === uid);
    return bagItem ? { item: bagItem, equipped: false } : null;
  },

  canEquip(p, item) {
    return p.level >= (item.req || 1);
  },

  equip(p, item) {
    if (!this.canEquip(p, item)) return { ok: false, reason: 'level' };
    const idx = p.bag.findIndex((i) => i.uid === item.uid);
    if (idx < 0) return { ok: false, reason: 'missing' };
    const prev = p.equip[item.slot];
    p.bag.splice(idx, 1);
    p.equip[item.slot] = item;
    if (prev) p.bag.push(prev);
    this.recalc(p, true);
    return { ok: true, prev };
  },

  unequip(p, slot) {
    const item = p.equip[slot];
    if (!item) return { ok: false, reason: 'empty' };
    if (p.bag.length >= DATA.BAG_SIZE) return { ok: false, reason: 'bag' };
    p.equip[slot] = null;
    p.bag.push(item);
    this.recalc(p, true);
    return { ok: true, item };
  },

  power(p) {
    const s = p.stats;
    let total =
      s.hp * 0.55 + s.mp * 0.12 + s.atk * 4.6 + s.matk * 4.6 + s.def * 3.2 + s.mdef * 3.2 +
      s.acc * 1.5 + s.agi * 1.5 + s.crit * 15 + s.critDmg * 3.5 + s.pen * 9 + s.trueDmg * 3 +
      s.lifesteal * 18 + s.reflect * 4 + s.stun * 26 + s.freeze * 26 + s.poison * 10 + s.burn * 10 +
      s.atkSpeed * 10 + s.moveSpeed * 5 + s.dropRate * 4 + s.expRate * 4 + s.goldRate * 3 +
      s.bossDmg * 7 + s.holy * 6 + s.hpRegen * 3 + s.mpRegen * 2 + s.healOnKill * 18 +
      s.shield * 1.2 + s.dmgReduce * 22 + s.skillDmg * 8 + s.luck * 18;
    for (const b of p.buffs) total += 40;
    return Math.round(total);
  },

  // 把一件背包装备换上后的战力变化（不影响玩家真实状态）
  powerDelta(p, item) {
    if (!item || !item.slot) return 0;
    const current = p.equip[item.slot];
    if (current && current.uid === item.uid) return 0;
    const hp = p.hp;
    const mp = p.mp;
    const shield = p.shield;
    const before = this.power(p);
    p.equip[item.slot] = item;
    this.recalc(p, false);
    const after = this.power(p);
    p.equip[item.slot] = current || null;
    this.recalc(p, false);
    p.hp = hp;
    p.mp = mp;
    p.shield = shield;
    return after - before;
  },

  attackInterval(p) {
    const cls = DATA.CLASSES[p.clsId];
    return cls.basic.cd / (1 + p.stats.atkSpeed / 100);
  },

  moveSpeed(p) {
    return 158 * (1 + p.stats.moveSpeed / 100);
  },

  serialize(p) {
    return {
      v: DATA.VERSION,
      clsId: p.clsId,
      name: p.name,
      level: p.level,
      exp: p.exp,
      gold: p.gold,
      essence: p.essence || 0,
      skillFrags: p.skillFrags || 0,
      ultBooks: p.ultBooks || 0,
      ultimates: Array.isArray(p.ultimates) ? p.ultimates.slice(0, 2) : [],
      potions: { ...p.potions },
      hp: p.hp,
      mp: p.mp,
      zone: p.zone,
      equip: p.equip,
      bag: p.bag,
      kills: p.kills,
      bossKills: p.bossKills,
      playTime: p.playTime,
      rebirth: p.rebirth || 0,
      towerFloor: p.towerFloor || 1,
      towerBest: p.towerBest || 0,
      bounty: p.bounty || null,
      auto: p.auto,
      autoPickup: p.autoPickup !== false,
      autoSalvage: Number.isInteger(p.autoSalvage) ? p.autoSalvage : -1,
      autoPotion: p.autoPotion !== false,
      sound: p.sound,
      savedAt: Date.now(),
    };
  },

  deserialize(data) {
    if (!data || typeof data !== 'object' || !DATA.CLASSES[data.clsId]) return null;
    const p = {
      clsId: data.clsId,
      name: String(data.name || '无名').slice(0, 8),
      level: U.clamp(Number(data.level) || 1, 1, DATA.MAX_LEVEL),
      exp: Math.max(0, Number(data.exp) || 0),
      gold: Math.max(0, Number(data.gold) || 0),
      essence: Math.max(0, Number(data.essence) || 0),
      skillFrags: Math.max(0, Number(data.skillFrags) || 0),
      ultBooks: Math.max(0, Number(data.ultBooks) || 0),
      ultimates: Array.isArray(data.ultimates)
        ? data.ultimates.filter((id) => (DATA.CLASSES[data.clsId].ultimates || []).includes(id)).slice(0, 2)
        : [],
      potions: { hp: Math.max(0, Number(data.potions && data.potions.hp) || 0), mp: Math.max(0, Number(data.potions && data.potions.mp) || 0) },
      hp: 0,
      mp: 0,
      shield: 0,
      shieldMax: 0,
      lastHurtAt: -99,
      equip: {},
      bag: Array.isArray(data.bag) ? data.bag.filter((i) => i && i.slot && i.uid) : [],
      zone: DATA.ZONES.some((z) => z.id === data.zone) ? data.zone : 'bichi',
      buffs: [],
      kills: Math.max(0, Number(data.kills) || 0),
      bossKills: data.bossKills || {},
      playTime: Math.max(0, Number(data.playTime) || 0),
      rebirth: U.clamp(Number(data.rebirth) || 0, 0, DATA.REBIRTH.max),
      towerFloor: U.clamp(Number(data.towerFloor) || 1, 1, 999),
      towerBest: Math.max(0, Number(data.towerBest) || 0),
      bounty: data.bounty && Array.isArray(data.bounty.tasks) ? data.bounty : null,
      auto: data.auto !== false,
      autoPickup: data.autoPickup !== false,
      autoSalvage: Number.isInteger(data.autoSalvage) ? U.clamp(data.autoSalvage, -1, 4) : -1,
      autoPotion: data.autoPotion !== false,
      sound: data.sound !== false,
      facing: 1,
      dirMode: 'down',
      moveX: 0,
      moveY: 0,
      animTime: 0,
      dead: false,
      attackCd: 0,
      attackT: 0,
      dashT: 0,
      moveTarget: null,
      movePath: null,
      chasePath: null,
      dot: null,
      invuln: 0,
      stats: blankStats(),
      activeSets: [],
      setEffects: [],
      maxLevelUpFx: 0,
    };
    for (const s of DATA.SLOTS) {
      const it = data.equip && data.equip[s.id];
      p.equip[s.id] = it && it.slot === s.id ? it : null;
    }
    this.recalc(p, false);
    p.hp = U.clamp(Number(data.hp) || p.stats.hp, 1, p.stats.hp);
    p.mp = U.clamp(Number(data.mp) || p.stats.mp, 0, p.stats.mp);
    p.shield = p.stats.shield;
    return p;
  },
};
