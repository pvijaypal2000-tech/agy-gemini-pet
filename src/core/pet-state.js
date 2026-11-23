'use strict';

const fs = require('fs');
const path = require('path');

const PET_STATE_PATH = path.resolve(__dirname, '..', '..', 'pet-state.json');

const BOND_TIERS = [
  { level: 1, min: 0, title: '初次邂逅' },
  { level: 2, min: 25, title: '桌角小伙伴' },
  { level: 3, min: 70, title: '默契搭子' },
  { level: 4, min: 140, title: '缓存守门员' },
  { level: 5, min: 260, title: '代码论文战友' },
  { level: 6, min: 450, title: '双子星共鸣者' },
  { level: 7, min: 700, title: '反重力星灵契约者' }
];

const DEFAULT_PET_STATE = {
  affinity: 10,
  treats: 6,
  totalPats: 0,
  totalFeeds: 0,
  totalPomodoros: 0,
  snakeBestScore: 0,
  lastPatAt: 0,
  nicknames: {} // { [skinId]: 'custom nickname' }
};

function computeTier(affinity) {
  const val = Math.max(0, Number(affinity) || 0);
  let cur = BOND_TIERS[0];
  let next = BOND_TIERS[1];
  for (let i = 0; i < BOND_TIERS.length; i++) {
    if (val >= BOND_TIERS[i].min) {
      cur = BOND_TIERS[i];
      next = BOND_TIERS[i + 1] || null;
    }
  }
  const progressPct = next
    ? Math.min(100, Math.round(((val - cur.min) / Math.max(1, next.min - cur.min)) * 100))
    : 100;
  return {
    level: cur.level,
    title: cur.title,
    currentMin: cur.min,
    nextMin: next ? next.min : cur.min,
    nextTitle: next ? next.title : 'MAX 羁绊',
    progressPct
  };
}

class PetStateStore {
  constructor(filePath = PET_STATE_PATH) {
    this.filePath = filePath;
    this.data = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        return {
          ...DEFAULT_PET_STATE,
          ...parsed,
          nicknames: { ...(parsed.nicknames || {}) }
        };
      }
    } catch {}
    return { ...DEFAULT_PET_STATE, nicknames: {} };
  }

  _save() {
    try {
      const tmp = `${this.filePath}.tmp.${process.pid}`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2) + '\n', 'utf8');
      try {
        fs.renameSync(tmp, this.filePath);
      } catch {
        fs.copyFileSync(tmp, this.filePath);
        fs.rmSync(tmp, { force: true });
      }
    } catch {}
  }

  getSnapshot() {
    return {
      ...this.data,
      nicknames: { ...this.data.nicknames },
      tier: computeTier(this.data.affinity)
    };
  }

  pat() {
    const now = Date.now();
    const cooldownMs = 15000;
    const prevTier = computeTier(this.data.affinity).level;
    this.data.totalPats += 1;
    let gained = 0;
    if (now - (this.data.lastPatAt || 0) >= cooldownMs) {
      gained = 1;
      this.data.affinity += gained;
      this.data.lastPatAt = now;
    }
    this._save();
    const snap = this.getSnapshot();
    return {
      ...snap,
      gained,
      leveledUp: snap.tier.level > prevTier,
      cooldownRemainSec: gained ? 0 : Math.ceil((cooldownMs - (now - this.data.lastPatAt)) / 1000)
    };
  }

  feed(amount = 1) {
    const use = Math.max(1, Number(amount) || 1);
    if (this.data.treats < use) {
      return { ok: false, reason: 'no-treats', state: this.getSnapshot() };
    }
    const prevTier = computeTier(this.data.affinity).level;
    this.data.treats -= use;
    this.data.totalFeeds += use;
    const gained = use * 5;
    this.data.affinity += gained;
    this._save();
    const snap = this.getSnapshot();
    return {
      ok: true,
      gained,
      leveledUp: snap.tier.level > prevTier,
      state: snap
    };
  }

  reward(treatsDelta = 0, affinityDelta = 0, meta = {}) {
    const prevTier = computeTier(this.data.affinity).level;
    if (treatsDelta > 0) this.data.treats = Math.min(999, this.data.treats + treatsDelta);
    if (affinityDelta > 0) this.data.affinity += affinityDelta;
    if (meta.pomodoroCompleted) this.data.totalPomodoros += 1;
    this._save();
    const snap = this.getSnapshot();
    return {
      state: snap,
      leveledUp: snap.tier.level > prevTier
    };
  }

  recordSnakeScore(score) {
    const s = Math.max(0, Math.floor(Number(score) || 0));
    const isNewBest = s > (this.data.snakeBestScore || 0);
    if (isNewBest) this.data.snakeBestScore = s;
    const bonusTreats = s >= 10 ? 1 : 0;
    const bonusAffinity = s >= 5 ? 2 : 0;
    if (bonusTreats > 0) this.data.treats = Math.min(999, this.data.treats + bonusTreats);
    if (bonusAffinity > 0) this.data.affinity += bonusAffinity;
    this._save();
    return {
      isNewBest,
      bonusTreats,
      bonusAffinity,
      state: this.getSnapshot()
    };
  }

  setNickname(skinId, name) {
    if (!skinId) return this.getSnapshot();
    const trimmed = String(name || '').trim().slice(0, 16);
    if (trimmed) {
      this.data.nicknames[skinId] = trimmed;
    } else {
      delete this.data.nicknames[skinId];
    }
    this._save();
    return this.getSnapshot();
  }
}

module.exports = {
  PetStateStore,
  BOND_TIERS,
  computeTier
};
