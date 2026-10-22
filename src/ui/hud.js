import { U } from '../core/util.js';
import { DATA } from '../data/gamedata.js';
import { ITEMS } from '../game/items.js';

export const HUD = {
  actions: {},
  el: {},
  builtCls: null,
  skillButtons: [],
  skillIds: [],
  _cache: {},
  _buffSig: '',

  init(actions) {
    this.actions = actions;
    const ids = [
      'hud', 'avatar', 'charName', 'charLv', 'hpFill', 'hpText', 'mpFill', 'mpText', 'expFill',
      'zoneName', 'zoneLv', 'goldText', 'autoBtn', 'soundBtn', 'bossBar', 'bossName', 'bossFill',
      'buffRow', 'skillRow', 'attackBtn', 'potionHp', 'potionMp', 'hpPotion', 'mpPotion',
      'joystick', 'stick', 'sideRail', 'deathScreen', 'deathInfo', 'reviveBtn', 'toasts',
    ];
    for (const id of ids) this.el[id] = document.getElementById(id);

    this.el.attackBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      actions.setAttack(true);
    });
    const release = () => actions.setAttack(false);
    this.el.attackBtn.addEventListener('pointerup', release);
    this.el.attackBtn.addEventListener('pointercancel', release);
    this.el.attackBtn.addEventListener('pointerleave', release);

    this.el.potionHp.addEventListener('click', () => actions.usePotion('hp'));
    this.el.potionMp.addEventListener('click', () => actions.usePotion('mp'));
    this.el.autoBtn.addEventListener('click', () => actions.toggleAuto());
    this.el.soundBtn.addEventListener('click', () => actions.toggleSound());
    this.el.reviveBtn.addEventListener('click', () => actions.revive());

    this.el.sideRail.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-panel]');
      if (!btn) return;
      actions.openPanel(btn.dataset.panel);
    });
  },

  buildSkills(game) {
    const p = game.player;
    const cls = DATA.CLASSES[p.clsId];
    if (!cls) return;
    const ults = (p.ultimates || []).filter((id) => DATA.ULTIMATES[id] && DATA.ULTIMATES[id].cls === p.clsId);
    const ids = cls.skills.concat(ults);
    const sig = p.clsId + '|' + ults.join(',');
    if (this.builtCls === sig) return;
    this.builtCls = sig;
    this.skillIds = ids;
    this.el.skillRow.innerHTML = '';
    this.el.skillRow.classList.toggle('many', ids.length > 4);
    this.skillButtons = [];
    ids.forEach((id, i) => {
      const skill = DATA.SKILLS[id] || DATA.ULTIMATES[id];
      if (!skill) return;
      const btn = document.createElement('button');
      btn.className = 'skill-btn' + (DATA.ULTIMATES[id] ? ' ult' : '');
      btn.innerHTML = `<span>${skill.icon}</span><span class="cd hidden"></span><span class="key">${i + 1}</span>`;
      btn.title = skill.name;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.actions.useSkill(i);
      });
      this.el.skillRow.appendChild(btn);
      this.skillButtons.push(btn);
    });
    this.el.avatar.textContent = cls.glyph;
  },

  update(game) {
    const p = game.player;
    if (!p) return;
    this.buildSkills(game);
    const st = p.stats;

    const hpPct = U.clamp((p.hp / st.hp) * 100, 0, 100);
    if (this._cache.hp !== hpPct.toFixed(1)) {
      this.el.hpFill.style.width = hpPct.toFixed(1) + '%';
      this._cache.hp = hpPct.toFixed(1);
    }
    const mpPct = U.clamp((p.mp / st.mp) * 100, 0, 100);
    if (this._cache.mp !== mpPct.toFixed(1)) {
      this.el.mpFill.style.width = mpPct.toFixed(1) + '%';
      this._cache.mp = mpPct.toFixed(1);
    }
    const need = DATA.expNeed(p.level);
    const expPct = p.level >= DATA.MAX_LEVEL ? 100 : U.clamp((p.exp / need) * 100, 0, 100);
    this.el.expFill.style.width = expPct.toFixed(1) + '%';

    this.el.hpText.textContent = `${U.fmt(Math.ceil(p.hp))} / ${U.fmt(st.hp)}`;
    this.el.mpText.textContent = `${U.fmt(Math.ceil(p.mp))} / ${U.fmt(st.mp)}`;
    this.el.charName.textContent = p.name;
    this.el.charLv.textContent = 'Lv.' + p.level + (p.level >= DATA.MAX_LEVEL ? ' · 满级' : '');

    const goldStr = U.fmt(p.gold);
    if (this._cache.gold !== goldStr) {
      this.el.goldText.textContent = goldStr;
      this._cache.gold = goldStr;
    }

    const zone = DATA.ZONES.find((z) => z.id === p.zone) || DATA.ZONES[0];
    const zkey = game.trial ? 't' + game.trial.floor : zone.id;
    if (this._cache.zone !== zkey) {
      this.el.zoneName.textContent = game.trial ? `试炼塔 · 第 ${game.trial.floor} 层` : zone.name;
      this._cache.zone = zkey;
    }
    let zlv = 'Lv.' + zone.lvl;
    if (game.trial) {
      const t = game.trial;
      zlv = t.state === 'clear' ? '通关' : `${Math.max(0, Math.ceil(t.timeLeft))}s · ${t.killed}/${t.need}`;
    }
    if (this._cache.zlv !== zlv) {
      this.el.zoneLv.textContent = zlv;
      this._cache.zlv = zlv;
    }

    const potSig = p.potions.hp + '/' + p.potions.mp;
    if (this._cache.potions !== potSig) {
      this.el.hpPotion.textContent = p.potions.hp;
      this.el.mpPotion.textContent = p.potions.mp;
      this._cache.potions = potSig;
    }

    if (this._cache.auto !== p.auto) {
      this.el.autoBtn.classList.toggle('on', !!p.auto);
      this.el.autoBtn.textContent = p.auto ? '自动' : '手动';
      this.el.attackBtn.classList.toggle('auto', !!p.auto);
      this._cache.auto = p.auto;
    }
    if (this._cache.sound !== p.sound) {
      this.el.soundBtn.classList.toggle('on', !!p.sound);
      this.el.soundBtn.textContent = p.sound ? '音效' : '静音';
      this._cache.sound = p.sound;
    }

    // 技能冷却
    const skillIds = this.skillIds.length ? this.skillIds : DATA.CLASSES[p.clsId].skills;
    skillIds.forEach((id, i) => {
      const btn = this.skillButtons[i];
      if (!btn) return;
      const cd = game.skillCd[id] || 0;
      const cdEl = btn.querySelector('.cd');
      if (cd > 0.05) {
        cdEl.classList.remove('hidden');
        cdEl.textContent = cd >= 10 ? Math.ceil(cd) : cd.toFixed(1);
      } else {
        cdEl.classList.add('hidden');
      }
      const def = DATA.SKILLS[id] || DATA.ULTIMATES[id];
      const lacking = p.mp < def.mp;
      btn.style.opacity = lacking ? '0.55' : '1';
    });

    // 增益
    const sig = p.buffs.map((b) => b.id + Math.ceil(b.t)).join('|');
    if (sig !== this._buffSig) {
      this._buffSig = sig;
      this.el.buffRow.innerHTML = p.buffs
        .map((b) => {
          const pct = U.clamp((b.t / b.max) * 100, 0, 100);
          return `<div class="buff-icon" title="${U.esc(b.name)} ${U.timeText(b.t)}">${U.esc(b.icon)}<i style="width:${pct}%"></i></div>`;
        })
        .join('');
    }

    // BOSS 血条
    const boss = game.activeBoss;
    const bossSig = boss && boss.hp > 0 ? boss.uid : 'none';
    if (this._cache.bossSig !== bossSig) {
      this._cache.bossSig = bossSig;
      if (boss && boss.hp > 0) {
        this.el.bossBar.classList.remove('hidden');
        this.el.bossName.textContent = `${boss.def.name}  ·  Lv.${boss.lvl}`;
      } else {
        this.el.bossBar.classList.add('hidden');
      }
    }
    if (boss && boss.hp > 0) {
      const bp = U.clamp((boss.hp / boss.maxHp) * 100, 0, 100);
      this.el.bossFill.style.width = bp.toFixed(1) + '%';
    }
  },

  toast(text, type = '') {
    const wrap = this.el.toasts || document.getElementById('toasts');
    if (!wrap) return;
    const div = document.createElement('div');
    div.className = 'toast ' + type;
    div.textContent = text;
    wrap.appendChild(div);
    while (wrap.children.length > 4) wrap.removeChild(wrap.firstChild);
    setTimeout(() => {
      div.style.transition = 'opacity .3s ease, transform .3s ease';
      div.style.opacity = '0';
      div.style.transform = 'translateY(6px)';
      setTimeout(() => div.remove(), 320);
    }, 2200);
  },

  showDeath(info) {
    this.el.deathInfo.textContent = info;
    this.el.deathScreen.classList.remove('hidden');
  },
  hideDeath() {
    this.el.deathScreen.classList.add('hidden');
  },

  resetCache() {
    this._cache = {};
    this._buffSig = '';
    this.builtCls = null;
  },

  topRarityClass(rarity) {
    return ITEMS.rarity({ rarity }).id;
  },
};
