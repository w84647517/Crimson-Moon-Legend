// 玩法系统：试炼塔 / 悬赏榜 / 锻造 / 转生
// 只放纯函数与配置推导，真正改玩家状态的操作在 game.js 里
import { U } from '../core/util.js';
import { DATA } from '../data/gamedata.js';
import { ITEMS } from './items.js';

const T = DATA.TRIAL;

function trialZoneId(floor) {
  if (floor <= 5) return 'bichi';
  if (floor <= 10) return 'woma';
  if (floor <= 20) return 'zuma';
  if (floor <= 35) return 'chiyue';
  return 'molong';
}

export const SYSTEMS = {
  /* ============================ 试炼塔 ============================ */
  trialZoneId,

  // 纯函数：同一层永远得到同一套词缀（面板预览与实际进入一致）
  trialMods(floor) {
    const count = floor < 2 ? 0 : floor < 5 ? 1 : floor < 10 ? 2 : 3;
    if (count <= 0) return [];
    const pool = T.mods.filter((m) => floor >= m.minFloor);
    const rnd = U.seeded(floor * 7919 + 37);
    const bag = pool.slice();
    const picked = [];
    while (picked.length < count && bag.length) {
      let total = 0;
      for (const m of bag) total += m.weight;
      let r = rnd() * total;
      let idx = 0;
      for (; idx < bag.length; idx++) {
        r -= bag[idx].weight;
        if (r <= 0) break;
      }
      picked.push(bag.splice(Math.min(idx, bag.length - 1), 1)[0]);
    }
    return picked;
  },

  trialConfig(floor) {
    floor = Math.max(1, Math.round(floor));
    const zoneId = trialZoneId(floor);
    const zone = DATA.ZONES.find((z) => z.id === zoneId) || DATA.ZONES[0];
    const mods = this.trialMods(floor);
    const has = (id) => mods.some((m) => m.id === id);

    let count = Math.min(T.monsterMax, T.monsterBase + floor * T.monsterPerFloor);
    if (has('horde')) count = Math.min(56, Math.round(count * 1.5));

    let time = Math.min(T.timeMax, T.timeBase + floor * T.timePerFloor);
    if (has('timed')) time = Math.round(time * 0.7);

    const level = Math.min(DATA.MAX_LEVEL, 2 + Math.round(floor * 1.25));

    return {
      floor,
      zoneId,
      zone,
      mods,
      count,
      time,
      level,
      eliteRate: has('elite') ? 0.5 : 0.12,
      hpMul: has('treasure') ? 1.3 : 1,
      atkMul: has('frenzy') ? 1.4 : 1,
      defMul: has('armored') ? 1.5 : 1,
      spdMul: has('swift') ? 1.25 : 1,
      expMul: has('horde') ? 1.3 : 1,
      goldMul: has('armored') ? 1.5 : 1,
      dropBonus: (has('frenzy') ? 0.3 : 0) + (has('treasure') ? 0.8 : 0) + (has('elite') ? 0.2 : 0),
      healMul: has('noheal') ? 0.4 : 1,
      rewardMul: has('timed') ? 1.4 : 1,
    };
  },

  trialReward(floor) {
    const cfg = this.trialConfig(floor);
    return {
      gold: Math.round((150 + floor * 85 + Math.pow(floor, 1.6) * 6) * cfg.rewardMul),
      essence: Math.max(1, Math.round((2 + floor * 0.9) * cfg.rewardMul)),
      rarity: Math.min(5, 1 + Math.floor(floor / 7)),
      level: cfg.level,
    };
  },

  trialMonsterPool(cfg) {
    return cfg.zone.monsters;
  },

  // 按等级推荐一个起步层，避免高等级玩家在低层浪费时间
  trialEntryFloor(p) {
    const next = Math.max(1, p.towerFloor || 1);
    const suggest = Math.max(1, Math.min(120, Math.floor((p.level || 1) * 0.55)));
    return (p.towerBest || 0) < suggest ? Math.max(next, suggest) : next;
  },

  /* ============================ 悬赏榜 ============================ */
  // 按玩家等级生成一批候选悬赏，再由 rollBounty 抽 3 条不重复类型
  bountyTemplates(p) {
    const lvl = Math.max(1, p.level);
    const reachable = DATA.ZONES.filter((z) => z.req <= lvl + 3);
    const zone = reachable[reachable.length - 1] || DATA.ZONES[0];
    const monIds = [];
    for (const z of reachable.slice(-2)) for (const m of z.monsters) if (!monIds.includes(m.id)) monIds.push(m.id);
    const targetId = monIds.length ? U.pick(monIds) : 'orc';
    const targetName = (DATA.MONSTERS[targetId] || {}).name || '魔物';
    const bossIds = reachable.map((z) => z.boss).filter(Boolean);
    const bossId = bossIds[bossIds.length - 1] || 'orcChief';
    const bossName = (DATA.MONSTERS[bossId] || {}).name || 'BOSS';

    const gold = Math.round(900 + lvl * 320);
    const essence = Math.round(4 + lvl * 0.45);
    const towerNeed = Math.max(1, Math.min(3, Math.floor((p.towerBest || 0) / 4) + 1));

    return [
      {
        kind: 'kill',
        title: '扫荡魔物',
        desc: `在任意地图击杀 ${30 + lvl * 3} 只怪物`,
        need: 30 + lvl * 3,
        reward: { gold, essence, potion: { hp: 3, mp: 2 } },
      },
      {
        kind: 'killType',
        target: targetId,
        title: `猎杀${targetName}`,
        desc: `击杀 ${12 + Math.floor(lvl * 0.8)} 只${targetName}`,
        need: 12 + Math.floor(lvl * 0.8),
        reward: { gold: Math.round(gold * 1.15), essence, potion: { hp: 2, mp: 3 } },
      },
      {
        kind: 'elite',
        title: '精英猎手',
        desc: `击杀 ${3 + Math.floor(lvl / 12)} 只精英怪（金名）`,
        need: 3 + Math.floor(lvl / 12),
        reward: { gold: Math.round(gold * 1.3), essence: essence + 2, potion: { hp: 4, mp: 2 } },
      },
      {
        kind: 'boss',
        title: `讨伐${bossName}`,
        desc: `击杀 ${Math.max(1, Math.min(3, Math.floor(lvl / 25)))} 只 BOSS`,
        need: Math.max(1, Math.min(3, Math.floor(lvl / 25))),
        reward: { gold: Math.round(gold * 2.2), essence: essence + 6, potion: { hp: 6, mp: 4 } },
      },
      {
        kind: 'salvage',
        title: '熔炼匠人',
        desc: `分解 ${12 + Math.floor(lvl / 2)} 件装备`,
        need: 12 + Math.floor(lvl / 2),
        reward: { gold: Math.round(gold * 0.9), essence: essence + 3, potion: { hp: 2, mp: 2 } },
      },
      {
        kind: 'upgrade',
        title: '锋芒毕露',
        desc: `强化成功 ${2 + Math.floor(lvl / 15)} 次`,
        need: 2 + Math.floor(lvl / 15),
        reward: { gold: Math.round(gold * 1.1), essence: essence + 2, potion: { hp: 3, mp: 3 } },
      },
      {
        kind: 'tower',
        title: '登塔试炼',
        desc: `通关试炼塔 ${towerNeed} 层`,
        need: towerNeed,
        reward: { gold: Math.round(gold * 1.5), essence: essence + 5, potion: { hp: 4, mp: 4 } },
      },
      {
        kind: 'collect',
        title: '寻宝之旅',
        desc: `拾取 ${10 + Math.floor(lvl / 2)} 件装备`,
        need: 10 + Math.floor(lvl / 2),
        reward: { gold: Math.round(gold * 0.8), essence: essence + 2, potion: { hp: 2, mp: 2 } },
      },
    ];
  },

  rollBounty(p) {
    const pool = U.shuffle(this.bountyTemplates(p));
    const tasks = [];
    const used = new Set();
    for (const t of pool) {
      if (tasks.length >= 3) break;
      if (used.has(t.kind)) continue;
      used.add(t.kind);
      tasks.push({
        id: 'q' + U.uid().slice(-7) + tasks.length,
        kind: t.kind,
        target: t.target || null,
        title: t.title,
        desc: t.desc,
        need: Math.max(1, Math.round(t.need)),
        reward: t.reward,
        prog: 0,
        claimed: false,
      });
    }
    return { at: Date.now(), lv: p.level, tasks };
  },

  bountyProgress(p, kind, amount = 1, target = null) {
    if (!p.bounty || !Array.isArray(p.bounty.tasks)) return false;
    let changed = false;
    for (const t of p.bounty.tasks) {
      if (t.claimed || t.kind !== kind) continue;
      if (t.target && target && t.target !== target) continue;
      if (t.target && !target) continue;
      if (t.prog >= t.need) continue;
      t.prog = Math.min(t.need, t.prog + amount);
      changed = true;
    }
    return changed;
  },

  bountyDone(p) {
    const tasks = (p.bounty && p.bounty.tasks) || [];
    return tasks.length > 0 && tasks.every((t) => t.claimed);
  },

  bountyClaimable(p) {
    const tasks = (p.bounty && p.bounty.tasks) || [];
    return tasks.filter((t) => !t.claimed && t.prog >= t.need).length;
  },

  /* ============================ 锻造 ============================ */
  fuseCost(item) {
    return Math.round((220 + item.level * 48) * (1 + item.rarity * 0.55));
  },

  // 找出可用于合成的伙伴：同部位、同品级、不同实例
  findFusePartner(p, item) {
    return (
      p.bag.find(
        (it) => it.uid !== item.uid && it.slot === item.slot && it.rarity === item.rarity && it.rarity < 5
      ) || null
    );
  },

  // 一键合成：把背包里所有可成对的同部位同品级装备贪心合上去
  fuseCandidates(p) {
    const groups = {};
    for (const it of p.bag) {
      if (it.rarity >= 5) continue;
      const key = it.slot + '#' + it.rarity;
      (groups[key] = groups[key] || []).push(it);
    }
    const pairs = [];
    for (const key in groups) {
      const list = groups[key].sort((a, b) => ITEMS.power(b) - ITEMS.power(a));
      while (list.length >= 2) {
        const a = list.shift();
        const b = list.shift();
        pairs.push([a, b]);
      }
    }
    return pairs;
  },

  craftEntry(rarity) {
    return DATA.FORGE.craft.find((c) => c.rarity === rarity) || null;
  },

  /* ============================ 转生 ============================ */
  rebirthReady(p) {
    return p.level >= DATA.REBIRTH.levelReq && (p.rebirth || 0) < DATA.REBIRTH.max;
  },

  rebirthCost(p) {
    return DATA.REBIRTH.cost(p.rebirth || 0);
  },

  rebirthBonus(p) {
    return 1 + (p.rebirth || 0) * DATA.REBIRTH.bonus;
  },
};
