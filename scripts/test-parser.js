'use strict';

const { SettingsStore } = require('../src/core/settings-store');
const { QuotaAdapter } = require('../src/core/quota-adapter');
const { TranscriptMonitor } = require('../src/core/transcript-monitor');

const settings = new SettingsStore();
const quota = new QuotaAdapter();
const monitor = new TranscriptMonitor(quota, settings);

const snap = monitor.scan(true);
console.log('=== Active Session ===');
if (snap.activeSession) {
  const s = snap.activeSession;
  console.log({
    id: s.shortId,
    title: s.title,
    model: s.modelInfo.displayName,
    contextTokens: s.contextTokens,
    contextLimit: s.contextLimit,
    contextPct: s.contextPct + '%',
    sessionCacheHitPct: s.sessionCacheHitPct + '%',
    stepCacheHitPct: s.stepCacheHitPct + '%',
    latestSpeedTokSec: s.latestSpeedTokSec,
    avgSpeedTokSec: s.avgSpeedTokSec,
    turns: s.turns,
    plannerSteps: s.plannerSteps,
    isWorking: s.isWorking,
    isCacheCliff: s.isCacheCliff
  });
} else {
  console.log('None');
}

console.log('\n=== Ledger ===');
console.log('Today:', snap.ledger.today);
console.log('Last 7 Days:', snap.ledger.last7Days);
console.log('All Time:', snap.ledger.allTime);
console.log('Models:', snap.ledger.byModel.map((m) => `${m.displayName} (${m.calls} calls)`));
console.log('Quota:', snap.quota);
