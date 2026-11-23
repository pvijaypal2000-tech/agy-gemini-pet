'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getModelInfo, estimateApiRefUsd } = require('./pricing');

const CACHE_CLIFF_MIN_PREV_CTX = 8000;
const CACHE_CLIFF_RETENTION_RATIO = 0.55;
const CACHE_CLIFF_MIN_DROP = 6000;
const CACHE_CLIFF_MIN_INPUT_SPIKE = 5000;

function getLocalDateKey(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function extractUsage(step) {
  const u = step && step.usage && typeof step.usage === 'object' ? step.usage : step || {};
  const input =
    typeof u.input_tokens === 'number'
      ? u.input_tokens
      : typeof u.prompt_tokens === 'number'
        ? u.prompt_tokens
        : 0;
  const output =
    typeof u.output_tokens === 'number'
      ? u.output_tokens
      : typeof u.completion_tokens === 'number'
        ? u.completion_tokens
        : 0;
  const cacheRead =
    typeof u.cache_read_tokens === 'number'
      ? u.cache_read_tokens
      : typeof u.cached_tokens === 'number'
        ? u.cached_tokens
        : 0;
  const hasUsage =
    typeof u.input_tokens === 'number' ||
    typeof u.output_tokens === 'number' ||
    typeof u.cache_read_tokens === 'number' ||
    typeof u.prompt_tokens === 'number';
  return { input, output, cacheRead, hasUsage };
}

function cleanPreviewTitle(text) {
  if (typeof text !== 'string') return '';
  const cleaned = text
    .replace(/<USER_REQUEST>|<\/USER_REQUEST>/g, '')
    .replace(/<ADDITIONAL_METADATA>[\s\S]*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 36 ? cleaned.slice(0, 36) + '…' : cleaned;
}

function classifyToolActivity(toolCalls) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    return { key: 'thinking', label: '✨ 思考中', toolName: '' };
  }
  const names = toolCalls.map((tc) => String(tc?.name || tc?.tool || tc?.function?.name || '').toLowerCase());
  const last = names[names.length - 1] || '';

  if (names.some((n) => /run_command|run_checks|manage_task|terminal|bash|shell/.test(n))) {
    return { key: 'terminal', label: '💻 跑命令中', toolName: last };
  }
  if (names.some((n) => /edit_file|write_file|apply_edits|create_file/.test(n))) {
    return { key: 'editing', label: '✏️ 写代码中', toolName: last };
  }
  if (names.some((n) => /invoke_subagent|swarm|run_workflow|send_message/.test(n))) {
    return { key: 'subagent', label: '🤖 派子代理', toolName: last };
  }
  if (names.some((n) => /search_web|batch_search|literature|pubmed|openalex|arxiv|biorxiv|clinical_trials|openfda/.test(n))) {
    return { key: 'searching', label: '🔍 查资料中', toolName: last };
  }
  if (names.some((n) => /read_file|view_file|quick_outline|read_slices|list_resources|read_resource/.test(n))) {
    return { key: 'reading', label: '📖 读文件中', toolName: last };
  }
  return { key: 'working', label: '⚡ 执行工具', toolName: last };
}

function parseTranscriptFile(filePath, convId, mtimeMs) {
  let raw = '';
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }

  const lines = raw.split('\n');
  const steps = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    try {
      steps.push(JSON.parse(trimmed));
    } catch {
      // Partial trailing line while writer is flushing — safely skip
    }
  }

  let hasExplicitUserInput = false;
  let title = '';
  let turns = 0;
  let plannerSteps = 0;
  let totalInput = 0;
  let totalCacheRead = 0;
  let totalOutput = 0;
  let postWarmupInput = 0;
  let postWarmupCache = 0;
  let totalEstUsd = 0;
  let lastModel = 'unknown';
  let latestContextTokens = 0;
  let peakContextTokens = 0;
  let latestStepCacheHitPct = null;
  let isCacheCliff = false;
  let compactionCount = 0;
  let latestSpeedTokSec = null;
  let latestDurationSec = null;
  let speedSumOut = 0;
  let speedSumSec = 0;
  let lastStepAt = null;
  let lastPlannerStepIndex = -1;
  let lastTurnDelta = null;
  let lastToolActivity = { key: 'idle', label: '待机中', toolName: '' };

  const dailyBuckets = new Map(); // dateKey -> { input, cacheRead, output, estUsd, turns, plannerSteps }
  const modelBuckets = new Map(); // modelId -> { input, cacheRead, output, estUsd, calls }

  let prevUsageCtx = null;
  let sawCheckpointSincePrev = false;
  let currentTurnStartStep = -1;
  let currentTurnAccum = { input: 0, cacheRead: 0, output: 0, estUsd: 0, model: 'unknown', stepIndex: -1 };
  let lastUserOrToolTs = null;

  function addDaily(dateKey, field, delta) {
    if (!dateKey) return;
    if (!dailyBuckets.has(dateKey)) {
      dailyBuckets.set(dateKey, { date: dateKey, input: 0, cacheRead: 0, output: 0, estUsd: 0, turns: 0, plannerSteps: 0 });
    }
    dailyBuckets.get(dateKey)[field] += delta;
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const ts = step.created_at ? Date.parse(step.created_at) : NaN;
    const dateKey = !Number.isNaN(ts) ? getLocalDateKey(new Date(ts)) : getLocalDateKey(new Date(mtimeMs));
    if (step.created_at) lastStepAt = step.created_at;

    // Detect compaction checkpoint
    if (
      step.type === 'CHECKPOINT' ||
      (typeof step.content === 'string' && step.content.includes('Resuming from a compaction'))
    ) {
      compactionCount++;
      sawCheckpointSincePrev = true;
    }

    if (step.type === 'USER_INPUT') {
      turns++;
      addDaily(dateKey, 'turns', 1);
      if (step.source === 'USER_EXPLICIT') {
        hasExplicitUserInput = true;
      }
      if (!title && typeof step.content === 'string') {
        title = cleanPreviewTitle(step.content);
      }
      currentTurnStartStep = step.step_index ?? i;
      currentTurnAccum = { input: 0, cacheRead: 0, output: 0, estUsd: 0, model: lastModel, stepIndex: currentTurnStartStep };
      if (!Number.isNaN(ts)) lastUserOrToolTs = ts;
      continue;
    }

    if (step.type === 'GENERIC' || step.type === 'TOOL_RESPONSE' || step.type === 'SYSTEM_MESSAGE') {
      if (!Number.isNaN(ts)) lastUserOrToolTs = ts;
      continue;
    }

    if (step.type === 'PLANNER_RESPONSE') {
      plannerSteps++;
      addDaily(dateKey, 'plannerSteps', 1);
      if (step.model) lastModel = step.model;
      if (Array.isArray(step.tool_calls) && step.tool_calls.length > 0) {
        lastToolActivity = classifyToolActivity(step.tool_calls);
      } else {
        lastToolActivity = { key: 'replying', label: '💬 回复中', toolName: '' };
      }

      const u = extractUsage(step);
      if (u.hasUsage) {
        const ctx = u.input + u.cacheRead;
        const stepUsd = estimateApiRefUsd(lastModel, u.input, u.cacheRead, u.output);
        totalInput += u.input;
        totalCacheRead += u.cacheRead;
        totalOutput += u.output;
        totalEstUsd += stepUsd;

        addDaily(dateKey, 'input', u.input);
        addDaily(dateKey, 'cacheRead', u.cacheRead);
        addDaily(dateKey, 'output', u.output);
        addDaily(dateKey, 'estUsd', stepUsd);

        if (!modelBuckets.has(lastModel)) {
          modelBuckets.set(lastModel, { model: lastModel, input: 0, cacheRead: 0, output: 0, estUsd: 0, calls: 0 });
        }
        const mb = modelBuckets.get(lastModel);
        mb.input += u.input;
        mb.cacheRead += u.cacheRead;
        mb.output += u.output;
        mb.estUsd += stepUsd;
        mb.calls += 1;

        currentTurnAccum.input += u.input;
        currentTurnAccum.cacheRead += u.cacheRead;
        currentTurnAccum.output += u.output;
        currentTurnAccum.estUsd += stepUsd;
        currentTurnAccum.model = lastModel;
        currentTurnAccum.stepIndex = step.step_index ?? i;

        if (ctx > 0) {
          latestContextTokens = ctx;
          if (ctx > peakContextTokens) peakContextTokens = ctx;

          if (prevUsageCtx !== null) {
            postWarmupInput += u.input;
            postWarmupCache += u.cacheRead;
            latestStepCacheHitPct = Math.round((u.cacheRead / ctx) * 100);

            if (
              !sawCheckpointSincePrev &&
              prevUsageCtx >= CACHE_CLIFF_MIN_PREV_CTX &&
              u.cacheRead < prevUsageCtx * CACHE_CLIFF_RETENTION_RATIO &&
              prevUsageCtx - u.cacheRead >= CACHE_CLIFF_MIN_DROP &&
              u.input >= CACHE_CLIFF_MIN_INPUT_SPIKE
            ) {
              isCacheCliff = true;
            } else {
              isCacheCliff = false;
            }
          } else {
            latestStepCacheHitPct = ctx > 0 ? Math.round((u.cacheRead / ctx) * 100) : 0;
          }
          prevUsageCtx = ctx;
          sawCheckpointSincePrev = false;
        }

        // Compute generation throughput estimate from preceding step timestamp
        // (Transcript timestamps have 1-second granularity, so require dt >= 2s for stable single-step tok/s)
        let stepDurSec = null;
        if (!Number.isNaN(ts) && lastUserOrToolTs !== null) {
          const dt = (ts - lastUserOrToolTs) / 1000;
          if (dt >= 1.0 && dt <= 180) {
            stepDurSec = Number(dt.toFixed(1));
            latestDurationSec = stepDurSec;
            if (dt >= 2.0 && u.output >= 40) {
              const rawSpeed = u.output / dt;
              if (rawSpeed <= 320) {
                latestSpeedTokSec = Number(rawSpeed.toFixed(1));
                speedSumOut += u.output;
                speedSumSec += dt;
              }
            }
          }
        }
        if (!Number.isNaN(ts)) lastUserOrToolTs = ts;

        lastPlannerStepIndex = step.step_index ?? i;
        lastTurnDelta = {
          stepIndex: lastPlannerStepIndex,
          turnIndex: turns,
          input: u.input,
          cacheRead: u.cacheRead,
          output: u.output,
          turnInput: currentTurnAccum.input,
          turnOutput: currentTurnAccum.output,
          turnCacheRead: currentTurnAccum.cacheRead,
          turnEstUsd: currentTurnAccum.estUsd,
          stepCacheHitPct: latestStepCacheHitPct ?? 0,
          speedTokSec: latestSpeedTokSec,
          durationSec: stepDurSec,
          model: lastModel,
          hasReplyText: Boolean(step.content && String(step.content).trim().length > 0),
          toolCallsCount: Array.isArray(step.tool_calls) ? step.tool_calls.length : 0,
          createdAt: step.created_at || null
        };
      }
    }
  }

  // Determine whether the agent is actively working right now + fine-grained activity
  const lastStep = steps.length > 0 ? steps[steps.length - 1] : null;
  const ageMs = Date.now() - mtimeMs;
  let isWorking = false;
  let activity = { key: 'idle', label: '待机中', toolName: '' };
  if (lastStep && ageMs < 45000) {
    if (lastStep.type === 'USER_INPUT') {
      isWorking = true;
      activity = { key: 'thinking', label: '✨ 思考中', toolName: '' };
    } else if (lastStep.type === 'GENERIC' || lastStep.type === 'TOOL_RESPONSE') {
      isWorking = true;
      activity = lastToolActivity.key !== 'idle' ? lastToolActivity : { key: 'thinking', label: '✨ 思考中', toolName: '' };
    } else if (lastStep.type === 'PLANNER_RESPONSE') {
      const hasTools = Array.isArray(lastStep.tool_calls) && lastStep.tool_calls.length > 0;
      if (lastStep.status !== 'DONE' || (hasTools && ageMs < 25000)) {
        isWorking = true;
        activity = hasTools ? classifyToolActivity(lastStep.tool_calls) : { key: 'thinking', label: '✨ 输出中', toolName: '' };
      }
    }
  }

  const modelInfo = getModelInfo(lastModel);
  const contextPct = Math.min(100, Math.round((latestContextTokens / modelInfo.contextLimit) * 100));
  const sessionCacheDenom = postWarmupInput + postWarmupCache;
  const sessionCacheHitPct =
    sessionCacheDenom > 0
      ? Math.round((postWarmupCache / sessionCacheDenom) * 100)
      : latestStepCacheHitPct ?? 0;
  const avgSpeedTokSec = speedSumSec > 0 ? Number((speedSumOut / speedSumSec).toFixed(1)) : latestSpeedTokSec;

  return {
    id: convId,
    shortId: convId.slice(0, 8),
    filePath,
    mtimeMs,
    title: title || `会话 ${convId.slice(0, 8)}`,
    hasExplicitUserInput,
    turns,
    plannerSteps,
    model: lastModel,
    modelInfo,
    contextTokens: latestContextTokens,
    peakContextTokens,
    contextLimit: modelInfo.contextLimit,
    contextPct,
    stepCacheHitPct: latestStepCacheHitPct ?? 0,
    sessionCacheHitPct,
    isCacheCliff,
    compactionCount,
    latestSpeedTokSec,
    avgSpeedTokSec,
    latestDurationSec,
    totalInput,
    totalCacheRead,
    totalOutput,
    totalEstUsd,
    isWorking,
    activity,
    lastStepAt,
    lastPlannerStepIndex,
    lastTurnDelta,
    dailyBuckets,
    modelBuckets
  };
}

class TranscriptMonitor extends EventEmitter {
  constructor(quotaAdapter, settingsStore) {
    super();
    this.quotaAdapter = quotaAdapter;
    this.settingsStore = settingsStore;
    const home = process.env.USERPROFILE || os.homedir();
    this.brainRoots = [
      path.join(home, '.gemini', 'antigravity', 'brain'),
      path.join(home, '.gemini', 'antigravity-cli', 'brain')
    ];
    this.sessionCache = new Map(); // filePath -> { sig, parsed }
    this.pinnedSessionId = null;   // Optional user-selected session override
    this.lastEmittedTurnKey = null;
    this.lastSnapshot = null;
    this.timer = null;
    this.watchers = [];
    this.debouncedScanTimer = null;
  }

  start() {
    this.scan(true);
    this._setupWatchers();
    this.timer = setInterval(() => this.scan(false), 1500);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.debouncedScanTimer) clearTimeout(this.debouncedScanTimer);
    for (const w of this.watchers) {
      try { w.close(); } catch {}
    }
    this.watchers = [];
  }

  setPinnedSession(sessionId) {
    this.pinnedSessionId = sessionId || null;
    this.scan(false);
  }

  _setupWatchers() {
    for (const root of this.brainRoots) {
      if (!fs.existsSync(root)) continue;
      try {
        const w = fs.watch(root, { persistent: false }, () => this._scheduleScan());
        w.on('error', () => {});
        this.watchers.push(w);
      } catch {
        // Poll timer handles everything cleanly as fallback
      }
    }
  }

  _scheduleScan() {
    if (this.debouncedScanTimer) return;
    this.debouncedScanTimer = setTimeout(() => {
      this.debouncedScanTimer = null;
      this.scan(false);
    }, 250);
  }

  _discoverTranscriptFiles() {
    const found = [];
    for (const root of this.brainRoots) {
      if (!fs.existsSync(root)) continue;
      let entries;
      try {
        entries = fs.readdirSync(root, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const ent of entries) {
        if (!ent.isDirectory()) continue;
        const fp = path.join(root, ent.name, '.system_generated', 'logs', 'transcript.jsonl');
        try {
          const st = fs.statSync(fp);
          if (st.isFile() && st.size > 0) {
            found.push({ id: ent.name, filePath: fp, mtimeMs: st.mtimeMs, size: st.size });
          }
        } catch {
          // Directory without transcript.jsonl (e.g. tempmediaStorage)
        }
      }
    }
    found.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return found;
  }

  scan(isInitial) {
    const files = this._discoverTranscriptFiles();
    const seenPaths = new Set();
    const parsedSessions = [];
    let anyChanged = false;

    for (const f of files) {
      seenPaths.add(f.filePath);
      const sig = `${f.mtimeMs}:${f.size}`;
      const cached = this.sessionCache.get(f.filePath);
      if (cached && cached.sig === sig) {
        if (cached.parsed) parsedSessions.push(cached.parsed);
      } else {
        const parsed = parseTranscriptFile(f.filePath, f.id, f.mtimeMs);
        this.sessionCache.set(f.filePath, { sig, parsed });
        if (parsed) parsedSessions.push(parsed);
        anyChanged = true;
      }
    }

    // Evict removed files
    for (const key of this.sessionCache.keys()) {
      if (!seenPaths.has(key)) {
        this.sessionCache.delete(key);
        anyChanged = true;
      }
    }

    // Recompute working timeout & sleep transition even if file mtime didn't change
    if (!anyChanged && this.lastSnapshot) {
      const prevActive = this.lastSnapshot.activeSession;
      if (prevActive) {
        const ageMs = Date.now() - prevActive.mtimeMs;
        const sleepMs = Math.max(60, Number(this.settingsStore.getAll().sleepAfterSec || 300)) * 1000;
        const shouldBeWorking = prevActive.isWorking && ageMs < 45000;
        const shouldBeSleeping = !shouldBeWorking && ageMs >= sleepMs;
        if (shouldBeWorking !== prevActive.isWorking || shouldBeSleeping !== Boolean(prevActive.isSleeping)) {
          anyChanged = true;
        }
      }
    }

    if (!anyChanged && !isInitial && this.lastSnapshot) {
      return this.lastSnapshot;
    }

    // Pick active session: pinned -> most recent explicit user session -> most recent any session
    let active = null;
    if (this.pinnedSessionId) {
      active = parsedSessions.find((s) => s.id === this.pinnedSessionId) || null;
    }
    if (!active) {
      active = parsedSessions.find((s) => s.hasExplicitUserInput) || parsedSessions[0] || null;
    }

    // Re-evaluate live isWorking & sleep state based on current wall clock
    const sleepThresholdMs = Math.max(60, Number(this.settingsStore.getAll().sleepAfterSec || 300)) * 1000;
    let activeClone = null;
    if (active) {
      const ageMs = Date.now() - active.mtimeMs;
      const workingNow = active.isWorking && ageMs < 45000;
      const isSleeping = !workingNow && ageMs >= sleepThresholdMs;
      activeClone = {
        ...active,
        isWorking: workingNow,
        isSleeping,
        activity: workingNow
          ? active.activity
          : isSleeping
            ? { key: 'sleeping', label: '💤 打盹中', toolName: '' }
            : { key: 'idle', label: '待机中', toolName: '' }
      };
      delete activeClone.dailyBuckets;
      delete activeClone.modelBuckets;
    }

    // Aggregate ledger across ALL sessions (including subagents so total tokens are honest)
    const todayKey = getLocalDateKey(new Date());
    const last7Keys = [];
    for (let d = 6; d >= 0; d--) {
      const dt = new Date();
      dt.setDate(dt.getDate() - d);
      last7Keys.push(getLocalDateKey(dt));
    }
    const last7Set = new Set(last7Keys);

    const dailyMap = new Map();
    for (const k of last7Keys) {
      dailyMap.set(k, { date: k, label: k.slice(5), input: 0, cacheRead: 0, output: 0, estUsd: 0, turns: 0, plannerSteps: 0 });
    }

    const today = { date: todayKey, input: 0, cacheRead: 0, output: 0, estUsd: 0, turns: 0, plannerSteps: 0 };
    const last7Days = { input: 0, cacheRead: 0, output: 0, estUsd: 0, turns: 0, plannerSteps: 0 };
    const allTime = { input: 0, cacheRead: 0, output: 0, estUsd: 0, turns: 0, plannerSteps: 0, sessions: parsedSessions.length };
    const modelTotals = new Map();

    for (const s of parsedSessions) {
      allTime.input += s.totalInput;
      allTime.cacheRead += s.totalCacheRead;
      allTime.output += s.totalOutput;
      allTime.estUsd += s.totalEstUsd;
      allTime.turns += s.turns;
      allTime.plannerSteps += s.plannerSteps;

      for (const [dk, b] of s.dailyBuckets.entries()) {
        if (dk === todayKey) {
          today.input += b.input;
          today.cacheRead += b.cacheRead;
          today.output += b.output;
          today.estUsd += b.estUsd;
          today.turns += b.turns;
          today.plannerSteps += b.plannerSteps;
        }
        if (last7Set.has(dk)) {
          last7Days.input += b.input;
          last7Days.cacheRead += b.cacheRead;
          last7Days.output += b.output;
          last7Days.estUsd += b.estUsd;
          last7Days.turns += b.turns;
          last7Days.plannerSteps += b.plannerSteps;
          const dm = dailyMap.get(dk);
          if (dm) {
            dm.input += b.input;
            dm.cacheRead += b.cacheRead;
            dm.output += b.output;
            dm.estUsd += b.estUsd;
            dm.turns += b.turns;
            dm.plannerSteps += b.plannerSteps;
          }
        }
      }

      for (const [mid, mb] of s.modelBuckets.entries()) {
        const info = getModelInfo(mid);
        const key = info.displayName;
        if (!modelTotals.has(key)) {
          modelTotals.set(key, {
            model: mid,
            displayName: info.displayName,
            shortName: info.shortName,
            color: info.color,
            input: 0,
            cacheRead: 0,
            output: 0,
            estUsd: 0,
            calls: 0
          });
        }
        const agg = modelTotals.get(key);
        agg.input += mb.input;
        agg.cacheRead += mb.cacheRead;
        agg.output += mb.output;
        agg.estUsd += mb.estUsd;
        agg.calls += mb.calls;
      }
    }

    const byModel = Array.from(modelTotals.values()).sort(
      (a, b) => (b.input + b.output + b.cacheRead * 0.1) - (a.input + a.output + a.cacheRead * 0.1)
    );

    const recentSessions = parsedSessions
      .filter((s) => s.hasExplicitUserInput || s.plannerSteps >= 2)
      .slice(0, 12)
      .map((s) => ({
        id: s.id,
        shortId: s.shortId,
        title: s.title,
        modelShort: s.modelInfo.shortName,
        contextTokens: s.contextTokens,
        contextPct: s.contextPct,
        sessionCacheHitPct: s.sessionCacheHitPct,
        totalInput: s.totalInput,
        totalOutput: s.totalOutput,
        totalCacheRead: s.totalCacheRead,
        totalEstUsd: s.totalEstUsd,
        turns: s.turns,
        mtimeMs: s.mtimeMs,
        isSubagent: !s.hasExplicitUserInput
      }));

    const settings = this.settingsStore.getAll();
    const quota = this.quotaAdapter.getQuotaSnapshot(today.input + today.output, settings.dailyBudgetTokens);

    const snapshot = {
      updatedAt: Date.now(),
      pinnedSessionId: this.pinnedSessionId,
      activeSession: activeClone,
      quota,
      ledger: {
        today,
        last7Days,
        dailySeries: last7Keys.map((k) => dailyMap.get(k)),
        allTime,
        byModel,
        recentSessions
      }
    };

    // Detect brand new completed step on active session to fire a bubble popup
    if (activeClone && activeClone.lastTurnDelta) {
      const turnKey = `${activeClone.id}:${activeClone.lastTurnDelta.stepIndex}`;
      if (isInitial) {
        this.lastEmittedTurnKey = turnKey;
      } else if (turnKey !== this.lastEmittedTurnKey) {
        this.lastEmittedTurnKey = turnKey;
        this.emit('turn', {
          sessionId: activeClone.id,
          delta: activeClone.lastTurnDelta,
          contextPct: activeClone.contextPct,
          isCacheCliff: activeClone.isCacheCliff,
          modelInfo: activeClone.modelInfo
        });
      }
    }

    this.lastSnapshot = snapshot;
    this.emit('update', snapshot);
    return snapshot;
  }
}

module.exports = {
  TranscriptMonitor,
  parseTranscriptFile
};
