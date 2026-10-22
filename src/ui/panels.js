import { U } from '../core/util.js';
import { DATA } from '../data/gamedata.js';
import { ITEMS } from '../game/items.js';
import { PLAYER } from '../game/player.js';
import { SYSTEMS } from '../game/systems.js';
import { ICONS } from './icons.js';

const TITLES = { bag: '背包', character: '角色', skills: '技能', travel: '传送', codex: '装备图鉴', trial: '试炼之塔', bounty: '悬赏榜', forge: '锻造' };
const TABS = [
  { id: 'bag', name: '背包' },
  { id: 'character', name: '角色' },
  { id: 'skills', name: '技能' },
  { id: 'travel', name: '传送' },
  { id: 'trial', name: '试炼' },
  { id: 'bounty', name: '悬赏' },
  { id: 'forge', name: '锻造' },
  { id: 'codex', name: '图鉴' },
];

export const PANELS = {
  actions: {},
  game: null,
  tab: 'bag',
  visible: false,
  detailUid: null,
  confirmCb: null,
  forgeSlot: 'weapon',

  init(actions) {
    this.actions = actions;
    this.el = {
      layer: document.getElementById('panelLayer'),
      panel: document.querySelector('#panelLayer .panel'),
      title: document.getElementById('panelTitle'),
      tabs: document.getElementById('panelTabs'),
      body: document.getElementById('panelBody'),
      close: document.getElementById('panelClose'),
      dialog: document.getElementById('dialogLayer'),
      dialogTitle: document.getElementById('dialogTitle'),
      dialogText: document.getElementById('dialogText'),
      dialogOk: document.getElementById('dialogOk'),
      dialogCancel: document.getElementById('dialogCancel'),
    };

    this.el.close.addEventListener('click', () => this.hide());
    this.el.layer.addEventListener('click', (e) => {
      if (e.target === this.el.layer) this.hide();
    });
    this.el.tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tab]');
      if (!btn) return;
      this.tab = btn.dataset.tab;
      this.detailUid = null;
      this.render();
    });
    this.el.panel.addEventListener('click', (e) => this.onBodyClick(e));

    this.el.dialogCancel.addEventListener('click', () => {
      this.el.dialog.classList.add('hidden');
      this.confirmCb = null;
    });
    this.el.dialogOk.addEventListener('click', () => {
      this.el.dialog.classList.add('hidden');
      const cb = this.confirmCb;
      this.confirmCb = null;
      if (cb) cb();
    });
  },

  toggle(tab) {
    if (this.visible && (!tab || tab === this.tab)) this.hide();
    else this.show(tab);
  },

  show(tab) {
    const game = this.actions.getGame();
    if (!game || !game.player) return;
    this.game = game;
    if (tab) this.tab = tab;
    this.visible = true;
    this.detailUid = null;
    this.el.layer.classList.remove('hidden');
    this.render();
  },

  hide() {
    this.visible = false;
    this.detailUid = null;
    this.el.layer.classList.add('hidden');
    this.actions.onClosed && this.actions.onClosed();
  },

  refresh() {
    if (this.visible) this.render();
  },

  render() {
    const game = this.actions.getGame();
    this.game = game;
    if (!game || !game.player) return;
    this.el.title.textContent = TITLES[this.tab] || '背包';
    this.el.panel.querySelectorAll('.detail-overlay').forEach((n) => n.remove());
    this.el.tabs.innerHTML = TABS.map(
      (t) => `<button class="tab ${t.id === this.tab ? 'active' : ''}" data-tab="${t.id}">${t.name}</button>`
    ).join('');
    let html = '';
    if (this.tab === 'bag') html = this.bagHtml(game);
    else if (this.tab === 'character') html = this.characterHtml(game);
    else if (this.tab === 'skills') html = this.skillsHtml(game);
    else if (this.tab === 'travel') html = this.travelHtml(game);
    else if (this.tab === 'trial') html = this.trialHtml(game);
    else if (this.tab === 'bounty') html = this.bountyHtml(game);
    else if (this.tab === 'forge') html = this.forgeHtml(game);
    else if (this.tab === 'codex') html = this.codexHtml(game);
    this.el.body.innerHTML = html;
    if (this.detailUid) {
      const found = PLAYER.findItem(game.player, this.detailUid);
      if (found) this.appendDetail(found.item, found.equipped, found.slot || found.item.slot);
      else this.detailUid = null;
    }
  },

  onBodyClick(e) {
    const game = this.actions.getGame();
    if (!game) return;
    const actBtn = e.target.closest('[data-act]');
    if (actBtn) {
      const act = actBtn.dataset.act;
      if (act === 'close-detail') {
        this.detailUid = null;
        this.render();
        return;
      }
      if (act === 'sort') {
        this.actions.sortBag();
        return;
      }
      if (act === 'auto-pickup') {
        this.actions.toggleAutoPickup();
        return;
      }
      if (act === 'auto-salvage') {
        this.actions.cycleAutoSalvage();
        return;
      }
      if (act === 'auto-potion') {
        this.actions.toggleAutoPotion();
        return;
      }
      if (act === 'salvage-rarity') {
        const r = Number(actBtn.dataset.r);
        const list = game.player.bag.filter((it) => it.rarity === r);
        if (!list.length) return;
        const gold = list.reduce((sum, it) => sum + ITEMS.salvageValue(it), 0);
        const rd = DATA.RARITIES[r];
        this.confirm(
          `分解${rd.name}装备`,
          `确定分解全部 ${list.length} 件${rd.name}装备？可获得 ${U.fmt(gold)} 金币。`,
          () => this.actions.salvageRarity(r)
        );
        return;
      }
      if (act === 'travel') {
        this.actions.travel(actBtn.dataset.zone);
        return;
      }
      if (act === 'enter-trial') {
        this.actions.enterTrial(Number(actBtn.dataset.floor));
        return;
      }
      if (act === 'leave-trial') {
        this.actions.leaveTrial();
        return;
      }
      if (act === 'claim-bounty') {
        this.actions.claimBounty(actBtn.dataset.id);
        return;
      }
      if (act === 'refresh-bounty') {
        this.actions.refreshBounty();
        return;
      }
      if (act === 'fuse') {
        this.actions.fuseItem(actBtn.dataset.uid);
        return;
      }
      if (act === 'fuse-all') {
        this.actions.fuseAll();
        return;
      }
      if (act === 'forge-slot') {
        this.forgeSlot = actBtn.dataset.slot;
        this.render();
        return;
      }
      if (act === 'craft') {
        this.actions.craftItem(actBtn.dataset.slot, Number(actBtn.dataset.r));
        return;
      }
      if (act === 'merge-ult') {
        this.actions.mergeUltBook();
        return;
      }
      if (act === 'learn-ult') {
        this.actions.learnUltimate(actBtn.dataset.id);
        return;
      }
      if (act === 'rebirth') {
        this.confirm('转生', `转生后等级重置为 1，装备与背包保留，并获得永久全属性 +${DATA.REBIRTH.bonus * 100}%。确定转生吗？`, () => this.actions.rebirth());
        return;
      }
      const uid = actBtn.dataset.uid;
      if (act === 'equip') this.actions.equip(uid);
      else if (act === 'unequip') this.actions.unequip(actBtn.dataset.slot);
      else if (act === 'upgrade') this.actions.upgrade(uid);
      else if (act === 'reroll') this.actions.reroll(uid);
      else if (act === 'salvage') {
        const found = PLAYER.findItem(game.player, uid);
        if (!found || found.equipped) return;
        const item = found.item;
        if (item.rarity >= 3) {
          this.confirm('分解装备', `确定分解 ${item.name}？可获得 ${ITEMS.salvageValue(item)} 金币。`, () => this.actions.salvage(uid));
        } else {
          this.actions.salvage(uid);
        }
      }
      return;
    }
    const cell = e.target.closest('[data-uid]');
    if (cell) {
      this.detailUid = cell.dataset.uid;
      this.render();
      return;
    }
    const slot = e.target.closest('[data-slot]');
    if (slot && slot.dataset.uid) {
      this.detailUid = slot.dataset.uid;
      this.render();
    }
  },

  confirm(title, text, cb) {
    this.el.dialogTitle.textContent = title;
    this.el.dialogText.textContent = text;
    this.confirmCb = cb;
    this.el.dialog.classList.remove('hidden');
  },

  /* ------------------------------ 背包 ------------------------------ */
  bagHtml(game) {
    const p = game.player;
    const cells = [];
    for (const it of p.bag) {
      cells.push(this.cell(it, p));
    }
    for (let i = p.bag.length; i < DATA.BAG_SIZE; i++) {
      cells.push(`<div class="cell empty"><span class="glyph">·</span></div>`);
    }

    const counts = {};
    for (const it of p.bag) counts[it.rarity] = (counts[it.rarity] || 0) + 1;
    const rarityChips = DATA.RARITIES.map((r, i) => {
      const n = counts[i] || 0;
      return `<button class="rar-chip ${n ? '' : 'off'}" data-act="salvage-rarity" data-r="${i}" style="--rc:${r.color}" ${n ? '' : 'disabled'}>${r.name}<b>${n}</b></button>`;
    }).join('');

    const autoSalvage = p.autoSalvage >= 0 ? `回收 ≤ ${DATA.RARITIES[p.autoSalvage].name}` : '自动回收';

    return `
      <div class="bag-toolbar">
        <span class="cap">容量 ${p.bag.length} / ${DATA.BAG_SIZE}</span>
        <span class="cap">精粹 <b style="color:#9be0ff">${U.fmt(p.essence || 0)}</b></span>
        <span class="cap">碎片 <b style="color:#c9a6ff">${U.fmt(p.skillFrags || 0)}</b></span>
        <span class="spacer"></span>
        <button class="tiny-btn ${p.autoPickup === false ? '' : 'on'}" data-act="auto-pickup">自动拾取</button>
        <button class="tiny-btn ${p.autoSalvage >= 0 ? 'on' : ''}" data-act="auto-salvage">${autoSalvage}</button>
        <button class="tiny-btn ${p.autoPotion === false ? '' : 'on'}" data-act="auto-potion">自动喝药</button>
        <button class="tiny-btn" data-act="sort">整理</button>
      </div>
      <div class="bag-toolbar rar-bar">
        <span class="cap">分解</span>
        ${rarityChips}
      </div>
      <div class="item-grid">${cells.join('')}</div>
      ${p.bag.length === 0 ? '<div class="empty-tip">背包空空如也，去猎场里打点装备吧。</div>' : ''}
      <div class="zone-note">▲/▼ 表示换上后的战力变化 · 点击装备查看属性 · 自动回收只处理不弱于当前装备的低品级</div>
    `;
  },

  cell(item, p) {
    const r = item.rarity;
    let badge = '';
    if (p) {
      const d = PLAYER.powerDelta(p, item);
      if (d > 0) badge = `<span class="pw up">▲${U.fmt(d)}</span>`;
      else if (d < 0) badge = `<span class="pw down">▼${U.fmt(-d)}</span>`;
    }
    return `<button class="cell b${r} ${this.detailUid === item.uid ? 'selected' : ''}" data-uid="${item.uid}" style="border-color:${U.rgba(ITEMS.rarity(item).color, 0.55)}">
      ${ICONS.img(item)}
      ${item.upgrade ? `<span class="up">+${item.upgrade}</span>` : ''}
      ${item.setId ? '<span class="setdot"></span>' : ''}
      ${badge}
    </button>`;
  },

  /* ------------------------------ 角色 ------------------------------ */
  characterHtml(game) {
    const p = game.player;
    const st = p.stats;
    const slots = {};
    for (const s of DATA.SLOTS) slots[s.id] = s;
    const slotOrder = ['weapon', 'armor', 'helmet', 'necklace', 'bracelet1', 'bracelet2', 'ring1', 'ring2', 'belt', 'boots', 'medal'];
    const equipHtml = slotOrder
      .map((sid) => {
        const s = slots[sid];
        const it = p.equip[sid];
        const wide = sid === 'weapon' || sid === 'armor' || sid === 'medal' ? 'equip-width' : '';
        if (!it) {
          return `<div class="equip-slot ${wide}">
            <span class="slot-glyph">${ICONS.ghost(sid)}</span>
            <span class="slot-name">${s.name}<br>未装备</span>
          </div>`;
        }
        return `<button class="equip-slot has b${it.rarity} ${wide}" data-slot="${sid}" data-uid="${it.uid}">
          <span class="slot-glyph">${ICONS.img(it)}</span>
          <span class="slot-name" style="color:${ITEMS.rarity(it).color}">${U.esc(it.name)}<br><span style="color:#7d6a56">${s.name}</span></span>
          ${it.upgrade ? `<span class="slot-up">+${it.upgrade}</span>` : ''}
        </button>`;
      })
      .join('');

    const baseLines = [
      ['生命', U.num(st.hp)],
      ['魔法', U.num(st.mp)],
      ['攻击', U.num(st.atk)],
      ['道术', U.num(st.matk)],
      ['防御', U.num(st.def)],
      ['魔防', U.num(st.mdef)],
      ['准确', U.num(st.acc)],
      ['敏捷', U.num(st.agi)],
    ];
    const special = [
      ['crit', '暴击率', true], ['critDmg', '暴击伤害', true], ['pen', '破防', true],
      ['trueDmg', '切割', false], ['lifesteal', '吸血', true], ['reflect', '反伤', true],
      ['stun', '麻痹', true], ['freeze', '冰冻', true], ['poison', '中毒', true], ['burn', '灼烧', true],
      ['atkSpeed', '攻击速度', true], ['moveSpeed', '移动速度', true], ['bossDmg', '对BOSS伤害', true],
      ['holy', '神圣伤害', true], ['dmgReduce', '伤害减免', true], ['skillDmg', '技能伤害', true],
      ['dropRate', '爆率', true], ['expRate', '经验加成', true], ['goldRate', '金币加成', true],
      ['hpRegen', '生命回复', false], ['mpRegen', '魔法回复', false], ['healOnKill', '击杀回复', true],
      ['shield', '护盾', false], ['luck', '幸运', false],
    ];
    const specialLines = special
      .filter(([k]) => (st[k] || 0) > 0)
      .map(([k, label, isPct]) => {
        let v = st[k];
        let text;
        if (k === 'hpRegen' || k === 'mpRegen') text = `+${Math.round(v)}/5s`;
        else if (isPct) text = `+${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}%`;
        else text = `+${Math.round(v)}`;
        return `<div class="stat-line special"><span>${label}</span><b>${text}</b></div>`;
      })
      .join('') || '<div class="stat-line"><span>暂无特殊参数</span><b>—</b></div>';

    const setsHtml = p.activeSets.length
      ? p.activeSets
          .map((as) => {
            const set = DATA.SETS[as.id];
            const lines = set.bonuses
              .map((b) => `<li class="${as.count >= b.need ? 'on' : ''}">(${b.need}) ${b.text}</li>`)
              .join('');
            return `<div class="set-item"><div class="set-title"><span>${set.name}套</span><span>${as.count}/${set.slots.length}</span></div><ul>${lines}</ul></div>`;
          })
          .join('')
      : '<div class="stat-line"><span>未激活套装</span><b>—</b></div>';

    return `
      <div class="char-layout">
        <div>
          <div class="equip-panel">
            <div class="equip-grid">${equipHtml}</div>
            <div class="power-tag"><span>综合战力</span><b>${U.num(PLAYER.power(p))}</b></div>
            <div class="power-tag" style="margin-top:6px"><span>所在区域</span><b style="font-size:12px">${DATA.ZONES.find((z) => z.id === p.zone).name}</b></div>
            <div class="rebirth-box ${(p.rebirth || 0) > 0 ? 'has' : ''}">
              <div class="rebirth-head"><span>转生</span><b>${p.rebirth || 0} / ${DATA.REBIRTH.max} 转</b></div>
              <div class="rebirth-desc">满 Lv.${DATA.REBIRTH.levelReq} 后可转生：等级重置为 1，装备与背包保留，永久全属性 +${Math.round(DATA.REBIRTH.bonus * 100)}%（每转叠加）。</div>
              <button class="tiny-btn ${SYSTEMS.rebirthReady(p) ? 'on' : ''}" data-act="rebirth" ${SYSTEMS.rebirthReady(p) ? '' : 'disabled'}>
                ${(p.rebirth || 0) >= DATA.REBIRTH.max ? '已达上限' : SYSTEMS.rebirthReady(p) ? `转生 · ${U.fmt(SYSTEMS.rebirthCost(p))} 金币` : `需 Lv.${DATA.REBIRTH.levelReq}`}
              </button>
            </div>
          </div>
        </div>
        <div>
          <div class="stat-cols">
            <div class="stat-box">
              <h4>基础属性</h4>
              ${baseLines.map(([k, v]) => `<div class="stat-line"><span>${k}</span><b>${v}</b></div>`).join('')}
            </div>
            <div class="stat-box">
              <h4>特殊参数</h4>
              ${specialLines}
            </div>
            <div class="stat-box wide">
              <h4>套装共鸣</h4>
              <div class="set-list">${setsHtml}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /* ------------------------------ 技能 ------------------------------ */
  skillsHtml(game) {
    const p = game.player;
    const cls = DATA.CLASSES[p.clsId];
    const basic = cls.basic;
    const basicDesc =
      basic.type === 'melee'
        ? `近战挥砍，对身前敌人造成 ${Math.round(basic.power * 100)}% 攻击伤害。`
        : `发射${p.clsId === 'mage' ? '魔法弹' : '灵魂符'}，造成 ${Math.round(basic.power * 100)}% 道术伤害。`;
    const html = cls.skills
      .map((id, i) => {
        const s = DATA.SKILLS[id];
        return `<div class="skill-card">
          <div class="skill-ico">${s.icon}</div>
          <div class="skill-info">
            <h4>${s.name} <span style="color:#7d6a56;font-size:10px">[${i + 1}]</span></h4>
            <div class="skill-meta">消耗 ${s.mp} 魔法 · 冷却 ${s.cd}s</div>
            <div class="skill-desc">${s.desc}</div>
          </div>
        </div>`;
      })
      .join('');

    const learned = p.ultimates || [];
    const frag = p.skillFrags || 0;
    const cost = DATA.ULTIMATE_FRAG_COST;
    const books = p.ultBooks || 0;
    const ultCards = (cls.ultimates || [])
      .map((id) => {
        const s = DATA.ULTIMATES[id];
        const has = learned.includes(id);
        const slot = cls.skills.length + learned.indexOf(id) + 1;
        return `<div class="ult-card ${has ? 'unlocked' : 'locked'}">
          <div class="ult-ico">${s.icon}</div>
          <div class="ult-info">
            <h4>${s.name}${has ? `<span class="ult-tag">已习得 · 快捷键 ${slot}</span>` : '<span class="ult-tag">未习得</span>'}</h4>
            <div class="skill-meta">消耗 ${s.mp} 魔法 · 冷却 ${s.cd}s</div>
            <div class="skill-desc">${s.desc}</div>
          </div>
          ${has ? '' : `<button class="tiny-btn ${books > 0 ? 'on' : ''}" data-act="learn-ult" data-id="${id}" ${books > 0 ? '' : 'disabled'}>${books > 0 ? '研习' : '需要技能书'}</button>`}
        </div>`;
      })
      .join('');

    return `<div class="empty-tip" style="padding:0 0 14px;text-align:left;color:#95826c">
        职业：<b style="color:${cls.color}">${cls.name}</b> · 普攻：${basicDesc}
      </div>${html}
      <div class="codex-section-title">终极技能</div>
      <div class="ult-merge">
        <div class="ult-frag">
          <div class="ult-frag-head"><span>技能书碎片</span><b>${frag} / ${cost}</b></div>
          <div class="prog"><i style="width:${Math.min(100, (frag / cost) * 100).toFixed(1)}%"></i></div>
          <div class="ult-frag-note">BOSS 必掉 · 精英怪小概率掉落 · 已有技能书 <b>${books}</b> 本</div>
        </div>
        <button class="act primary" data-act="merge-ult" ${frag >= cost && learned.length < (cls.ultimates || []).length ? '' : 'disabled'}>${learned.length >= (cls.ultimates || []).length ? '已习得全部终极技能' : '合成终极技能书'}</button>
      </div>
      ${ultCards}
      <div class="zone-note">每本终极技能书可研习一个终极技能。每个职业有 2 个终极技能，全部习得需要 ${cost * 2} 个碎片；习得后出现在右下角技能栏（快捷键 5 / 6）。</div>`;
  },

  /* ------------------------------ 传送 ------------------------------ */
  travelHtml(game) {
    const p = game.player;
    const cards = DATA.ZONES.map((z) => {
      const locked = p.level < z.req;
      const current = p.zone === z.id;
      const boss = DATA.MONSTERS[z.boss];
      return `<div class="zone-card ${current ? 'current' : ''} ${locked ? 'locked' : ''}">
        <div class="zone-emblem">${z.name.slice(0, 1)}</div>
        <div class="zone-info">
          <h4>${z.name} <span style="font-size:10px;color:#8b775f">${z.sub}</span></h4>
          <p>需求 Lv.${z.req} · 怪物 Lv.${z.lvl} · 掉落 <b>${z.dropHint}</b></p>
          <p>BOSS：<b>${boss.name}</b> · ${z.desc}</p>
        </div>
        <button class="zone-go" data-act="travel" data-zone="${z.id}" ${locked || current ? 'disabled' : ''}>
          ${current ? '当前' : locked ? 'Lv.' + z.req : '传送'}
        </button>
      </div>`;
    }).join('');
    return `${cards}<div class="zone-note">传送会重新生成地图并刷新怪物，已装备与背包物品不会丢失。<br>等级不足时无法进入高階地图。</div>`;
  },

  /* ------------------------------ 试炼塔 ------------------------------ */
  trialHtml(game) {
    const p = game.player;
    const run = game.trial;
    const nextFloor = Math.max(1, p.towerFloor || 1);
    const entryFloor = SYSTEMS.trialEntryFloor(p);
    const floor = run ? run.floor : entryFloor;
    const cfg = run ? run.cfg : SYSTEMS.trialConfig(floor);
    const reward = SYSTEMS.trialReward(floor);
    const best = p.towerBest || 0;
    const mods = cfg.mods.length
      ? cfg.mods.map((m) => `<div class="mod-chip"><b>${m.name}</b><span>${m.desc}</span></div>`).join('')
      : '<div class="mod-chip none"><b>无词缀</b><span>第 1 层是纯净试炼，用来熟悉节奏。</span></div>';
    const status = run
      ? run.state === 'clear'
        ? `<div class="trial-run">
            <div class="trial-run-head"><span>第 ${run.floor} 层已通关</span><span>奖励已入账</span></div>
            <div class="trial-run-meta"><span>${run.nextT > 0 ? `${Math.ceil(run.nextT)} 秒后自动进入第 ${run.floor + 1} 层` : '准备进入下一层'}</span><span>${cfg.zone.name}</span></div>
          </div>
          <div class="trial-actions">
            <button class="act primary" data-act="enter-trial" data-floor="${run.floor + 1}">立即进入第 ${run.floor + 1} 层</button>
            <button class="act danger" data-act="leave-trial">离开试炼塔</button>
          </div>`
        : `<div class="trial-run">
            <div class="trial-run-head"><span>第 ${run.floor} 层进行中</span><span>${run.killed} / ${run.need}</span></div>
            <div class="prog"><i style="width:${Math.min(100, (run.killed / run.need) * 100).toFixed(1)}%"></i></div>
            <div class="trial-run-meta"><span>剩余时间 ${U.timeText(run.timeLeft)}</span><span>${cfg.zone.name}</span></div>
          </div>
          <button class="act danger" data-act="leave-trial">离开试炼塔</button>`
      : `<button class="act primary" data-act="enter-trial" data-floor="${entryFloor}">进入第 ${entryFloor} 层</button>`;

    return `
      <div class="trial-hero">
        <div class="trial-emblem">塔</div>
        <div class="trial-hero-info">
          <h3>试炼之塔</h3>
          <p>每层固定怪物配比与难度词缀，限时清场后自动进入下一层。死亡或超时即止步，最高层永久记录。</p>
        </div>
        <div class="trial-best"><span>历史最高</span><b>${best} 层</b></div>
      </div>
      <div class="trial-stats">
        <div><span>本层怪物</span><b>${cfg.count} 只</b></div>
        <div><span>怪物等级</span><b>Lv.${cfg.level}</b></div>
        <div><span>限时</span><b>${U.timeText(cfg.time)}</b></div>
        <div><span>通关奖励</span><b>${U.fmt(reward.gold)} 金币 · ${reward.essence} 精粹</b></div>
      </div>
      <div class="codex-section-title">本层词缀</div>
      <div class="mod-list">${mods}</div>
      <div class="codex-section-title">挑战</div>
      ${status}
      <div class="zone-note">奖励随层数递增，每 7 层必掉一件更高品级装备。层数越高词缀越多（最多 3 条）。${entryFloor > nextFloor ? `<br>按当前等级推荐从第 <b>${entryFloor}</b> 层起步，低层可直接跨过。` : ''}</div>
    `;
  },

  /* ------------------------------ 悬赏榜 ------------------------------ */
  bountyHtml(game) {
    const p = game.player;
    const b = p.bounty;
    if (!b || !Array.isArray(b.tasks) || !b.tasks.length) {
      return '<div class="empty-tip">悬赏榜正在张贴，请稍后再来。</div>';
    }
    const claimable = SYSTEMS.bountyClaimable(p);
    const done = SYSTEMS.bountyDone(p);
    const rows = b.tasks
      .map((t) => {
        const pct = Math.min(100, (t.prog / t.need) * 100);
        const ready = !t.claimed && t.prog >= t.need;
        const r = t.reward || {};
        return `<div class="bounty-card ${t.claimed ? 'claimed' : ready ? 'ready' : ''}">
          <div class="bounty-head"><b>${t.title}</b><span class="bounty-tag">${t.claimed ? '已领取' : ready ? '可领取' : t.prog + ' / ' + t.need}</span></div>
          <div class="bounty-desc">${t.desc}</div>
          <div class="prog"><i style="width:${pct.toFixed(1)}%"></i></div>
          <div class="bounty-foot">
            <span class="bounty-reward">
              <span class="rw gold">金币 ${U.fmt(r.gold || 0)}</span>
              <span class="rw">精粹 ${r.essence || 0}</span>
              ${r.potion ? `<span class="rw pot">药水 ${r.potion.hp || 0}/${r.potion.mp || 0}</span>` : ''}
            </span>
            <button class="act ${ready ? 'primary' : ''}" data-act="claim-bounty" data-id="${t.id}" ${ready ? '' : 'disabled'}>${t.claimed ? '已领' : '领取'}</button>
          </div>
        </div>`;
      })
      .join('');
    return `
      <div class="bounty-top">
        <div><span>可领取</span><b>${claimable} / ${b.tasks.length}</b></div>
        <div><span>状态</span><b>${done ? '全部完成' : '进行中'}</b></div>
        <button class="tiny-btn ${done ? 'on' : ''}" data-act="refresh-bounty">刷新悬赏</button>
      </div>
      ${rows}
      <div class="zone-note">击杀、拾取、分解、强化成功、通关试炼都会推进对应条目，进度实时累计。全部领取后可免费刷新。</div>
    `;
  },

  /* ------------------------------ 锻造 ------------------------------ */
  slotLabel(id) {
    const map = { bracelet1: '手镯一', bracelet2: '手镯二', ring1: '戒指一', ring2: '戒指二' };
    return map[id] || ITEMS.slotName(id);
  },

  forgeHtml(game) {
    const p = game.player;
    const pairs = SYSTEMS.fuseCandidates(p);
    const preview = pairs
      .slice(0, 6)
      .map(([a]) => {
        const rd = DATA.RARITIES[a.rarity];
        const nx = DATA.RARITIES[Math.min(5, a.rarity + 1)];
        return `<div class="fuse-line">
          <span style="color:${rd.color}">[${rd.name}] ${this.slotLabel(a.slot)}</span>
          <span class="fuse-arrow">→</span>
          <span style="color:${nx.color}">[${nx.name}]</span>
          <span class="fuse-cost">${U.fmt(SYSTEMS.fuseCost(a))} 金币</span>
        </div>`;
      })
      .join('');
    const slotBtns = DATA.SLOTS.map(
      (s) => `<button class="tiny-btn ${s.id === this.forgeSlot ? 'on' : ''}" data-act="forge-slot" data-slot="${s.id}">${this.slotLabel(s.id)}</button>`
    ).join('');
    const craftRows = DATA.FORGE.craft
      .map((c) => {
        const rd = DATA.RARITIES[c.rarity];
        const enough = p.level >= c.levelReq && (p.essence || 0) >= c.essence && p.gold >= c.gold && p.bag.length < DATA.BAG_SIZE;
        return `<div class="craft-row">
          <span class="craft-rar" style="color:${rd.color}">${rd.name}</span>
          <span class="craft-need">${c.essence} 精粹 · ${U.fmt(c.gold)} 金币 · Lv.${c.levelReq}</span>
          <button class="tiny-btn ${enough ? 'on' : ''}" data-act="craft" data-slot="${this.forgeSlot}" data-r="${c.rarity}" ${enough ? '' : 'disabled'}>打造</button>
        </div>`;
      })
      .join('');
    return `
      <div class="forge-balance"><span>精粹</span><b>${U.fmt(p.essence || 0)}</b><span class="forge-hint">分解装备获得</span></div>
      <div class="codex-section-title">装备合成</div>
      <div class="codex-tip">两件<strong>同部位、同品级</strong>的装备可合成一件高一品级的装备，强化等级取两者较高值（上限 +10）。品级越高，合成费用越贵。</div>
      <div class="fuse-list">${preview || '<div class="fuse-line empty">背包里没有可成对的装备</div>'}</div>
      <button class="act primary" data-act="fuse-all" ${pairs.length ? '' : 'disabled'}>一键合成（${pairs.length} 对）</button>
      <div class="codex-section-title">定向打造</div>
      <div class="codex-tip">选择部位后，消耗精粹与金币直接打造一件该品级装备。部位可控、品级固定，用于补齐短板。</div>
      <div class="craft-slots">${slotBtns}</div>
      <div class="craft-list">${craftRows}</div>
      <div class="zone-note">当前部位：<b>${this.slotLabel(this.forgeSlot)}</b> · 打造品级越高消耗越大，但能稳定补上缺的部位。</div>
    `;
  },

  /* ------------------------------ 装备图鉴 ------------------------------ */
  codexHtml() {
    const groups = [
      ['输出', ['crit', 'critDmg', 'pen', 'trueDmg', 'skillDmg', 'bossDmg', 'holy']],
      ['持续', ['lifesteal', 'reflect', 'poison', 'burn', 'hpRegen', 'mpRegen', 'healOnKill']],
      ['控制', ['stun', 'freeze']],
      ['攻防', ['atkSpeed', 'moveSpeed', 'shield', 'dmgReduce', 'allStats']],
      ['收益', ['dropRate', 'expRate', 'goldRate', 'luck']],
    ];

    const affixHtml = groups
      .map(([title, ids]) => {
        const rows = ids
          .map((id) => {
            const a = DATA.AFFIXES[id];
            if (!a) return '';
            return `<div class="codex-row">
              <div class="codex-name">${a.name}<span>基准 ${a.min}~${a.max}${a.suffix || ''}</span></div>
              <div class="codex-desc">${a.desc || ''}</div>
            </div>`;
          })
          .join('');
        return `<div class="codex-group"><div class="codex-group-title">${title}</div>${rows}</div>`;
      })
      .join('');

    const uniqueHtml = Object.values(DATA.UNIQUES)
      .map((u) => {
        const stats = Object.entries(u.stats || {})
          .map(([k, v]) => `${ITEMS.statLabel(k)} ${ITEMS.formatValue(k, v)}`)
          .join(' · ');
        return `<div class="codex-row unique">
          <div class="codex-name"><b>【${u.name}】</b><span>${stats}</span></div>
          <div class="codex-desc">${u.text || ''}</div>
        </div>`;
      })
      .join('');

    const slotText = (slots) => {
      const m = {};
      for (const s of slots) {
        const n = ITEMS.slotName(s);
        m[n] = (m[n] || 0) + 1;
      }
      return Object.entries(m)
        .map(([n, c]) => (c > 1 ? `${n}×${c}` : n))
        .join(' / ');
    };

    const setHtml = Object.values(DATA.SETS)
      .map((set) => {
        const bonuses = set.bonuses
          .map((b) => `<div class="codex-bonus"><em>${b.need} 件</em>${b.text}</div>`)
          .join('');
        return `<div class="codex-set">
          <div class="codex-set-head" style="color:${set.color}">${set.name}套<span>${slotText(set.slots)}</span></div>
          ${set.desc ? `<div class="codex-desc">${set.desc}</div>` : ''}
          ${bonuses}
        </div>`;
      })
      .join('');

    return `<div class="codex-tip">${DATA.AFFIX_TIP}</div>
      <div class="codex-section-title">特殊词条</div>
      ${affixHtml}
      <div class="codex-section-title">传说 / 神话专属词条</div>
      <div class="codex-group">${uniqueHtml}</div>
      <div class="codex-section-title">套装共鸣</div>
      ${setHtml}
      <div class="zone-note">传说及以上装备有概率携带具名词条；套装部位在掉落时随机指定，集齐需要反复刷图。</div>`;
  },

  /* ------------------------------ 装备详情 ------------------------------ */
  appendDetail(item, equipped, slotId) {
    const game = this.actions.getGame();
    const p = game.player;
    const host = this.el.panel;
    const existing = host.querySelector('.detail-overlay');
    if (existing) existing.remove();
    const warp = document.createElement('div');
    warp.className = 'detail-overlay';
    warp.innerHTML = this.detailHtml(item, equipped, slotId, p);
    host.appendChild(warp);
    warp.addEventListener('click', (e) => {
      if (e.target === warp) {
        this.detailUid = null;
        warp.remove();
      }
    });
  },

  detailHtml(item, equipped, slotId, p) {
    const rd = ITEMS.rarity(item);
    const slotName = ITEMS.slotName(slotId);
    const baseEntries = ITEMS.baseStatEntries(item);
    const affixEntries = ITEMS.affixEntries(item);
    const uq = item.uniqueId ? DATA.UNIQUES[item.uniqueId] : null;
    const uniqueStats = uq && uq.stats ? Object.entries(uq.stats).map(([k, v]) => ({ key: k, value: v })) : [];

    const reqOk = p.level >= (item.req || 1);
    const equippedSame = p.equip[item.slot];
    const delta = ITEMS.power(item) - (equippedSame && !equipped ? ITEMS.power(equippedSame) : equippedSame && equipped ? 0 : 0);
    const deltaHtml = !equipped && equippedSame
      ? `<span class="delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : ''}${U.num(delta)}</span>`
      : '';

    const baseLines = baseEntries
      .map((e) => `<div class="dline"><span>${ITEMS.statLabel(e.key)}</span><b>${ITEMS.formatValue(e.key, e.value).replace('+', '+')}</b></div>`)
      .join('');

    const specialLines = affixEntries
      .map((e) => {
        const def = DATA.AFFIXES[e.id] || {};
        const desc = def.desc ? `<div class="ddesc">${def.desc}</div>` : '';
        return `<div class="dline special"><span>${e.name}</span><b>${ITEMS.formatValue(e.id, e.value)}</b></div>${desc}`;
      })
      .join('');
    const uniqueStatLines = uniqueStats
      .map((e) => `<div class="dline special"><span>${ITEMS.statLabel(e.key)} <span style="color:#8a6c48">·词条</span></span><b>${ITEMS.formatValue(e.key, e.value)}</b></div>`)
      .join('');

    const set = item.setId ? DATA.SETS[item.setId] : null;
    let setHtml = '';
    if (set) {
      const counts = PLAYER.setCounts(p);
      let count = counts[item.setId] || 0;
      if (!equipped) count += 1;
      setHtml = `<div class="set-box">
        <div style="color:${set.color}">${set.name}套 <span style="float:right">${count}/${set.slots.length}</span></div>
        ${set.desc ? `<div class="set-desc">${set.desc}</div>` : ''}
        ${set.bonuses.map((b) => `<div class="${count >= b.need ? 'on' : ''}">(${b.need}件) ${b.text}</div>`).join('')}
      </div>`;
    }

    const upCost = ITEMS.upgradeCost(item);
    const upChance = ITEMS.upgradeChance(item);
    const maxed = item.upgrade >= 15;
    const rerollCost = ITEMS.rerollCost(item);
    const canAffordUp = p.gold >= upCost;
    const canAffordRe = p.gold >= rerollCost;

    const actions = [];
    if (equipped) {
      actions.push(`<button class="act" data-act="unequip" data-slot="${slotId}">卸下</button>`);
    } else {
      actions.push(`<button class="act primary" data-act="equip" data-uid="${item.uid}" ${reqOk ? '' : 'disabled'}>${reqOk ? '装备' : '等级不足'}</button>`);
    }
    actions.push(`<button class="act" data-act="upgrade" data-uid="${item.uid}" ${maxed || !canAffordUp ? 'disabled' : ''}>强化 +${item.upgrade + 1}<small>${maxed ? '已满级' : upCost + ' 金币 · ' + Math.round(upChance * 100) + '%'}</small></button>`);
    actions.push(`<button class="act" data-act="reroll" data-uid="${item.uid}" ${item.affixes.length === 0 || !canAffordRe ? 'disabled' : ''}>洗练<small>${item.affixes.length ? rerollCost + ' 金币' : '无词条'}</small></button>`);
    if (!equipped) {
      const partner = SYSTEMS.findFusePartner(p, item);
      const fuseCost = SYSTEMS.fuseCost(item);
      actions.push(
        `<button class="act" data-act="fuse" data-uid="${item.uid}" ${item.rarity >= 5 || !partner || p.gold < fuseCost ? 'disabled' : ''}>合成<small>${item.rarity >= 5 ? '已满品级' : !partner ? '缺少同品级装备' : fuseCost + ' 金币'}</small></button>`
      );
    }
    if (!equipped) {
      actions.push(`<button class="act danger" data-act="salvage" data-uid="${item.uid}">分解<small>+${ITEMS.salvageValue(item)} 金币 · ${ITEMS.salvageEssence(item)} 精粹</small></button>`);
    }

    return `<div class="detail-card">
      <div class="detail-head">
        <button class="close2" data-act="close-detail">✕</button>
        <div class="detail-title">
          <div class="detail-glyph" style="color:${rd.color};border-color:${U.rgba(rd.color, 0.5)}">${ICONS.img(item)}</div>
          <div>
            <div class="detail-name" style="color:${rd.color}">${U.esc(item.name)}${item.upgrade ? ` <span style="color:#ffd27a">+${item.upgrade}</span>` : ''}</div>
            <div class="detail-sub">${slotName} · 等级 ${item.req} · <span style="color:${rd.color}">${rd.name}</span>${item.setId ? ' · 套装' : ''}</div>
          </div>
        </div>
        <div class="detail-power">战力 <b>${U.num(ITEMS.power(item))}</b> ${deltaHtml}
          ${reqOk ? '' : '<span class="delta down">等级不足</span>'}
        </div>
      </div>
      <div class="detail-scroll">
        <div class="detail-section">基础属性</div>
        ${baseLines || '<div class="dline"><span>无</span><b>—</b></div>'}
        <div class="detail-section special">特殊参数</div>
        ${specialLines || '<div class="dline"><span>无附加词条</span><b>—</b></div>'}
        ${uniqueStatLines}
        ${uq ? `<div class="unique-box"><b>【${uq.name}】</b> ${uq.text}</div>` : ''}
        ${setHtml}
        ${item.upgrade ? `<div class="dline req" style="margin-top:8px"><span>强化加成</span><b>+${item.upgrade * 8}% 基础属性</b></div>` : ''}
      </div>
      <div class="detail-actions">${actions.join('')}</div>
    </div>`;
  },
};
