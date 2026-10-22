import { U } from '../core/util.js';
import { DATA } from '../data/gamedata.js';

const KIND_BY_CLASS = { warrior: 'melee', mage: 'magic', taoist: 'tao' };

const LEGEND_BY_KIND = {
  melee: ['屠龙', '裁决', '镇岳', '怒斩', '开天'],
  magic: ['焚天', '骨玉', '星陨', '霜牙'],
  tao: ['龙纹', '逍遥', '天尊', '青囊'],
};

function round(v, digits = 0) {
  const p = Math.pow(10, digits);
  return Math.round(v * p) / p;
}

export const ITEMS = {
  slot(slotId) {
    return DATA.SLOTS.find((s) => s.id === slotId);
  },
  slotName(slotId) {
    const s = this.slot(slotId);
    return s ? s.name : '装备';
  },
  glyph(item) {
    const s = this.slot(item.slot);
    return s ? s.glyph : '◆';
  },
  rarity(item) {
    return DATA.RARITIES[item.rarity] || DATA.RARITIES[0];
  },
  color(item) {
    return this.rarity(item).color;
  },

  affixValue(def, level) {
    const raw = U.rand(def.min, def.max) * (1 + level * def.scale);
    return round(raw, def.digits || 0);
  },

  rollRarity(bonus = 0) {
    const weights = DATA.RARITIES.map((r, i) => {
      if (i < 2) return r.weight;
      return r.weight * Math.pow(1 + bonus, i - 1);
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return i;
    }
    return 0;
  },

  pickBase(slotId, level, clsKind) {
    const list = DATA.BASES[slotId] || DATA.BASES.weapon;
    const eligible = list.filter((b) => b.lvl <= level + 1);
    const pool = eligible.length ? eligible : list;
    let total = 0;
    const weights = pool.map((b) => {
      const dist = Math.abs(b.lvl - Math.min(level, b.lvl));
      const w = Math.exp(-Math.abs(b.lvl - level) / 10) + 0.05;
      const bias = clsKind && b.kind === clsKind ? 3.2 : 1;
      total += w * bias;
      return w * bias;
    });
    let roll = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  },

  baseStats(base, level, rarityMul) {
    const out = {};
    for (const key of ['atk', 'matk', 'def', 'mdef', 'hp', 'mp', 'acc', 'agi']) {
      if (base[key]) {
        const range = base[key];
        let v = U.rand(range[0], range[1]);
        // 高出档位的装备略微成长
        v *= 1 + Math.max(0, level - base.lvl) * 0.02;
        v *= rarityMul;
        out[key] = Math.max(1, Math.round(v));
      }
    }
    return out;
  },

  generate({ level = 1, slot = null, rarity = null, clsKind = null, clsId = null, baseId = null, setChance = 0.32 } = {}) {
    level = U.clamp(Math.round(level), 1, DATA.MAX_LEVEL);
    const slotId = slot || U.pick(DATA.SLOTS).id;
    let base = null;
    if (baseId) {
      base = (DATA.BASES[slotId] || []).find((b) => b.id === baseId);
    }
    if (!base) base = this.pickBase(slotId, level, clsKind);

    const r = rarity == null ? this.rollRarity(0) : rarity;
    const rd = DATA.RARITIES[r];
    const stats = this.baseStats(base, level, rd.mul);

    const item = {
      uid: U.uid(),
      slot: slotId,
      baseId: base.id,
      baseName: base.name,
      kind: base.kind || null,
      level,
      req: Math.max(1, Math.min(level, base.lvl + Math.floor(level * 0.08))),
      rarity: r,
      stats,
      affixes: [],
      uniqueId: null,
      setId: null,
      upgrade: 0,
      name: base.name,
    };

    // 特殊参数
    const affixCount = rd.affixes;
    const ids = Object.keys(DATA.AFFIXES);
    const picked = new Set();
    for (let i = 0; i < affixCount; i++) {
      let id = null;
      let guard = 0;
      do {
        id = U.pick(ids);
        guard++;
      } while (picked.has(id) && guard < 40);
      if (picked.has(id)) continue;
      picked.add(id);
      const def = DATA.AFFIXES[id];
      item.affixes.push({ id, value: this.affixValue(def, level) });
    }

    // 传说专属词条
    if (r >= 4 && Math.random() < (r >= 5 ? 1 : 0.78)) {
      const keys = Object.keys(DATA.UNIQUES);
      item.uniqueId = U.pick(keys);
    }

    // 套装
    if (r >= 4 && Math.random() < setChance) {
      const sets = Object.keys(DATA.SETS).filter((id) => DATA.SETS[id].slots.includes(slotId));
      if (sets.length) {
        let preferred = null;
        if (clsId === 'warrior') preferred = 'shengzhan';
        if (clsId === 'mage') preferred = 'fashen';
        if (clsId === 'taoist') preferred = 'tianzun';
        item.setId = preferred && sets.includes(preferred) && Math.random() < 0.6 ? preferred : U.pick(sets);
      }
    }

    // 名称
    if (r === 4 || r === 5) {
      const pool = slotId === 'weapon' && base.kind ? LEGEND_BY_KIND[base.kind] || DATA.LEGEND_NAMES.weapon : DATA.LEGEND_NAMES[slotId] || ['传说'];
      const legend = U.pick(pool);
      const setPrefix = item.setId ? DATA.SETS[item.setId].name + '·' : '';
      item.name = (r === 5 ? '神话·' : '') + setPrefix + legend;
    } else if (r > 0) {
      item.name = U.pick(DATA.PREFIX[r]) + base.name;
    }

    return item;
  },

  // 最终属性（强化 + 词条 + 传说词条）
  statsOf(item) {
    const out = {};
    const mul = 1 + item.upgrade * 0.08;
    for (const k in item.stats) out[k] = Math.round(item.stats[k] * mul);
    for (const af of item.affixes) {
      out[af.id] = round((out[af.id] || 0) + af.value, 1);
    }
    if (item.uniqueId) {
      const uq = DATA.UNIQUES[item.uniqueId];
      if (uq && uq.stats) {
        for (const k in uq.stats) out[k] = round((out[k] || 0) + uq.stats[k], 1);
      }
    }
    return out;
  },

  baseStatEntries(item) {
    const mul = 1 + item.upgrade * 0.08;
    return Object.entries(item.stats)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ key: k, value: Math.round(v * mul) }));
  },

  affixEntries(item) {
    const seen = {};
    for (const af of item.affixes) {
      if (!seen[af.id]) seen[af.id] = { id: af.id, name: DATA.AFFIXES[af.id].name, value: 0, suffix: DATA.AFFIXES[af.id].suffix };
      seen[af.id].value += af.value;
    }
    return Object.values(seen).sort((a, b) => b.value - a.value);
  },

  power(item) {
    const s = this.statsOf(item);
    const w = {
      hp: 0.9, mp: 0.15, atk: 5, matk: 5, def: 4, mdef: 4, acc: 1, agi: 1,
      crit: 16, critDmg: 4, pen: 11, trueDmg: 3.2, lifesteal: 22, reflect: 5,
      stun: 30, freeze: 30, poison: 14, burn: 14, atkSpeed: 12, moveSpeed: 7,
      luck: 22, dropRate: 4, expRate: 4, goldRate: 3, bossDmg: 9, holy: 7,
      hpRegen: 4, mpRegen: 3, healOnKill: 20, shield: 1.6, dmgReduce: 26,
      allStats: 12, skillDmg: 10,
    };
    let total = 0;
    for (const k in s) total += (s[k] || 0) * (w[k] || 1);
    if (item.upgrade) total += item.upgrade * 12;
    return Math.round(total);
  },

  upgradeCost(item) {
    return Math.round((70 + item.level * 24) * Math.pow(1.32, item.upgrade) * (1 + item.rarity * 0.28));
  },
  upgradeChance(item) {
    if (item.upgrade >= 15) return 0;
    if (item.upgrade < 4) return 1;
    return Math.max(0.3, 0.96 - (item.upgrade - 3) * 0.075);
  },
  attemptUpgrade(item) {
    if (item.upgrade >= 15) return { ok: false, max: true, downgraded: false };
    const chance = this.upgradeChance(item);
    if (Math.random() < chance) {
      item.upgrade += 1;
      return { ok: true, max: false, downgraded: false };
    }
    let downgraded = false;
    if (item.upgrade >= 10) {
      item.upgrade -= 1;
      downgraded = true;
    }
    return { ok: false, max: false, downgraded };
  },

  rerollCost(item) {
    return Math.round((160 + item.level * 38) * (1 + item.rarity * 0.45));
  },
  reroll(item) {
    const count = item.affixes.length;
    const ids = Object.keys(DATA.AFFIXES);
    const used = new Set();
    const next = [];
    for (let i = 0; i < count; i++) {
      let id = null;
      let guard = 0;
      do {
        id = U.pick(ids);
        guard++;
      } while (used.has(id) && guard < 40);
      used.add(id);
      const def = DATA.AFFIXES[id];
      next.push({ id, value: this.affixValue(def, item.level) });
    }
    item.affixes = next;
  },

  salvageValue(item) {
    return Math.round((10 + item.level * 5) * (1 + item.rarity * 0.85));
  },

  // 分解得到的精粹：稀有度越高、等级越高给得越多，用于锻造
  salvageEssence(item) {
    return Math.max(1, Math.round(1 + item.rarity * 2 + item.level * 0.12));
  },

  // 两件同部位同品级合成：保留较高强化等级（最多 10）
  fuseResult(base, partner, level) {
    const item = this.generate({
      level: Math.max(1, Math.min(DATA.MAX_LEVEL, Math.round(level))),
      slot: base.slot,
      rarity: Math.min(5, base.rarity + 1),
      clsId: base.clsId || null,
      setChance: 0.45,
    });
    item.upgrade = Math.min(10, Math.max(base.upgrade || 0, partner.upgrade || 0));
    return item;
  },

  formatValue(key, value) {
    const label = DATA.STAT_LABELS[key] || key;
    if (['hpRegen', 'mpRegen'].includes(key)) return `+${Math.round(value)}/5s`;
    if (['crit', 'critDmg', 'pen', 'lifesteal', 'reflect', 'stun', 'freeze', 'poison', 'burn', 'atkSpeed', 'moveSpeed', 'dropRate', 'expRate', 'goldRate', 'bossDmg', 'holy', 'healOnKill', 'dmgReduce', 'skillDmg'].includes(key)) {
      const n = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
      return `+${n}%`;
    }
    return `+${Math.round(value)}`;
  },

  statLabel(key) {
    return DATA.STAT_LABELS[key] || key;
  },

  starter(clsId) {
    const kind = KIND_BY_CLASS[clsId] || 'melee';
    const weaponBase = { warrior: 'w_iron', mage: 'w_stick', taoist: 'w_wood' }[clsId] || 'w_iron';
    const armorBase = clsId === 'warrior' ? 'a_light' : 'a_cloth';
    const weapon = this.generate({ level: 1, slot: 'weapon', rarity: 1, baseId: weaponBase, clsKind: kind, clsId, setChance: 0 });
    weapon.req = 1;
    const armor = this.generate({ level: 1, slot: 'armor', rarity: 0, baseId: armorBase, clsKind: kind, clsId, setChance: 0 });
    armor.req = 1;
    const medal = this.generate({ level: 1, slot: 'medal', rarity: 1, baseId: 'm_novice', clsKind: kind, clsId, setChance: 0 });
    medal.req = 1;
    return [weapon, armor, medal];
  },
};
