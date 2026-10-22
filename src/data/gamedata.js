// 全部静态配置：职业、技能、装备、词条、套装、怪物、地图
export const DATA = {
  VERSION: 2,
  SAVE_KEY: 'crimson-moon-save-v3',
  TILE: 48,
  MAX_LEVEL: 60,
  BAG_SIZE: 36,

  expNeed(level) {
    return Math.floor(60 * Math.pow(level, 1.45) + 35 * level);
  },

  STAT_LABELS: {
    hp: '生命', mp: '魔法', atk: '攻击', matk: '道术', def: '防御', mdef: '魔防',
    acc: '准确', agi: '敏捷', crit: '暴击率', critDmg: '暴击伤害', pen: '破防',
    trueDmg: '切割', lifesteal: '吸血', reflect: '反伤', stun: '麻痹',
    freeze: '冰冻', poison: '中毒', burn: '灼烧', atkSpeed: '攻击速度',
    moveSpeed: '移动速度', luck: '幸运', dropRate: '爆率', expRate: '经验加成',
    goldRate: '金币加成', bossDmg: '对BOSS伤害', holy: '神圣伤害',
    hpRegen: '生命回复', mpRegen: '魔法回复', healOnKill: '击杀回复',
    shield: '护盾', dmgReduce: '伤害减免', allStats: '全属性', skillDmg: '技能伤害',
  },

  CLASSES: {
    warrior: {
      id: 'warrior',
      name: '战士',
      glyph: '战',
      role: '近战 · 爆发 · 高生存',
      desc: '以血肉之躯撕开敌阵，刀锋所至，尸横遍野。血量与防御成长最高，越战越勇。',
      color: '#e05a3c',
      accent: '#ffb06a',
      chips: ['高生命', '近战爆发', '破防'],
      weaponKind: 'melee',
      basic: { type: 'melee', power: 1.05, range: 78, arc: 1.2, cd: 0.74, color: '#ffb066' },
      base: { hp: 165, mp: 30, atk: 13, matk: 2, def: 8, mdef: 2, acc: 15, agi: 8 },
      growth: { hp: 36, mp: 4, atk: 3.4, matk: 0.3, def: 1.7, mdef: 0.6, acc: 0.6, agi: 0.35 },
      skills: ['thrust', 'halfmoon', 'shoulder', 'flame'],
      ultimates: ['tenstep', 'heaven'],
    },
    mage: {
      id: 'mage',
      name: '法师',
      glyph: '法',
      role: '远程 · 群攻 · 控场',
      desc: '掌控冰与雷的术士，身板脆弱却能瞬间清空整片战场。蓝量就是生命线。',
      color: '#4d8ee0',
      accent: '#8fd8ff',
      chips: ['远程', '范围伤害', '冰冻'],
      weaponKind: 'magic',
      basic: { type: 'bolt', power: 0.95, range: 360, speed: 430, cd: 0.86, color: '#ff9a4a' },
      base: { hp: 105, mp: 85, atk: 4, matk: 15, def: 3, mdef: 5, acc: 12, agi: 9 },
      growth: { hp: 17, mp: 10, atk: 0.4, matk: 4.2, def: 0.7, mdef: 1.2, acc: 0.5, agi: 0.45 },
      skills: ['fireball', 'lightning', 'ice', 'magicshield'],
      ultimates: ['meteor', 'frostdragon'],
    },
    taoist: {
      id: 'taoist',
      name: '道士',
      glyph: '道',
      role: '远程 · 毒伤 · 治疗',
      desc: '符咒与毒术的行家，能持续消耗强敌，也能在绝境中把自己从鬼门关拉回来。',
      color: '#3f9d6d',
      accent: '#a9e8b8',
      chips: ['续航', '持续伤害', '治疗'],
      weaponKind: 'tao',
      basic: { type: 'bolt', power: 0.86, range: 330, speed: 400, cd: 0.92, color: '#ffe08a' },
      base: { hp: 135, mp: 52, atk: 7, matk: 9, def: 5, mdef: 4, acc: 13, agi: 9 },
      growth: { hp: 25, mp: 7, atk: 1, matk: 2.9, def: 1, mdef: 1, acc: 0.5, agi: 0.45 },
      skills: ['soulfire', 'poison', 'heal', 'armor'],
      ultimates: ['swamp', 'tiangang'],
    },
  },

  SKILLS: {
    thrust: {
      id: 'thrust', name: '刺杀剑术', icon: '刺', mp: 8, cd: 3.2, cls: 'warrior',
      desc: '向前突刺，造成 260% 攻击伤害，并无视目标 30% 防御。',
      type: 'meleeStrike', power: 2.6, range: 126, pen: 30,
    },
    halfmoon: {
      id: 'halfmoon', name: '半月弯刀', icon: '月', mp: 14, cd: 5.2, cls: 'warrior',
      desc: '挥出半月刀气，对身前扇形范围内所有敌人造成 190% 攻击伤害。',
      type: 'meleeArc', power: 1.9, range: 138, arc: Math.PI * 0.95,
    },
    shoulder: {
      id: 'shoulder', name: '野蛮冲撞', icon: '撞', mp: 16, cd: 8.5, cls: 'warrior',
      desc: '向前冲撞，造成 150% 攻击伤害并麻痹目标 1.4 秒。',
      type: 'dash', power: 1.5, dist: 180, stun: 1.4, radius: 46,
    },
    flame: {
      id: 'flame', name: '烈火剑法', icon: '烈', mp: 26, cd: 13, cls: 'warrior',
      desc: '引燃剑刃，立即对周围造成 240% 火焰伤害，并在 8 秒内提升 35% 攻击。',
      type: 'novaBuff', power: 2.4, radius: 152,
      buff: { name: '烈火', icon: '烈', atkMul: 0.35, dur: 8 },
    },
    fireball: {
      id: 'fireball', name: '火球术', icon: '球', mp: 9, cd: 1.15, cls: 'mage',
      desc: '发射火球，命中后爆裂，对目标及周围敌人造成 220% 魔法伤害。',
      type: 'projectile', power: 2.2, radius: 74, speed: 460, color: '#ff8a3c', element: 'fire',
    },
    lightning: {
      id: 'lightning', name: '雷电术', icon: '雷', mp: 16, cd: 3.8, cls: 'mage',
      desc: '闪电在至多 3 个敌人之间跳跃，每次造成 210% 魔法伤害。',
      type: 'chain', power: 2.1, jumps: 3, range: 320,
    },
    ice: {
      id: 'ice', name: '冰咆哮', icon: '冰', mp: 24, cd: 7, cls: 'mage',
      desc: '召唤寒冰风暴，对区域敌人造成 280% 魔法伤害并冰冻 1.6 秒。',
      type: 'aoe', power: 2.8, radius: 124, range: 320, freeze: 1.6, color: '#7fd8ff',
    },
    magicshield: {
      id: 'magicshield', name: '魔法盾', icon: '盾', mp: 22, cd: 15, cls: 'mage',
      desc: '凝聚护盾，吸收相当于 30% 最大生命的伤害，6 秒内额外减免 25% 伤害。',
      type: 'buff', buff: { name: '魔法盾', icon: '盾', shieldPct: 0.3, dmgReduce: 25, dur: 6 },
    },
    soulfire: {
      id: 'soulfire', name: '灵魂火符', icon: '符', mp: 8, cd: 1.4, cls: 'taoist',
      desc: '掷出追踪目标的灵魂火符，造成 190% 道术伤害。',
      type: 'projectile', power: 1.9, homing: true, speed: 360, color: '#ffe08a', element: 'holy',
    },
    poison: {
      id: 'poison', name: '施毒术', icon: '毒', mp: 12, cd: 6, cls: 'taoist',
      desc: '对区域敌人施加剧毒，持续 6 秒，每秒造成 45% 道术伤害。',
      type: 'poisonAoe', power: 0.45, radius: 145, dur: 6,
    },
    heal: {
      id: 'heal', name: '治愈术', icon: '愈', mp: 18, cd: 8, cls: 'taoist',
      desc: '立即恢复 28% 最大生命，并在 4 秒内额外恢复 12%。',
      type: 'heal', pct: 0.28, hot: 0.12,
    },
    armor: {
      id: 'armor', name: '神圣战甲术', icon: '甲', mp: 20, cd: 14, cls: 'taoist',
      desc: '8 秒内提升 30% 防御与魔防，并持续回复生命。',
      type: 'buff', buff: { name: '战甲', icon: '甲', defMul: 0.3, mdefMul: 0.3, hpRegenPct: 0.008, dur: 8 },
    },
  },

  ULTIMATE_FRAG_COST: 100,

  // 终极技能：每个职业两个，需用 100 个技能书碎片合成的技能书研习
  ULTIMATES: {
    tenstep: {
      id: 'tenstep', name: '十步一杀', icon: '杀', cls: 'warrior',
      desc: '瞬身突进至目标身前，路径上所有敌人受到 600% 攻击伤害并被麻痹 1.6 秒。',
      type: 'ultDash', power: 6.0, dist: 300, stun: 1.6, mp: 45, cd: 55, element: 'phys',
    },
    heaven: {
      id: 'heaven', name: '开天斩', icon: '天', cls: 'warrior',
      desc: '连续劈出三道开天刀气，每道造成 320% 攻击伤害并忽视 45% 防御，命中后附加灼烧。',
      type: 'ultArc', power: 3.2, hits: 3, range: 210, arc: Math.PI * 0.8, pen: 45, mp: 55, cd: 70, element: 'fire',
    },
    meteor: {
      id: 'meteor', name: '流星火雨', icon: '陨', cls: 'mage',
      desc: '召来 10 颗流星轰击目标区域，每颗对周围敌人造成 130% 魔法伤害并附加灼烧。同一目标最多承受 3 次。',
      type: 'ultMeteor', power: 1.3, meteors: 10, radius: 230, mp: 60, cd: 65, element: 'fire',
    },
    frostdragon: {
      id: 'frostdragon', name: '冰霜巨龙', icon: '龙', cls: 'mage',
      desc: '放出一条贯穿战场的冰霜巨龙，对直线上的敌人造成 700% 魔法伤害并冰冻 2.5 秒。',
      type: 'ultBeam', power: 7.0, range: 560, width: 64, freeze: 2.5, mp: 65, cd: 80, element: 'ice',
    },
    swamp: {
      id: 'swamp', name: '噬魂沼泽', icon: '沼', cls: 'taoist',
      desc: '在目标脚下化作噬魂沼泽，对范围内敌人造成 280% 道术伤害并持续剧毒 8 秒，伤害的 30% 转化为自身生命。',
      type: 'ultSwamp', power: 2.8, radius: 215, dur: 8, lifesteal: 0.3, mp: 55, cd: 65, element: 'poison',
    },
    tiangang: {
      id: 'tiangang', name: '天罡护体', icon: '罡', cls: 'taoist',
      desc: '立即恢复 25% 生命，12 秒内获得 55% 最大生命护盾、35% 减伤、50% 防御与 30% 反伤。',
      type: 'ultGuard', healPct: 0.25, shieldPct: 0.55, dmgReduce: 35, defMul: 0.5, mdefMul: 0.5, reflect: 30, regen: 0.01, dur: 12, mp: 50, cd: 75, element: 'holy',
    },
  },

  SLOTS: [
    { id: 'weapon', name: '武器', glyph: '剑', order: 0 },
    { id: 'armor', name: '衣服', glyph: '甲', order: 1 },
    { id: 'helmet', name: '头盔', glyph: '盔', order: 2 },
    { id: 'necklace', name: '项链', glyph: '链', order: 3 },
    { id: 'bracelet1', name: '手镯', glyph: '镯', order: 4 },
    { id: 'bracelet2', name: '手镯', glyph: '镯', order: 5 },
    { id: 'ring1', name: '戒指', glyph: '戒', order: 6 },
    { id: 'ring2', name: '戒指', glyph: '戒', order: 7 },
    { id: 'belt', name: '腰带', glyph: '带', order: 8 },
    { id: 'boots', name: '战靴', glyph: '靴', order: 9 },
    { id: 'medal', name: '勋章', glyph: '章', order: 10 },
  ],

  RARITIES: [
    { id: 0, name: '普通', color: '#cfc7b8', affixes: 0, mul: 1.0, weight: 56 },
    { id: 1, name: '精良', color: '#63c56f', affixes: 1, mul: 1.14, weight: 25 },
    { id: 2, name: '稀有', color: '#54a8ff', affixes: 2, mul: 1.32, weight: 11.5 },
    { id: 3, name: '史诗', color: '#b678ff', affixes: 3, mul: 1.56, weight: 5 },
    { id: 4, name: '传说', color: '#ffa23f', affixes: 4, mul: 1.88, weight: 2.1 },
    { id: 5, name: '神话', color: '#ff5a5a', affixes: 5, mul: 2.3, weight: 0.4 },
  ],

  // 装备基底：lvl 决定档位，kind 用于职业倾向
  BASES: {
    weapon: [
      { id: 'w_wood', name: '桃木剑', lvl: 1, kind: 'tao', atk: [4, 7], matk: [3, 6] },
      { id: 'w_stick', name: '木杖', lvl: 1, kind: 'magic', atk: [2, 4], matk: [6, 10] },
      { id: 'w_iron', name: '铁剑', lvl: 3, kind: 'melee', atk: [9, 14], matk: [1, 3] },
      { id: 'w_axe', name: '青铜斧', lvl: 8, kind: 'melee', atk: [17, 25], matk: [0, 2] },
      { id: 'w_wand', name: '魔杖', lvl: 8, kind: 'magic', atk: [4, 7], matk: [16, 24] },
      { id: 'w_tao', name: '无极棍', lvl: 12, kind: 'tao', atk: [10, 16], matk: [13, 20] },
      { id: 'w_moon', name: '井中月', lvl: 15, kind: 'melee', atk: [26, 38], matk: [3, 7] },
      { id: 'w_bone', name: '骨玉权杖', lvl: 18, kind: 'magic', atk: [5, 9], matk: [34, 48] },
      { id: 'w_fan', name: '逍遥扇', lvl: 22, kind: 'tao', atk: [18, 28], matk: [26, 38] },
      { id: 'w_judge', name: '裁决之刃', lvl: 24, kind: 'melee', atk: [44, 62], matk: [4, 9] },
      { id: 'w_soul', name: '嗜魂法杖', lvl: 28, kind: 'magic', atk: [7, 12], matk: [56, 78] },
      { id: 'w_dragon', name: '龙纹剑', lvl: 34, kind: 'tao', atk: [38, 54], matk: [48, 66] },
      { id: 'w_blood', name: '血饮', lvl: 36, kind: 'melee', atk: [70, 96], matk: [8, 15] },
      { id: 'w_tooth', name: '龙牙', lvl: 42, kind: 'magic', atk: [12, 18], matk: [94, 128] },
      { id: 'w_rage', name: '怒斩', lvl: 46, kind: 'melee', atk: [108, 146], matk: [12, 20] },
      { id: 'w_sky', name: '开天', lvl: 52, kind: 'melee', atk: [150, 200], matk: [18, 30] },
      { id: 'w_flame', name: '焚天', lvl: 54, kind: 'magic', atk: [22, 32], matk: [132, 178] },
      { id: 'w_tao2', name: '天尊道剑', lvl: 55, kind: 'tao', atk: [86, 118], matk: [104, 138] },
    ],
    armor: [
      { id: 'a_cloth', name: '布衣', lvl: 1, kind: 'robe', def: [2, 4], mdef: [1, 2], hp: [12, 22] },
      { id: 'a_light', name: '轻型盔甲', lvl: 5, kind: 'heavy', def: [6, 9], mdef: [2, 4], hp: [28, 46] },
      { id: 'a_robe', name: '魔法长袍', lvl: 7, kind: 'robe', def: [4, 7], mdef: [6, 9], hp: [24, 40] },
      { id: 'a_heavy', name: '重盔甲', lvl: 14, kind: 'heavy', def: [13, 19], mdef: [5, 8], hp: [64, 94] },
      { id: 'a_ghost', name: '幽灵战衣', lvl: 24, kind: 'heavy', def: [23, 33], mdef: [10, 16], hp: [126, 176] },
      { id: 'a_fashen', name: '法神披风', lvl: 28, kind: 'robe', def: [18, 27], mdef: [20, 30], hp: [110, 160] },
      { id: 'a_sky', name: '天魔神甲', lvl: 34, kind: 'heavy', def: [36, 50], mdef: [18, 26], hp: [200, 280] },
      { id: 'a_thunder', name: '雷霆战甲', lvl: 44, kind: 'heavy', def: [56, 76], mdef: [28, 40], hp: [320, 420] },
      { id: 'a_moon', name: '赤月魔甲', lvl: 52, kind: 'heavy', def: [80, 108], mdef: [42, 58], hp: [460, 600] },
      { id: 'a_myth', name: '神话羽衣', lvl: 55, kind: 'robe', def: [64, 88], mdef: [64, 88], hp: [380, 500] },
    ],
    helmet: [
      { id: 'h_cloth', name: '布帽', lvl: 1, def: [1, 3], mdef: [0, 1], hp: [6, 12] },
      { id: 'h_bronze', name: '青铜头盔', lvl: 8, def: [4, 7], mdef: [2, 4], hp: [16, 26] },
      { id: 'h_magic', name: '魔法头盔', lvl: 16, def: [7, 11], mdef: [5, 8], hp: [30, 50] },
      { id: 'h_iron', name: '黑铁头盔', lvl: 26, def: [12, 18], mdef: [8, 12], hp: [60, 92] },
      { id: 'h_war', name: '圣战头盔', lvl: 36, def: [20, 28], mdef: [13, 19], hp: [100, 150] },
      { id: 'h_sky', name: '天龙盔', lvl: 48, def: [30, 42], mdef: [20, 30], hp: [160, 230] },
    ],
    necklace: [
      { id: 'n_glass', name: '玻璃项链', lvl: 2, atk: [1, 3], matk: [1, 4] },
      { id: 'n_coral', name: '珊瑚项链', lvl: 10, atk: [4, 7], matk: [4, 8] },
      { id: 'n_life', name: '生命项链', lvl: 18, atk: [8, 13], matk: [8, 14], hp: [36, 64] },
      { id: 'n_demon', name: '恶魔铃铛', lvl: 28, atk: [15, 22], matk: [15, 24] },
      { id: 'n_war', name: '圣战项链', lvl: 38, atk: [24, 34], matk: [24, 36] },
      { id: 'n_moon', name: '赤月之心', lvl: 48, atk: [36, 50], matk: [36, 52], hp: [80, 120] },
    ],
    bracelet1: [
      { id: 'b_iron', name: '铁手镯', lvl: 2, def: [1, 2], acc: [2, 4] },
      { id: 'b_silver', name: '银手镯', lvl: 10, def: [3, 5], acc: [5, 8] },
      { id: 'b_tao', name: '道士手镯', lvl: 18, def: [6, 9], mdef: [3, 6], acc: [8, 12] },
      { id: 'b_power', name: '力量手镯', lvl: 28, def: [10, 15], atk: [8, 14] },
      { id: 'b_war', name: '圣战手镯', lvl: 38, def: [16, 22], atk: [14, 22] },
      { id: 'b_dragon', name: '龙之手镯', lvl: 48, def: [24, 32], atk: [22, 34] },
    ],
    bracelet2: [
      { id: 'b_iron2', name: '铁手镯', lvl: 2, def: [1, 2], acc: [2, 4] },
      { id: 'b_silver2', name: '银手镯', lvl: 10, def: [3, 5], acc: [5, 8] },
      { id: 'b_tao2', name: '道士手镯', lvl: 18, def: [6, 9], mdef: [3, 6], acc: [8, 12] },
      { id: 'b_power2', name: '力量手镯', lvl: 28, def: [10, 15], atk: [8, 14] },
      { id: 'b_war2', name: '圣战手镯', lvl: 38, def: [16, 22], atk: [14, 22] },
      { id: 'b_dragon2', name: '龙之手镯', lvl: 48, def: [24, 32], atk: [22, 34] },
    ],
    ring1: [
      { id: 'r_copper', name: '铜戒指', lvl: 1, atk: [1, 3], matk: [1, 2] },
      { id: 'r_iron', name: '铁戒指', lvl: 9, atk: [4, 7], matk: [2, 5] },
      { id: 'r_magic', name: '魔法戒指', lvl: 17, atk: [3, 6], matk: [8, 14] },
      { id: 'r_power', name: '力量戒指', lvl: 27, atk: [14, 22], matk: [4, 8] },
      { id: 'r_war', name: '圣战戒指', lvl: 37, atk: [23, 34], matk: [10, 16] },
      { id: 'r_moon', name: '赤月戒指', lvl: 47, atk: [35, 50], matk: [16, 26] },
    ],
    ring2: [
      { id: 'r_copper2', name: '铜戒指', lvl: 1, atk: [1, 3], matk: [1, 2] },
      { id: 'r_iron2', name: '铁戒指', lvl: 9, atk: [4, 7], matk: [2, 5] },
      { id: 'r_magic2', name: '魔法戒指', lvl: 17, atk: [3, 6], matk: [8, 14] },
      { id: 'r_power2', name: '力量戒指', lvl: 27, atk: [14, 22], matk: [4, 8] },
      { id: 'r_war2', name: '圣战戒指', lvl: 37, atk: [23, 34], matk: [10, 16] },
      { id: 'r_moon2', name: '赤月戒指', lvl: 47, atk: [35, 50], matk: [16, 26] },
    ],
    belt: [
      { id: 't_cloth', name: '布带', lvl: 1, def: [1, 2], hp: [10, 20] },
      { id: 't_leather', name: '皮革腰带', lvl: 10, def: [3, 5], hp: [30, 50] },
      { id: 't_iron', name: '铁腰带', lvl: 20, def: [7, 11], hp: [70, 100] },
      { id: 't_power', name: '力量腰带', lvl: 30, def: [12, 18], hp: [120, 170], atk: [6, 10] },
      { id: 't_war', name: '圣战腰带', lvl: 42, def: [20, 28], hp: [200, 260], atk: [12, 20] },
    ],
    boots: [
      { id: 's_straw', name: '草鞋', lvl: 1, def: [1, 2] },
      { id: 's_leather', name: '皮靴', lvl: 9, def: [3, 6], hp: [10, 20] },
      { id: 's_light', name: '轻型战靴', lvl: 18, def: [6, 10], hp: [25, 45] },
      { id: 's_wind', name: '疾风战靴', lvl: 28, def: [10, 15], hp: [50, 80] },
      { id: 's_war', name: '圣战战靴', lvl: 38, def: [16, 22], hp: [90, 140] },
      { id: 's_cloud', name: '踏云靴', lvl: 48, def: [24, 32], hp: [150, 220] },
    ],
    medal: [
      { id: 'm_novice', name: '新手勋章', lvl: 3, atk: [1, 3], matk: [1, 3], hp: [10, 20] },
      { id: 'm_brave', name: '勇者勋章', lvl: 12, atk: [4, 7], matk: [4, 7], hp: [30, 50] },
      { id: 'm_elite', name: '精英勋章', lvl: 22, atk: [9, 14], matk: [9, 14], hp: [60, 90] },
      { id: 'm_king', name: '王者勋章', lvl: 32, atk: [16, 24], matk: [16, 24], hp: [110, 160] },
      { id: 'm_legend', name: '传奇勋章', lvl: 44, atk: [28, 40], matk: [28, 40], hp: [200, 280] },
    ],
  },

  // 特殊参数词条：roll = (baseMin..baseMax) * (1 + level * scale)
  AFFIXES: {
    crit: { name: '暴击率', suffix: '%', min: 1.0, max: 2.6, scale: 0.035, digits: 1, weight: 10, desc: '暴击率（上限 75%）。命中时按该概率触发暴击，暴击伤害由“暴击伤害”属性决定。' },
    critDmg: { name: '暴击伤害', suffix: '%', min: 6, max: 15, scale: 0.032, digits: 0, weight: 9, desc: '暴击时的伤害倍率，基础 150%，此词条直接累加。' },
    pen: { name: '破防', suffix: '%', min: 2, max: 5, scale: 0.026, digits: 1, weight: 8, desc: '破防（上限 70%）。按比例无视目标防御，与技能自带的破防叠加。' },
    trueDmg: { name: '切割', suffix: '', min: 3, max: 9, scale: 0.16, digits: 0, weight: 9, desc: '切割。每次命中追加固定真实伤害，不受目标防御影响。' },
    lifesteal: { name: '吸血', suffix: '%', min: 0.8, max: 2.2, scale: 0.038, digits: 1, weight: 7, desc: '吸血（上限 45%）。造成伤害时按该比例回复自身生命。' },
    reflect: { name: '反伤', suffix: '%', min: 2, max: 5, scale: 0.028, digits: 1, weight: 6, desc: '受到近战伤害时，按该比例将伤害反弹给攻击者。' },
    stun: { name: '麻痹', suffix: '%', min: 0.6, max: 1.6, scale: 0.024, digits: 1, weight: 5, desc: '麻痹（上限 25%）。命中时概率使目标无法行动约 1.1 秒。' },
    freeze: { name: '冰冻', suffix: '%', min: 0.5, max: 1.4, scale: 0.024, digits: 1, weight: 5, desc: '冰冻（上限 22%）。命中时概率冻结目标约 1.5 秒，冻结期间无法移动与攻击。' },
    poison: { name: '中毒', suffix: '%', min: 1, max: 2.6, scale: 0.024, digits: 1, weight: 6, desc: '命中时概率使目标中毒，持续掉血 5 秒，可叠加刷新。' },
    burn: { name: '灼烧', suffix: '%', min: 1, max: 2.6, scale: 0.024, digits: 1, weight: 6, desc: '命中时概率点燃目标，持续掉血 4 秒，可叠加刷新。' },
    atkSpeed: { name: '攻击速度', suffix: '%', min: 2, max: 5, scale: 0.028, digits: 1, weight: 8, desc: '攻击速度（上限 160%）。缩短普攻间隔，不减少技能冷却。' },
    moveSpeed: { name: '移动速度', suffix: '%', min: 1.5, max: 4, scale: 0.018, digits: 1, weight: 6, desc: '移动速度（上限 90%）。提高角色跑图与走位速度。' },
    luck: { name: '幸运', suffix: '', min: 1, max: 2, scale: 0.028, digits: 0, weight: 4, desc: '提高装备掉落概率与高品质权重，每点约等于 1.5% 额外爆率。' },
    dropRate: { name: '爆率', suffix: '%', min: 3, max: 8, scale: 0.032, digits: 0, weight: 6, desc: '提高怪物掉落装备的概率，并小幅提高高品质装备权重。' },
    expRate: { name: '经验加成', suffix: '%', min: 2, max: 6, scale: 0.026, digits: 1, weight: 6, desc: '击杀怪物获得的经验提高。' },
    goldRate: { name: '金币加成', suffix: '%', min: 4, max: 10, scale: 0.026, digits: 0, weight: 5, desc: '击杀掉落与分解装备获得的金币提高。' },
    bossDmg: { name: '对BOSS伤害', suffix: '%', min: 3, max: 7, scale: 0.026, digits: 1, weight: 5, desc: '对 BOSS 类怪物造成的伤害提高。' },
    holy: { name: '神圣伤害', suffix: '%', min: 3, max: 7, scale: 0.026, digits: 1, weight: 5, desc: '对亡灵系怪物额外增伤，并强化“圣裁”类效果。' },
    hpRegen: { name: '生命回复', suffix: '/5s', min: 2, max: 7, scale: 0.2, digits: 0, weight: 6, desc: '每 5 秒回复固定生命值。' },
    mpRegen: { name: '魔法回复', suffix: '/5s', min: 1, max: 4, scale: 0.16, digits: 0, weight: 5, desc: '每 5 秒回复固定魔法值。' },
    healOnKill: { name: '击杀回复', suffix: '%', min: 1, max: 2.5, scale: 0.024, digits: 1, weight: 4, desc: '击杀怪物时，按最大生命比例回复生命。' },
    shield: { name: '护盾', suffix: '', min: 12, max: 34, scale: 0.7, digits: 0, weight: 5, desc: '获得一个优先吸收伤害的护盾值；护盾耗尽后才扣生命。' },
    dmgReduce: { name: '伤害减免', suffix: '%', min: 1, max: 3, scale: 0.016, digits: 1, weight: 4, desc: '伤害减免（上限 65%）。按比例降低受到的所有伤害。' },
    allStats: { name: '全属性', suffix: '', min: 1, max: 3, scale: 0.05, digits: 0, weight: 3, desc: '同时提升攻击、道术、防御、魔防，并少量提升准确与敏捷。' },
    skillDmg: { name: '技能伤害', suffix: '%', min: 2, max: 5, scale: 0.022, digits: 1, weight: 4, desc: '提高技能造成的伤害，普通攻击不吃该加成。' },
  },

  // 传说 / 神话专属词条
  UNIQUES: {
    blaze: {
      name: '烈焰', stats: { burn: 3 },
      effect: { type: 'blaze', chance: 0.14, power: 0.7 },
      text: '攻击时有 14% 概率引燃目标，造成 70% 攻击的火焰伤害并使其灼烧。',
    },
    thunder: {
      name: '雷霆', stats: { atkSpeed: 5 },
      effect: { type: 'thunder', chance: 0.12, power: 0.8 },
      text: '攻击时有 12% 概率召来落雷，对目标及周围敌人造成 80% 攻击的闪电伤害。',
    },
    frost: {
      name: '霜寒', stats: { freeze: 2 },
      effect: { type: 'frost', chance: 0.1, dur: 1.6 },
      text: '攻击时有 10% 概率冻结目标 1.6 秒。',
    },
    bloodthirst: {
      name: '嗜血', stats: { lifesteal: 2.5, healOnKill: 1.5 },
      effect: { type: 'bloodthirst' },
      text: '吸血与击杀回复额外提升，击杀敌人时回复 6% 最大生命。',
    },
    pierce: {
      name: '破军', stats: { pen: 6, bossDmg: 8 },
      effect: { type: 'pierce' },
      text: '无视目标 6% 防御，且对 BOSS 造成的伤害提高 8%。',
    },
    holy: {
      name: '圣裁', stats: { holy: 12 },
      effect: { type: 'holy' },
      text: '对亡灵系敌人伤害额外提高 30%，攻击附带神圣灼烧。',
    },
    void: {
      name: '虚空', stats: { crit: 4, critDmg: 18 },
      effect: { type: 'void', chance: 0.1 },
      text: '攻击时有 10% 概率打出 2.4 倍暴击，无视部分防御。',
    },
    guard: {
      name: '守望', stats: { dmgReduce: 3, reflect: 4 },
      effect: { type: 'guard' },
      text: '受到伤害时有 20% 概率额外减免 35% 伤害，并反弹 30% 伤害。',
    },
    greed: {
      name: '贪婪', stats: { dropRate: 12, goldRate: 15 },
      effect: { type: 'greed' },
      text: '击杀怪物时额外获得 12% 爆率与 15% 金币收益。',
    },
  },

  SETS: {
    shengzhan: {
      name: '圣战', color: '#ff9a4c',
      desc: '战士向套装。2 件提供攻击乘区，4 件补暴击，6 件解锁“圣战一击”。',
      slots: ['weapon', 'armor', 'helmet', 'belt', 'boots', 'medal'],
      bonuses: [
        { need: 2, stats: { atkMul: 0.08 }, text: '攻击 +8%' },
        { need: 4, stats: { crit: 6 }, text: '暴击率 +6%' },
        { need: 6, stats: { bossDmg: 10 }, text: '攻击时 10% 概率追加 220% 伤害的圣战一击' },
      ],
    },
    fashen: {
      name: '法神', color: '#6cc4ff',
      desc: '法系向套装。强化道术、暴击伤害与技能伤害，法师与道士都能吃到。',
      slots: ['weapon', 'armor', 'helmet', 'necklace', 'ring1', 'ring2'],
      bonuses: [
        { need: 2, stats: { matkMul: 0.08 }, text: '道术 +8%' },
        { need: 4, stats: { critDmg: 25 }, text: '暴击伤害 +25%' },
        { need: 6, stats: { skillDmg: 15 }, text: '技能伤害 +15%' },
      ],
    },
    tianzun: {
      name: '天尊', color: '#8fe0a8',
      desc: '续航向套装。强化经验、每秒回血、减伤与击杀回复，适合长时间刷图。',
      slots: ['weapon', 'armor', 'helmet', 'necklace', 'bracelet1', 'bracelet2'],
      bonuses: [
        { need: 2, stats: { expRate: 12 }, text: '经验加成 +12%' },
        { need: 4, stats: { hpRegenPct: 0.01 }, text: '每秒回复 1% 最大生命' },
        { need: 6, stats: { dmgReduce: 8 }, text: '伤害减免 +8%，击杀额外回复 3% 生命' },
      ],
    },
  },

  LEGEND_NAMES: {
    weapon: ['屠龙', '裁决', '开天', '血饮', '龙纹', '怒斩', '焚天', '镇岳'],
    armor: ['天魔神甲', '雷霆战甲', '霓裳羽衣', '赤月魔甲', '龙鳞战铠'],
    helmet: ['天龙盔', '黑铁王冠', '赤月之瞳', '王者之盔'],
    necklace: ['恶魔铃铛', '赤月之心', '龙魂链', '星辰项链'],
    bracelet1: ['力量手镯', '龙之手镯', '赤月护腕', '玄铁护腕'],
    bracelet2: ['力量手镯', '龙之手镯', '赤月护腕', '玄铁护腕'],
    ring1: ['赤月戒指', '龙戒', '王者之戒', '碎星戒'],
    ring2: ['赤月戒指', '龙戒', '王者之戒', '碎星戒'],
    belt: ['龙筋腰带', '镇岳腰带', '赤月束带'],
    boots: ['踏云靴', '疾风战靴', '赤月战靴', '逐日靴'],
    medal: ['传奇勋章', '王者勋章', '赤月徽记'],
  },

  PREFIX: {
    1: ['坚固的', '锋利的', '轻灵的', '幸运的', '坚韧的'],
    2: ['精工的', '咒印', '猎魔', '破晓', '月华'],
    3: ['嗜血', '雷霆', '霜语', '焚天', '虚空'],
  },

  MONSTERS: {
    // 比奇郊野
    chicken: { name: '野鸡', kind: 'bird', lvl: 2, hp: 32, atk: 4, def: 0, spd: 40, exp: 24, gold: 2, size: 0.56, range: 26, cd: 1.8, aggro: 130, passive: true, color: '#c9a35b' },
    deer: { name: '鹿', kind: 'beast', lvl: 3, hp: 52, atk: 5, def: 1, spd: 56, exp: 30, gold: 3, size: 0.7, range: 28, cd: 1.9, aggro: 150, passive: true, color: '#b98a5e' },
    orc: { name: '半兽人', kind: 'orc', lvl: 4, hp: 115, atk: 11, def: 2, spd: 58, exp: 65, gold: 7, size: 0.86, range: 38, cd: 1.5, aggro: 300, color: '#7d9b55' },
    cat: { name: '钉耙猫', kind: 'beast', lvl: 4, hp: 76, atk: 8, def: 1, spd: 78, exp: 50, gold: 5, size: 0.64, range: 32, cd: 1.05, aggro: 330, color: '#b07a4c' },
    orcChief: {
      name: '半兽勇士', kind: 'orc', lvl: 6, hp: 1300, atk: 24, def: 6, spd: 52, exp: 340, gold: 120, size: 1.45, range: 62, cd: 1.6,
      aggro: 560, color: '#8aa858', boss: true, abilities: ['slam', 'summon'], summon: 'orc', summonCount: 2, slamPower: 2.0, slamRadius: 110,
    },
    // 沃玛森林
    spider: { name: '森林蜘蛛', kind: 'spider', lvl: 11, hp: 320, atk: 27, def: 4, spd: 54, exp: 100, gold: 18, size: 0.8, range: 250, cd: 1.9, aggro: 380, ranged: true, poisonHit: true, color: '#6f8c4b' },
    womaWarrior: { name: '沃玛战士', kind: 'orc', lvl: 12, hp: 450, atk: 35, def: 8, spd: 66, exp: 136, gold: 25, size: 0.9, range: 42, cd: 1.4, aggro: 380, color: '#5c7d46' },
    womaGuard: { name: '沃玛护卫', kind: 'orc', lvl: 13, hp: 650, atk: 43, def: 15, spd: 56, exp: 198, gold: 35, size: 1.02, range: 46, cd: 1.6, aggro: 400, color: '#4e6d3e' },
    darkKnight: { name: '暗黑武士', kind: 'skeleton', lvl: 14, hp: 730, atk: 49, def: 17, spd: 76, exp: 224, gold: 40, size: 0.96, range: 46, cd: 1.25, aggro: 440, undead: true, color: '#7f8a99' },
    womaLord: {
      name: '沃玛教主', kind: 'demon', lvl: 15, hp: 8600, atk: 70, def: 24, spd: 58, exp: 2400, gold: 520, size: 1.7, range: 76, cd: 1.7,
      aggro: 700, color: '#8d5a3a', boss: true, abilities: ['slam', 'summon'], summon: 'womaWarrior', summonCount: 2, slamPower: 2.2, slamRadius: 124,
    },
    // 祖玛寺庙
    zumaStatue: { name: '祖玛雕像', kind: 'statue', lvl: 23, hp: 1900, atk: 68, def: 42, spd: 34, exp: 400, gold: 55, size: 1.12, range: 48, cd: 2.2, aggro: 320, color: '#9a8a6c' },
    zumaGuard: { name: '祖玛卫士', kind: 'orc', lvl: 24, hp: 1600, atk: 84, def: 28, spd: 62, exp: 440, gold: 60, size: 1.04, range: 50, cd: 1.4, aggro: 400, color: '#8a7550' },
    zumaArcher: { name: '祖玛弓箭手', kind: 'skeleton', lvl: 24, hp: 1150, atk: 76, def: 18, spd: 52, exp: 420, gold: 58, size: 0.92, range: 290, cd: 2.0, aggro: 460, ranged: true, undead: true, color: '#a4916d' },
    zumaPriest: { name: '祖玛祭司', kind: 'priest', lvl: 25, hp: 1350, atk: 70, def: 21, spd: 48, exp: 470, gold: 76, size: 0.96, range: 250, cd: 2.2, aggro: 440, ranged: true, undead: true, color: '#7c6a93', magicHit: true },
    zumaLord: {
      name: '祖玛教主', kind: 'statue', lvl: 26, hp: 32000, atk: 155, def: 65, spd: 58, exp: 9500, gold: 1600, size: 1.85, range: 80, cd: 1.7,
      aggro: 760, color: '#a08a63', boss: true, abilities: ['slam', 'summon', 'charge'], summon: 'zumaGuard', summonCount: 2, slamPower: 2.3, slamRadius: 132,
    },
    // 赤月峡谷
    bloodSpider: { name: '血蜘蛛', kind: 'spider', lvl: 35, hp: 4400, atk: 152, def: 40, spd: 64, exp: 1000, gold: 100, size: 0.86, range: 42, cd: 1.3, aggro: 420, color: '#9b3b2f' },
    redMoonDevil: { name: '赤月恶魔', kind: 'demon', lvl: 36, hp: 3800, atk: 178, def: 34, spd: 54, exp: 1140, gold: 120, size: 1.0, range: 300, cd: 2.0, aggro: 500, ranged: true, magicHit: true, color: '#a34b52' },
    bloodFiend: { name: '血魔', kind: 'humanoid', lvl: 37, hp: 5400, atk: 198, def: 48, spd: 76, exp: 1280, gold: 130, size: 1.05, range: 48, cd: 1.25, aggro: 470, undead: true, color: '#8f4a4a' },
    moonSpider: { name: '月魔蜘蛛', kind: 'spider', lvl: 37, hp: 4000, atk: 164, def: 36, spd: 58, exp: 1080, gold: 110, size: 0.9, range: 270, cd: 1.9, aggro: 480, ranged: true, poisonHit: true, color: '#7a5570' },
    redMoonKing: {
      name: '赤月恶魔王', kind: 'demon', lvl: 39, hp: 130000, atk: 330, def: 135, spd: 60, exp: 44000, gold: 5200, size: 2.0, range: 86, cd: 1.6,
      aggro: 820, color: '#b23a3a', boss: true, abilities: ['slam', 'summon', 'charge'], summon: 'bloodSpider', summonCount: 3, slamPower: 2.5, slamRadius: 144,
    },
    // 魔龙城
    dragonSoldier: { name: '魔龙战士', kind: 'dragon', lvl: 47, hp: 12500, atk: 345, def: 110, spd: 66, exp: 2700, gold: 220, size: 1.02, range: 50, cd: 1.35, aggro: 480, color: '#8d5a6a' },
    dragonGeneral: { name: '魔龙战将', kind: 'dragon', lvl: 48, hp: 18500, atk: 405, def: 142, spd: 68, exp: 3500, gold: 300, size: 1.12, range: 54, cd: 1.3, aggro: 500, color: '#a05a52' },
    dragonMage: { name: '魔龙法师', kind: 'priest', lvl: 48, hp: 14500, atk: 385, def: 112, spd: 54, exp: 3200, gold: 280, size: 1.0, range: 330, cd: 2.1, aggro: 520, ranged: true, magicHit: true, color: '#7d5a86' },
    dragonLord: {
      name: '魔龙教主', kind: 'dragon', lvl: 50, hp: 380000, atk: 640, def: 250, spd: 64, exp: 160000, gold: 15000, size: 2.25, range: 92, cd: 1.55,
      aggro: 900, color: '#c05050', boss: true, abilities: ['slam', 'summon', 'charge'], summon: 'dragonGeneral', summonCount: 2, slamPower: 2.6, slamRadius: 156,
    },
  },

  ZONES: [
    {
      id: 'bichi', name: '比奇郊野', sub: '新手猎场', req: 1, lvl: 3, boss: 'orcChief', style: 'field', size: 46, spawn: 16,
      monsters: [{ id: 'chicken', w: 30 }, { id: 'deer', w: 18 }, { id: 'orc', w: 32 }, { id: 'cat', w: 20 }],
      desc: '青草与泥土的气息。半兽人在此游荡，是冒险者最初的磨刀石。',
      dropHint: '普通 ~ 稀有',
      theme: {
        floor: ['#2d3628', '#303a2b', '#2b3426', '#323c2d'], wall: '#3d3528', wallTop: '#5a4c36', detail: '#4c5c39',
        tint: 'rgba(120,150,90,0.04)', light: 'rgba(255,210,130,0.10)', props: ['tree', 'rock', 'grass', 'stump'], ambient: 'pollen',
      },
    },
    {
      id: 'woma', name: '沃玛森林', sub: '幽暗林海', req: 8, lvl: 12, boss: 'womaLord', style: 'forest', size: 52, spawn: 20,
      monsters: [{ id: 'spider', w: 26 }, { id: 'womaWarrior', w: 30 }, { id: 'womaGuard', w: 24 }, { id: 'darkKnight', w: 20 }],
      desc: '巨木遮天，腐叶没膝。沃玛的号角在雾里回荡，护卫队从不单独行动。',
      dropHint: '精良 ~ 史诗',
      theme: {
        floor: ['#22301f', '#253424', '#202d1d', '#273726'], wall: '#2a2f20', wallTop: '#41462d', detail: '#3f5a33',
        tint: 'rgba(60,120,70,0.06)', light: 'rgba(150,255,170,0.07)', props: ['pine', 'tree', 'mushroom', 'rock', 'bones'], ambient: 'leaf',
      },
    },
    {
      id: 'zuma', name: '祖玛寺庙', sub: '沉没石殿', req: 18, lvl: 24, boss: 'zumaLord', style: 'temple', size: 54, spawn: 22,
      monsters: [{ id: 'zumaStatue', w: 26 }, { id: 'zumaGuard', w: 30 }, { id: 'zumaArcher', w: 24 }, { id: 'zumaPriest', w: 20 }],
      desc: '石像在黑暗中睁眼。祖玛的信徒把整座寺庙变成了活着的陵墓。',
      dropHint: '稀有 ~ 传说',
      theme: {
        floor: ['#37302a', '#3a332c', '#342d26', '#3c352d'], wall: '#332c24', wallTop: '#5a4d3c', detail: '#6b5a42',
        tint: 'rgba(120,100,60,0.05)', light: 'rgba(255,180,90,0.10)', props: ['pillar', 'brazier', 'statue', 'bones', 'rock'], ambient: 'dust',
      },
    },
    {
      id: 'chiyue', name: '赤月峡谷', sub: '血色裂谷', req: 30, lvl: 36, boss: 'redMoonKing', style: 'canyon', size: 56, spawn: 24,
      monsters: [{ id: 'bloodSpider', w: 26 }, { id: 'redMoonDevil', w: 26 }, { id: 'bloodFiend', w: 28 }, { id: 'moonSpider', w: 20 }],
      desc: '赤月悬在峡谷上方，从未落下。血魔在岩壁上筑巢，等待着新的祭品。',
      dropHint: '史诗 ~ 传说',
      theme: {
        floor: ['#2f1c19', '#321f1b', '#2b1917', '#35211d'], wall: '#2b1917', wallTop: '#4a2a24', detail: '#6a352b',
        tint: 'rgba(150,40,30,0.045)', light: 'rgba(255,80,60,0.10)', props: ['crystal', 'bones', 'rock', 'skull', 'brazier'], ambient: 'ember',
      },
    },
    {
      id: 'molong', name: '魔龙城', sub: '龙焰王座', req: 42, lvl: 48, boss: 'dragonLord', style: 'lair', size: 58, spawn: 26,
      monsters: [{ id: 'dragonSoldier', w: 32 }, { id: 'dragonGeneral', w: 28 }, { id: 'dragonMage', w: 20 }],
      desc: '黑色的城墙由龙骨堆成。魔龙教主盘踞在王座之上，它的呼吸就是一场火雨。',
      dropHint: '传说 ~ 神话',
      theme: {
        floor: ['#241d22', '#272026', '#211a1f', '#292228'], wall: '#1b1519', wallTop: '#3a2b31', detail: '#7a3a34',
        tint: 'rgba(120,30,40,0.08)', light: 'rgba(255,70,50,0.12)', props: ['brazier', 'bones', 'skull', 'crystal', 'pillar'], ambient: 'ember',
      },
    },
  ],

  POTIONS: {
    hp: { name: '金创药', pct: 0.45, cd: 1.1, color: '#ff8570' },
    mp: { name: '魔法药', pct: 0.55, cd: 1.1, color: '#7fc8ff' },
  },

  // 试炼塔：层数无限，每层从词缀池里抽难度规则
  TRIAL: {
    name: '试炼之塔',
    monsterBase: 6,
    monsterPerFloor: 2,
    monsterMax: 36,
    timeBase: 130,
    timePerFloor: 2.8,
    timeMax: 360,
    mods: [
      { id: 'elite', name: '精英横行', desc: '精英怪出现率大幅提高，掉落更好', minFloor: 2, weight: 12 },
      { id: 'horde', name: '兽潮', desc: '怪物数量 +50%，经验 +30%', minFloor: 3, weight: 12 },
      { id: 'swift', name: '疾行', desc: '怪物移动速度 +25%', minFloor: 3, weight: 9 },
      { id: 'frenzy', name: '狂暴', desc: '怪物攻击 +40%，爆率 +30%', minFloor: 4, weight: 12 },
      { id: 'timed', name: '限时', desc: '挑战时间 -30%，通关奖励 +40%', minFloor: 5, weight: 10 },
      { id: 'noheal', name: '禁疗', desc: '药水与治疗技能效果 -60%', minFloor: 6, weight: 8 },
      { id: 'treasure', name: '藏宝', desc: '爆率 +80%，怪物生命 +30%', minFloor: 7, weight: 10 },
      { id: 'armored', name: '铁壁', desc: '怪物防御 +50%，金币 +50%', minFloor: 8, weight: 8 },
    ],
  },

  // 转生：满级后的长线目标，重置等级换取永久倍率
  REBIRTH: {
    max: 9,
    levelReq: 60,
    bonus: 0.08,
    bonusLabel: '全属性 +8%',
    cost(n) {
      return Math.round(80000 * Math.pow(n + 1, 1.85));
    },
  },

  // 锻造：合成与定向打造
  FORGE: {
    craft: [
      { rarity: 1, essence: 25, gold: 800, levelReq: 5 },
      { rarity: 2, essence: 80, gold: 4000, levelReq: 15 },
      { rarity: 3, essence: 220, gold: 18000, levelReq: 25 },
      { rarity: 4, essence: 600, gold: 80000, levelReq: 35 },
      { rarity: 5, essence: 1500, gold: 320000, levelReq: 50 },
    ],
  },

  // 传说装备特殊效果一览（UI 用）
  AFFIX_TIP: '词条数值 = 随机(最小~最大) × (1 + 装备等级 × 成长)，因此高等级装备的同类词条更强。',
};
