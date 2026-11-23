'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.resolve(__dirname, '..', '..', 'config.json');

const DEFAULT_SOUND_EVENTS = {
  poke: { enabled: true, packOverride: '', customUrl: '', customName: '' },
  turn: { enabled: true, packOverride: '', customUrl: '', customName: '' },
  happy: { enabled: true, packOverride: '', customUrl: '', customName: '' },
  alert: { enabled: true, packOverride: '', customUrl: '', customName: '' },
  panel: { enabled: true, packOverride: '', customUrl: '', customName: '' },
  snap: { enabled: true, packOverride: '', customUrl: '', customName: '' }
};

const DEFAULT_SOUND = {
  enabled: true,
  pack: 'meow-bell',
  volume: 0.72,
  pitchSemitones: 0,
  speed: 1.0,
  decay: 1.0,
  brightness: 0.78,
  events: DEFAULT_SOUND_EVENTS
};

const DEFAULT_TOOLBOX = {
  pomodoro: {
    workMin: 25,
    breakMin: 5,
    phase: 'work',       // 'work' | 'break'
    running: false,
    endAt: 0,            // wall-clock timestamp when current phase ends
    remainingSec: 25 * 60
  },
  hydration: {
    enabled: false,
    intervalMin: 45,
    nextAt: 0,
    lastNotifiedAt: 0
  },
  stickyNote: {
    visible: false,
    text: '1. 保持缓存前缀稳定\n2. 换话题记得新开对话 ✨'
  }
};

const DEFAULT_SETTINGS = {
  activeSkinId: 'catgirl-classic',
  followMode: 'antigravity',
  dockEdge: 'right',
  relativeOffset: { dx: -18, dy: -16 },
  globalPos: { x: null, y: null },
  snapThreshold: 56,
  snapTopEnabled: false,
  flipOnLeft: true,
  scale: 1.0,
  spriteFps: 8,
  quietWhileWorking: true,
  silentLurk: false,
  sleepAfterSec: 300,
  showCompactPill: true,
  bubbleEnabled: true,
  bubbleDurationSec: 7,
  bubbleTemplate: '本轮 +{turnTokens} · 缓存 {cachePct}% · {speed}',
  contextWarnPct: 70,
  dailyBudgetTokens: 2000000,
  sound: DEFAULT_SOUND,
  toolbox: DEFAULT_TOOLBOX
};

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return patch !== undefined ? patch : base;
  }
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && base && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      out[k] = deepMerge(base[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

class SettingsStore {
  constructor(filePath = CONFIG_PATH) {
    this.filePath = filePath;
    this.data = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (typeof parsed.soundEnabled === 'boolean' && !parsed.sound) {
          parsed.sound = {
            enabled: parsed.soundEnabled,
            volume: typeof parsed.soundVolume === 'number' ? parsed.soundVolume : 0.72
          };
        }
        return deepMerge(DEFAULT_SETTINGS, parsed);
      }
    } catch {}
    return deepMerge(DEFAULT_SETTINGS, {});
  }

  getAll() {
    return deepMerge(DEFAULT_SETTINGS, this.data);
  }

  update(patch) {
    this.data = deepMerge(this.data, patch);
    this._save();
    return this.getAll();
  }

  reset() {
    this.data = deepMerge(DEFAULT_SETTINGS, {});
    this._save();
    return this.getAll();
  }

  resetSound() {
    this.data = deepMerge(this.data, { sound: DEFAULT_SOUND });
    this._save();
    return this.getAll();
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
}

module.exports = {
  SettingsStore,
  DEFAULT_SETTINGS,
  DEFAULT_SOUND,
  DEFAULT_TOOLBOX
};
