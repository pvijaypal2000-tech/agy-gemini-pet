'use strict';

// Friendly names, context compaction reference thresholds, and API reference USD rates (per 1M tokens).
// Note: For Google AI Pro subscription users, USD values are API-equivalent reference estimates, not direct charges.

const MODEL_CATALOG = [
  {
    match: /gemini-4.*neon/i,
    displayName: 'Gemini 4 Neon',
    shortName: 'G4 Neon',
    contextLimit: 512000,
    inputPerM: 2.5,
    cacheReadPerM: 0.25,
    outputPerM: 15.0,
    color: '#a78bfa'
  },
  {
    match: /gemini-4.*hydrogen/i,
    displayName: 'Gemini 4 Hydrogen',
    shortName: 'G4 Hydro',
    contextLimit: 512000,
    inputPerM: 1.25,
    cacheReadPerM: 0.125,
    outputPerM: 10.0,
    color: '#60a5fa'
  },
  {
    match: /gemini-4.*carbon/i,
    displayName: 'Gemini 4 Carbon',
    shortName: 'G4 Carbon',
    contextLimit: 512000,
    inputPerM: 2.0,
    cacheReadPerM: 0.2,
    outputPerM: 12.0,
    color: '#38bdf8'
  },
  {
    match: /gemini-4.*argon/i,
    displayName: 'Gemini 4 Argon',
    shortName: 'G4 Argon',
    contextLimit: 512000,
    inputPerM: 1.5,
    cacheReadPerM: 0.15,
    outputPerM: 10.0,
    color: '#818cf8'
  },
  {
    match: /gemini-4.*flash/i,
    displayName: 'Gemini 4 Flash',
    shortName: 'G4 Flash',
    contextLimit: 512000,
    inputPerM: 0.3,
    cacheReadPerM: 0.03,
    outputPerM: 2.5,
    color: '#34d399'
  },
  {
    match: /gemini-4/i,
    displayName: 'Gemini 4',
    shortName: 'Gemini 4',
    contextLimit: 512000,
    inputPerM: 1.5,
    cacheReadPerM: 0.15,
    outputPerM: 10.0,
    color: '#7c83ff'
  },
  {
    match: /gemini-3.*pro/i,
    displayName: 'Gemini 3 Pro',
    shortName: 'G3 Pro',
    contextLimit: 256000,
    inputPerM: 1.25,
    cacheReadPerM: 0.125,
    outputPerM: 10.0,
    color: '#3b82f6'
  },
  {
    match: /gemini-3.*flash|gemini-2\.5-flash/i,
    displayName: 'Gemini Flash',
    shortName: 'G Flash',
    contextLimit: 256000,
    inputPerM: 0.15,
    cacheReadPerM: 0.015,
    outputPerM: 0.6,
    color: '#2dd4bf'
  },
  {
    match: /claude.*opus/i,
    displayName: 'Claude Opus',
    shortName: 'Opus',
    contextLimit: 200000,
    inputPerM: 15.0,
    cacheReadPerM: 1.5,
    outputPerM: 75.0,
    color: '#fb923c'
  },
  {
    match: /claude.*sonnet/i,
    displayName: 'Claude Sonnet',
    shortName: 'Sonnet',
    contextLimit: 200000,
    inputPerM: 3.0,
    cacheReadPerM: 0.3,
    outputPerM: 15.0,
    color: '#f59e0b'
  },
  {
    match: /gpt/i,
    displayName: 'GPT',
    shortName: 'GPT',
    contextLimit: 256000,
    inputPerM: 2.5,
    cacheReadPerM: 0.25,
    outputPerM: 10.0,
    color: '#10b981'
  }
];

function getModelInfo(rawModel) {
  const id = String(rawModel || 'unknown').trim();
  for (const entry of MODEL_CATALOG) {
    if (entry.match.test(id)) {
      const tierMatch = id.match(/-(xhigh|high|medium|low)$/i);
      const tier = tierMatch ? ` (${tierMatch[1].toUpperCase()})` : '';
      return {
        id,
        displayName: entry.displayName + tier,
        shortName: entry.shortName,
        contextLimit: entry.contextLimit,
        inputPerM: entry.inputPerM,
        cacheReadPerM: entry.cacheReadPerM,
        outputPerM: entry.outputPerM,
        color: entry.color
      };
    }
  }
  return {
    id,
    displayName: id === 'unknown' ? 'Antigravity' : id,
    shortName: id === 'unknown' ? 'AGY' : id.slice(0, 12),
    contextLimit: 256000,
    inputPerM: 1.25,
    cacheReadPerM: 0.125,
    outputPerM: 10.0,
    color: '#94a3b8'
  };
}

function estimateApiRefUsd(rawModel, inputTokens, cacheReadTokens, outputTokens) {
  const info = getModelInfo(rawModel);
  const usd =
    ((inputTokens || 0) / 1e6) * info.inputPerM +
    ((cacheReadTokens || 0) / 1e6) * info.cacheReadPerM +
    ((outputTokens || 0) / 1e6) * info.outputPerM;
  return usd;
}

function formatTokens(n) {
  const v = Number(n) || 0;
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e4) return (v / 1e3).toFixed(1) + 'K';
  if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
  return String(Math.round(v));
}

function formatUsd(v) {
  const n = Number(v) || 0;
  if (n === 0) return '$0.00';
  if (n < 0.01) return '$' + n.toFixed(4);
  return '$' + n.toFixed(2);
}

module.exports = {
  getModelInfo,
  estimateApiRefUsd,
  formatTokens,
  formatUsd
};
