'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Extensible cloud quota adapter.
 * Default mode: pure local transcript budget tracking (zero dependencies, zero invasive hooks).
 * Optional upgrade: if `yuhuan-dev/antigravity-usage-monitor` is installed under
 * `~/.gemini/config/plugins/usage-monitor`, reads its cached local quota snapshot (read-only).
 */
class QuotaAdapter {
  constructor() {
    const home = process.env.USERPROFILE || os.homedir();
    this.usageMonitorDir = path.join(home, '.gemini', 'config', 'plugins', 'usage-monitor');
    this.pluginDataDir = path.join(home, '.gemini', 'antigravity', 'plugin_data', 'usage-monitor');
  }

  getQuotaSnapshot(todayBillableTokens, dailyBudgetTokens) {
    const pluginInstalled = fs.existsSync(this.usageMonitorDir);
    let cloudPools = null;

    if (pluginInstalled) {
      cloudPools = this._tryReadCachedPools();
    }

    const budget = Math.max(100000, Number(dailyBudgetTokens) || 2000000);
    const used = Number(todayBillableTokens) || 0;
    const remainPct = Math.max(0, Math.min(100, Math.round((1 - used / budget) * 100)));

    return {
      source: cloudPools ? 'usage-monitor-cache' : 'local-budget',
      pluginInstalled,
      pools: cloudPools,
      localBudget: {
        usedTokens: used,
        budgetTokens: budget,
        usedPct: Math.min(100, Math.round((used / budget) * 100)),
        remainPct
      }
    };
  }

  _tryReadCachedPools() {
    const candidates = [
      path.join(this.pluginDataDir, 'quota-cache.json'),
      path.join(this.usageMonitorDir, 'quota-cache.json'),
      path.join(this.pluginDataDir, '.deep_stats_cache.json')
    ];
    for (const file of candidates) {
      try {
        if (!fs.existsSync(file)) continue;
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (raw && Array.isArray(raw.pools) && raw.pools.length > 0) {
          return raw.pools;
        }
      } catch {
        // Ignore incompatible cache schemas gracefully
      }
    }
    return null;
  }
}

module.exports = { QuotaAdapter };
