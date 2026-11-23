'use strict';

(() => {
  const api = window.geminiWidget;
  const { SOUND_PACKS, SOUND_EVENTS, SoundEngine } = window.SoundLibrary;
  const soundEngine = new SoundEngine();

  let settings = {};
  let stats = null;
  let skins = [];
  let petState = null;
  let activeSkin = null;
  let panelOpen = false;
  let activeTab = 'live';
  let currentPose = 'idle';
  let transientPose = null;
  let bubbleTimer = null;
  let pokeCount = 0;
  let isPointerDown = false;
  let isDragging = false;
  let downPos = { x: 0, y: 0 };
  let clickDebounceTimer = null;
  let ignoreMouseState = true;
  let noteSaveTimer = null;

  const el = {
    root: document.getElementById('root'),
    panel: document.getElementById('dashboard-panel'),
    panelTitle: document.getElementById('panel-title'),
    mascotHit: document.getElementById('mascot-hit'),
    mascotJelly: document.getElementById('mascot-jelly'),
    mascotImg: document.getElementById('mascot-img'),
    mascotCanvas: document.getElementById('mascot-canvas'),
    floatParticles: document.getElementById('float-particles'),
    sleepZzz: document.getElementById('sleep-zzz'),
    workingSparkles: document.getElementById('working-sparkles'),
    floatingNote: document.getElementById('floating-note'),
    floatingNoteBody: document.getElementById('floating-note-body'),
    speechBubble: document.getElementById('speech-bubble'),
    bubbleText: document.getElementById('bubble-text'),
    bubbleMood: document.getElementById('bubble-mood'),
    bubbleClose: document.getElementById('bubble-close'),
    statusPill: document.getElementById('status-pill'),
    pillDot: document.getElementById('pill-dot'),
    pillCtx: document.getElementById('pill-ctx'),
    pillSecond: document.getElementById('pill-second'),
    pillPomo: document.getElementById('pill-pomo'),
    pillArrow: document.getElementById('pill-toggle-arrow'),
    modelBadge: document.getElementById('model-badge'),
    followChip: document.getElementById('follow-chip'),
    btnOpenNebula: document.getElementById('btn-open-nebula'),
    btnOpenSettings: document.getElementById('btn-open-settings'),
    btnRefresh: document.getElementById('btn-refresh'),
    btnClosePanel: document.getElementById('btn-close-panel'),
    sessionSelect: document.getElementById('session-select'),
    activityPill: document.getElementById('activity-pill'),
    ctxValue: document.getElementById('ctx-value'),
    ctxBar: document.getElementById('ctx-bar'),
    ctxWarnMark: document.getElementById('ctx-warn-mark'),
    ctxHint: document.getElementById('ctx-hint'),
    compactionTag: document.getElementById('compaction-tag'),
    mCache: document.getElementById('m-cache'),
    mCacheSub: document.getElementById('m-cache-sub'),
    mSpeed: document.getElementById('m-speed'),
    mSpeedSub: document.getElementById('m-speed-sub'),
    mInOut: document.getElementById('m-in-out'),
    mInOutSub: document.getElementById('m-in-out-sub'),
    mCacheTok: document.getElementById('m-cache-tok'),
    mRefUsd: document.getElementById('m-ref-usd'),
    quotaLabel: document.getElementById('quota-label'),
    quotaVal: document.getElementById('quota-val'),
    quotaBar: document.getElementById('quota-bar'),
    quotaSub: document.getElementById('quota-sub'),
    todayUsd: document.getElementById('today-usd'),
    lTodayTok: document.getElementById('l-today-tok'),
    lTodayMeta: document.getElementById('l-today-meta'),
    l7dTok: document.getElementById('l-7d-tok'),
    l7dMeta: document.getElementById('l-7d-meta'),
    lAllTok: document.getElementById('l-all-tok'),
    lAllMeta: document.getElementById('l-all-meta'),
    dailyChart: document.getElementById('daily-chart'),
    modelList: document.getElementById('model-list'),
    recentList: document.getElementById('recent-list'),
    // Companion & Snake
    bondLevelBadge: document.getElementById('bond-level-badge'),
    bondTitle: document.getElementById('bond-title'),
    bondSub: document.getElementById('bond-sub'),
    bondBar: document.getElementById('bond-bar'),
    treatsCount: document.getElementById('treats-count'),
    btnPatPet: document.getElementById('btn-pat-pet'),
    btnFeedPet: document.getElementById('btn-feed-pet'),
    petNicknameInput: document.getElementById('pet-nickname-input'),
    btnSaveNickname: document.getElementById('btn-save-nickname'),
    snakeCanvas: document.getElementById('snake-canvas'),
    snakeScore: document.getElementById('snake-score'),
    snakeBest: document.getElementById('snake-best'),
    btnSnakeStart: document.getElementById('btn-snake-start'),
    btnSnakeRestart: document.getElementById('btn-snake-restart'),
    // Toolbox
    pomoPhaseChip: document.getElementById('pomo-phase-chip'),
    pomoClock: document.getElementById('pomo-clock'),
    btnPomoToggle: document.getElementById('btn-pomo-toggle'),
    btnPomoReset: document.getElementById('btn-pomo-reset'),
    btnPomoSwitch: document.getElementById('btn-pomo-switch'),
    pomoWorkMin: document.getElementById('pomo-work-min'),
    pomoBreakMin: document.getElementById('pomo-break-min'),
    pomoDoneCount: document.getElementById('pomo-done-count'),
    hydroEnabled: document.getElementById('hydro-enabled'),
    hydroStatus: document.getElementById('hydro-status'),
    hydroInterval: document.getElementById('hydro-interval'),
    btnHydroAck: document.getElementById('btn-hydro-ack'),
    noteVisible: document.getElementById('note-visible'),
    noteTextarea: document.getElementById('note-textarea'),
    // Skins
    skinGrid: document.getElementById('skin-grid'),
    skinActiveName: document.getElementById('skin-active-name'),
    customStateTools: document.getElementById('custom-state-tools'),
    btnImportSkin: document.getElementById('btn-import-skin'),
    btnImportPetdex: document.getElementById('btn-import-petdex'),
    btnSyncSkinSound: document.getElementById('btn-sync-skin-sound'),
    btnOpenSkins: document.getElementById('btn-open-skins'),
    setFps: document.getElementById('set-fps'),
    setFpsVal: document.getElementById('set-fps-val'),
    // Sound Studio
    sndEnabled: document.getElementById('snd-enabled'),
    btnOpenSounds: document.getElementById('btn-open-sounds'),
    btnResetSound: document.getElementById('btn-reset-sound'),
    btnPreviewChord: document.getElementById('btn-preview-chord'),
    soundPackGrid: document.getElementById('sound-pack-grid'),
    sndVol: document.getElementById('snd-vol'),
    sndVolVal: document.getElementById('snd-vol-val'),
    sndPitch: document.getElementById('snd-pitch'),
    sndPitchVal: document.getElementById('snd-pitch-val'),
    sndSpeed: document.getElementById('snd-speed'),
    sndSpeedVal: document.getElementById('snd-speed-val'),
    sndDecay: document.getElementById('snd-decay'),
    sndDecayVal: document.getElementById('snd-decay-val'),
    sndBright: document.getElementById('snd-bright'),
    sndBrightVal: document.getElementById('snd-bright-val'),
    soundEventList: document.getElementById('sound-event-list'),
    // Settings
    setFollowMode: document.getElementById('set-follow-mode'),
    setScale: document.getElementById('set-scale'),
    setScaleVal: document.getElementById('set-scale-val'),
    setAutoStart: document.getElementById('set-autostart'),
    setSilentLurk: document.getElementById('set-silent-lurk'),
    setQuiet: document.getElementById('set-quiet'),
    setSleepSec: document.getElementById('set-sleep-sec'),
    setFlip: document.getElementById('set-flip'),
    setSnapTop: document.getElementById('set-snap-top'),
    setPill: document.getElementById('set-pill'),
    setBubble: document.getElementById('set-bubble'),
    setBubbleSec: document.getElementById('set-bubble-sec'),
    setBubbleTpl: document.getElementById('set-bubble-tpl'),
    setWarn: document.getElementById('set-warn'),
    setWarnVal: document.getElementById('set-warn-val'),
    setBudget: document.getElementById('set-budget'),
    btnTestBubble: document.getElementById('btn-test-bubble'),
    btnOpenLogs: document.getElementById('btn-open-logs'),
    btnResetPos: document.getElementById('btn-reset-pos'),
    btnResetAll: document.getElementById('btn-reset-all')
  };

  const spritePlayer = new window.SpriteSheetPlayer(el.mascotCanvas);

  const snakeGame = new window.StarSnakeGame(el.snakeCanvas, {
    onScoreChange: (sc) => { el.snakeScore.textContent = String(sc); },
    onEat: () => playSfx('snap'),
    onStateChange: (st) => {
      el.btnSnakeStart.textContent = st === 'running' ? '暂停' : st === 'paused' ? '继续' : '开始';
    },
    onGameOver: async (finalScore) => {
      playSfx('alert');
      const res = await api.recordSnakeScore(finalScore);
      if (res && res.state) renderPetState(res.state);
      if (res && res.isNewBest && finalScore > 0) {
        playSfx('happy');
        spawnFloatParticle(`🏆 新纪录 ${finalScore}！`);
      }
      if (res && res.bonusTreats > 0) {
        spawnFloatParticle('+1 🐟');
        showBubble(`贪吃蛇达成 ${finalScore} 分！奖励 +1 星光小鱼干 🐟`, '歇够啦，继续征服下一个任务吧 ✦', false, true);
      }
    }
  });

  const toolbox = new window.ToolboxController({
    getSettings: () => settings,
    patchToolbox: (tbPatch) => api.updateSettings({ toolbox: tbPatch }),
    isBusy: () => Boolean(stats?.activeSession?.isWorking),
    onPomodoroComplete: async () => {
      const res = await api.rewardPet({ treats: 3, affinity: 6, pomodoroCompleted: true });
      if (res && res.state) renderPetState(res.state);
      spawnFloatParticle('+3 🐟  +6 ♥');
    },
    onNotify: ({ kind, title, mood }) => {
      setTransientPose(kind === 'happy' ? 'happy' : 'idle', 5500);
      triggerJellyBounce();
      playSfx(kind === 'happy' ? 'happy' : 'turn');
      showBubble(title, mood, false, true);
    },
    onRender: (display) => renderToolboxDisplay(display)
  });

  function fmtTok(n) {
    const v = Number(n) || 0;
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e4) return (v / 1e3).toFixed(1) + 'K';
    if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
    return String(Math.round(v));
  }

  function fmtUsd(v) {
    const n = Number(v) || 0;
    if (n === 0) return '$0.00';
    if (n < 0.01) return '$' + n.toFixed(4);
    return '$' + n.toFixed(2);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setRollingText(node, nextText) {
    if (!node || node.textContent === nextText) return;
    node.textContent = nextText;
    node.classList.remove('pop');
    void node.offsetWidth;
    node.classList.add('pop');
  }

  function playSfx(eventKey, opts = {}) {
    soundEngine.play(eventKey, settings.sound, opts);
  }

  function spawnFloatParticle(text) {
    const node = document.createElement('div');
    node.className = 'float-particle';
    node.textContent = text;
    el.floatParticles.appendChild(node);
    setTimeout(() => node.remove(), 1200);
  }

  function getDisplayPetName() {
    if (!activeSkin) return 'Gemini 监测仪';
    const nick = petState && petState.nicknames && petState.nicknames[activeSkin.id];
    return nick || activeSkin.name;
  }

  // ==================== Click-Through ====================
  function updateMousePassThrough(clientX, clientY) {
    if (isDragging) {
      if (ignoreMouseState) { ignoreMouseState = false; api.setIgnoreMouse(false); }
      return;
    }
    const target = document.elementFromPoint(clientX, clientY);
    const overInteractive = Boolean(target && target.closest('[data-interactive="true"]'));
    const shouldIgnore = !overInteractive;
    if (shouldIgnore !== ignoreMouseState) {
      ignoreMouseState = shouldIgnore;
      api.setIgnoreMouse(shouldIgnore);
    }
  }

  window.addEventListener('mousemove', (e) => updateMousePassThrough(e.clientX, e.clientY));
  window.addEventListener('mouseleave', () => {
    if (!isDragging && !ignoreMouseState) { ignoreMouseState = true; api.setIgnoreMouse(true); }
  });

  // ==================== Skin & Visual Engine ====================
  function resolveActiveSkin() {
    if (!skins.length) return null;
    const found = skins.find((s) => s.id === settings.activeSkinId) || skins[0];
    activeSkin = found;
    if (found) {
      const [c1, c2] = found.accentColors || ['#60a5fa', '#a78bfa'];
      document.documentElement.style.setProperty('--accent-1', c1);
      document.documentElement.style.setProperty('--accent-2', c2);
      snakeGame.setAccentColors([c1, c2]);
      el.mascotImg.classList.toggle('pixelated', Boolean(found.pixelated));
      el.mascotCanvas.classList.toggle('pixelated', Boolean(found.pixelated));
      el.skinActiveName.textContent = getDisplayPetName();
      el.panelTitle.textContent = getDisplayPetName();
      el.customStateTools.classList.toggle('hidden', Boolean(found.builtin) || found.mode === 'spritesheet');
      if (petState && document.activeElement !== el.petNicknameInput) {
        el.petNicknameInput.value = (petState.nicknames && petState.nicknames[found.id]) || '';
        el.petNicknameInput.placeholder = found.name;
      }
    }
    return found;
  }

  function triggerJellyBounce() {
    el.mascotJelly.classList.remove('squish-down', 'squish-bounce');
    void el.mascotJelly.offsetWidth;
    el.mascotJelly.classList.add('squish-bounce');
  }

  function setTransientPose(name, durationMs) {
    transientPose = { name, until: Date.now() + durationMs };
    updateMascotVisual(true);
    setTimeout(() => {
      if (transientPose && Date.now() >= transientPose.until) {
        transientPose = null;
        updateMascotVisual(true);
      }
    }, durationMs + 40);
  }

  function computeDesiredPose() {
    if (transientPose && Date.now() < transientPose.until) return transientPose.name;
    const s = stats && stats.activeSession;
    if (!s) return 'idle';
    const warnPct = Number(settings.contextWarnPct) || 70;
    if (s.isCacheCliff || s.contextPct >= warnPct) return 'sweat';
    if (s.isWorking) return 'working';
    if (s.isSleeping) return 'sleeping';
    return 'idle';
  }

  function updateMascotVisual(forceSrc = false) {
    const sk = resolveActiveSkin();
    const pose = computeDesiredPose();

    if (sk && sk.mode === 'spritesheet' && sk.spritesheet) {
      el.mascotImg.classList.add('hidden');
      el.mascotCanvas.classList.remove('hidden');
      spritePlayer.configure(sk.spritesheet, settings.spriteFps || sk.spritesheet.fps || 8, sk.pixelated);
      spritePlayer.setPose(pose);
    } else {
      spritePlayer.stop();
      el.mascotCanvas.classList.add('hidden');
      el.mascotImg.classList.remove('hidden');
      const imgPose = pose === 'sleeping' ? 'idle' : pose;
      const nextUrl = sk && sk.states ? (sk.states[imgPose] || sk.states.idle) : '';
      if (nextUrl && (forceSrc || pose !== currentPose || el.mascotImg.src !== nextUrl)) {
        el.mascotImg.src = nextUrl;
      }
    }

    currentPose = pose;
    el.mascotHit.classList.remove('state-idle', 'state-working', 'state-happy', 'state-sweat', 'state-poked', 'state-sleeping');
    el.mascotHit.classList.add(`state-${pose}`);
    el.workingSparkles.classList.toggle('hidden', pose !== 'working' && pose !== 'happy');
    el.sleepZzz.classList.toggle('hidden', pose !== 'sleeping');
  }

  function renderSkinGallery() {
    resolveActiveSkin();
    el.skinGrid.innerHTML = skins
      .map((sk) => {
        const isActive = activeSkin && sk.id === activeSkin.id;
        const delBtn = !sk.builtin
          ? `<button class="skin-del-btn" data-del-skin="${sk.id}" title="删除该自定义形象">×</button>`
          : '';
        return `<div class="skin-card${isActive ? ' active' : ''}" data-skin-id="${sk.id}">
          <span class="skin-tag">${escapeHtml(sk.tag)}</span>
          ${delBtn}
          <div class="skin-thumb-wrap">
            <img class="skin-thumb${sk.pixelated ? ' pixelated' : ''}" src="${sk.previewUrl}" alt="${escapeHtml(sk.name)}" draggable="false" />
          </div>
          <div class="skin-name">${escapeHtml(sk.name)}</div>
          <div class="skin-sub">${escapeHtml(sk.subtitle)}</div>
        </div>`;
      })
      .join('');
  }

  function renderPetState(ps) {
    if (!ps) return;
    petState = ps;
    const t = ps.tier || { level: 1, title: '初次邂逅', nextMin: 25, nextTitle: '桌角小伙伴', progressPct: 0 };
    el.bondLevelBadge.textContent = `Lv.${t.level}`;
    el.bondTitle.textContent = t.title;
    el.bondSub.textContent = t.level >= 7
      ? `好感度 ${ps.affinity} ♥ · 已达成最高羁绊 ✨`
      : `好感度 ${ps.affinity} / ${t.nextMin} ♥ · 下阶：${t.nextTitle}`;
    el.bondBar.style.width = `${Math.max(4, t.progressPct)}%`;
    setRollingText(el.treatsCount, String(ps.treats ?? 0));
    el.snakeBest.textContent = String(ps.snakeBestScore || 0);
    el.pomoDoneCount.textContent = `累计 ${ps.totalPomodoros || 0} 轮`;
    resolveActiveSkin();
  }

  function renderToolboxDisplay(display) {
    if (!display) return;
    const { pomo, hydro, note } = display;
    el.pomoClock.textContent = pomo.formatted;
    el.pomoPhaseChip.textContent = pomo.phase === 'work' ? '专注阶段' : '休息阶段';
    el.btnPomoToggle.textContent = pomo.running ? '暂停' : pomo.phase === 'work' ? '开始专注' : '开始休息';
    el.btnPomoSwitch.textContent = pomo.phase === 'work' ? '切休息' : '切专注';

    if (document.activeElement !== el.pomoWorkMin) el.pomoWorkMin.value = String(pomo.workMin);
    if (document.activeElement !== el.pomoBreakMin) el.pomoBreakMin.value = String(pomo.breakMin);

    if (pomo.running) {
      el.pillPomo.textContent = `${pomo.phase === 'work' ? '🍅' : '☕'}${pomo.formatted}`;
      el.pillPomo.classList.remove('hidden');
    } else {
      el.pillPomo.classList.add('hidden');
    }

    el.hydroEnabled.checked = Boolean(hydro.enabled);
    el.hydroInterval.value = String(hydro.intervalMin || 45);
    el.hydroStatus.textContent = hydro.enabled
      ? hydro.remainMin !== null
        ? `距离下次喝水提醒约 ${hydro.remainMin} 分钟`
        : '已开启久坐与喝水守护'
      : '未开启（工作态自动延后不打断）';

    el.noteVisible.checked = Boolean(note.visible);
    if (document.activeElement !== el.noteTextarea) {
      el.noteTextarea.value = note.text || '';
    }
    el.floatingNoteBody.textContent = note.text || '';
    syncFloatingNoteVisibility();
  }

  function syncFloatingNoteVisibility() {
    const note = settings.toolbox && settings.toolbox.stickyNote;
    const bubbleVisible = !el.speechBubble.classList.contains('hidden');
    const shouldShow = Boolean(note && note.visible && note.text && note.text.trim() && !bubbleVisible);
    el.floatingNote.classList.toggle('hidden', !shouldShow);
  }

  // ==================== Sound Studio UI ====================
  function renderSoundStudio() {
    const snd = settings.sound || {};
    el.sndEnabled.checked = snd.enabled !== false;

    const vol = Math.max(0.1, Math.min(1.0, Number(snd.volume ?? 0.72)));
    const pitch = Number(snd.pitchSemitones ?? 0);
    const speed = Number(snd.speed ?? 1.0);
    const decay = Number(snd.decay ?? 1.0);
    const bright = Number(snd.brightness ?? 0.78);

    el.sndVol.value = String(vol);
    el.sndVolVal.textContent = `${Math.round(vol * 100)}%`;
    el.sndPitch.value = String(pitch);
    el.sndPitchVal.textContent = `${pitch > 0 ? '+' : ''}${pitch} st`;
    el.sndSpeed.value = String(speed);
    el.sndSpeedVal.textContent = `${speed.toFixed(2).replace(/0$/, '')}x`;
    el.sndDecay.value = String(decay);
    el.sndDecayVal.textContent = `${decay.toFixed(1)}x`;
    el.sndBright.value = String(bright);
    el.sndBrightVal.textContent = `${Math.round(bright * 100)}%`;

    el.soundPackGrid.innerHTML = SOUND_PACKS.map((p) => {
      const active = (snd.pack || 'meow-bell') === p.id;
      return `<button class="pack-card${active ? ' active' : ''}" data-pack="${p.id}">
        <div class="pack-name">${escapeHtml(p.name)}</div>
        <div class="pack-desc">${escapeHtml(p.desc)}</div>
      </button>`;
    }).join('');

    const evMap = snd.events || {};
    el.soundEventList.innerHTML = SOUND_EVENTS.map((ev) => {
      const cfg = evMap[ev.key] || { enabled: true, packOverride: '', customUrl: '', customName: '' };
      const hasCustom = Boolean(cfg.customUrl);
      const packOptions = [
        `<option value="">跟随预设包</option>`,
        ...SOUND_PACKS.map(
          (p) => `<option value="${p.id}"${cfg.packOverride === p.id ? ' selected' : ''}>${escapeHtml(p.name)}</option>`
        )
      ].join('');

      return `<div class="ev-row" data-ev="${ev.key}">
        <div class="ev-left">
          <label class="switch"><input type="checkbox" class="ev-toggle" ${cfg.enabled !== false ? 'checked' : ''} /><span></span></label>
          <span>${escapeHtml(ev.label)}</span>
        </div>
        <div class="ev-controls">
          ${
            hasCustom
              ? `<span class="ev-custom-tag" title="${escapeHtml(cfg.customName)}">🎵 ${escapeHtml(cfg.customName)}</span>`
              : `<select class="ev-select">${packOptions}</select>`
          }
          <button class="tiny-btn ev-play" title="试听">▶</button>
          ${
            hasCustom
              ? `<button class="tiny-btn danger ev-clear" title="恢复合成音效">✕</button>`
              : `<button class="tiny-btn ev-import" title="导入本地 MP3/WAV">导入</button>`
          }
        </div>
      </div>`;
    }).join('');
  }

  // ==================== Speech Bubble ====================
  function showBubble(text, mood = '', isAlert = false, force = false) {
    if (!force && !settings.bubbleEnabled) return;
    el.bubbleText.textContent = text;
    el.bubbleMood.textContent = mood;
    el.bubbleMood.classList.toggle('hidden', !mood);
    el.speechBubble.classList.toggle('alert', Boolean(isAlert));
    el.speechBubble.classList.remove('hidden');
    syncFloatingNoteVisibility();

    if (bubbleTimer) clearTimeout(bubbleTimer);
    const sec = Number(settings.bubbleDurationSec ?? 7);
    if (sec > 0) {
      bubbleTimer = setTimeout(() => {
        el.speechBubble.classList.add('hidden');
        syncFloatingNoteVisibility();
      }, sec * 1000);
    }
  }

  function hideBubble() {
    if (bubbleTimer) clearTimeout(bubbleTimer);
    el.speechBubble.classList.add('hidden');
    syncFloatingNoteVisibility();
  }

  function formatTurnBubble(evt) {
    const d = evt.delta;
    const tpl = settings.bubbleTemplate || '本轮 +{turnTokens} · 缓存 {cachePct}% · {speed}';
    const turnBillable = (d.input || 0) + (d.output || 0);
    const speedStr = d.speedTokSec ? `${d.speedTokSec} tok/s` : d.durationSec ? `${d.durationSec}s` : '--';
    const text = tpl
      .replace(/\{turnTokens\}/g, fmtTok(turnBillable))
      .replace(/\{turnIn\}/g, fmtTok(d.input))
      .replace(/\{turnOut\}/g, fmtTok(d.output))
      .replace(/\{turnCache\}/g, fmtTok(d.cacheRead))
      .replace(/\{cachePct\}/g, String(d.stepCacheHitPct ?? 0))
      .replace(/\{ctxPct\}/g, String(evt.contextPct ?? 0))
      .replace(/\{speed\}/g, speedStr)
      .replace(/\{cost\}/g, fmtUsd(d.turnEstUsd))
      .replace(/\{model\}/g, evt.modelInfo?.shortName || 'Gemini');

    const warnPct = Number(settings.contextWarnPct) || 70;
    const ml = (activeSkin && activeSkin.moodLines) || {};
    let mood = '';
    let isAlert = false;
    let isHappy = false;

    if (evt.isCacheCliff) {
      mood = ml.cacheCliff || '缓存断层啦！检查是不是改了顶部规则喵 💦';
      isAlert = true;
    } else if ((evt.contextPct || 0) >= warnPct) {
      mood = (ml.highCtx || '上下文 {ctxPct}% 啦！建议开新会话喵 💦').replace(/\{ctxPct\}/g, String(evt.contextPct));
      isAlert = true;
    } else if ((d.stepCacheHitPct || 0) >= 88) {
      mood = ml.cacheHigh || '哼，缓存命中这么稳，还不快夸夸我 ✨';
      isHappy = true;
    } else if ((d.speedTokSec || 0) >= 55) {
      mood = ml.fast || '反重力加速全开！嗖一下写完啦 ✨';
      isHappy = true;
    }
    if (evt.leveledUp) {
      mood = `🎉 羁绊升级为「${petState?.tier?.title || '新称号'}」！`;
      isHappy = true;
    }
    return { text, mood, isAlert, isHappy };
  }

  // ==================== Settings & Stats Render ====================
  function applySettings(next) {
    if (!next) return;
    if (typeof next._panelOpen === 'boolean') {
      panelOpen = next._panelOpen;
      renderPanelVisibility();
    }
    const skinChanged = settings.activeSkinId !== next.activeSkinId;
    settings = next;

    const scale = Math.max(0.7, Math.min(1.35, Number(settings.scale) || 1.0));
    document.documentElement.style.setProperty('--scale', String(scale));

    const isLeft = settings.dockEdge === 'left';
    el.root.classList.toggle('dock-left', isLeft);
    el.root.classList.toggle('dock-right', !isLeft);
    el.root.classList.toggle('flipped', Boolean(isLeft && settings.flipOnLeft));

    el.statusPill.classList.toggle('hidden', !settings.showCompactPill);
    el.followChip.textContent = settings.followMode === 'antigravity' ? '跟随 AGY' : '全局置顶';
    el.followChip.classList.toggle('global', settings.followMode === 'global');

    const fps = Math.max(1, Math.min(24, Number(settings.spriteFps) || 8));
    el.setFps.value = String(fps);
    el.setFpsVal.textContent = `${fps} FPS`;
    spritePlayer.setFps(fps);

    el.setFollowMode.value = settings.followMode || 'antigravity';
    el.setScale.value = String(scale);
    el.setScaleVal.textContent = `${Math.round(scale * 100)}%`;
    el.setSilentLurk.checked = Boolean(settings.silentLurk);
    el.setQuiet.checked = settings.quietWhileWorking !== false;
    el.setSleepSec.value = String(settings.sleepAfterSec || 300);
    el.setFlip.checked = Boolean(settings.flipOnLeft);
    el.setSnapTop.checked = Boolean(settings.snapTopEnabled);
    el.setPill.checked = Boolean(settings.showCompactPill);
    el.setBubble.checked = Boolean(settings.bubbleEnabled);
    el.setBubbleSec.value = String(settings.bubbleDurationSec ?? 7);
    el.setBubbleTpl.value = settings.bubbleTemplate || '';
    el.setWarn.value = String(settings.contextWarnPct || 70);
    el.setWarnVal.textContent = `${settings.contextWarnPct || 70}%`;
    el.ctxWarnMark.style.left = `${settings.contextWarnPct || 70}%`;
    el.setBudget.value = String(((settings.dailyBudgetTokens || 2000000) / 1e6).toFixed(1));

    renderSkinGallery();
    renderSoundStudio();
    renderToolboxDisplay(toolbox.getComputedDisplay());
    updateMascotVisual(skinChanged);
  }

  function switchTab(tabName) {
    activeTab = tabName;
    if (tabName !== 'companion') snakeGame.pauseIfRunning();
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tabName));
    el.btnOpenSettings.classList.toggle('active', tabName === 'settings');
    document.querySelectorAll('.tab-pane').forEach((p) => p.classList.toggle('active', p.id === `tab-${tabName}`));
  }

  function renderPanelVisibility() {
    el.panel.classList.toggle('hidden', !panelOpen);
    el.pillArrow.classList.toggle('open', panelOpen);
    if (!panelOpen) snakeGame.pauseIfRunning();
  }

  async function togglePanel(forceState) {
    const targetState = typeof forceState === 'boolean' ? forceState : !panelOpen;
    panelOpen = await api.setPanelOpen(targetState);
    renderPanelVisibility();
    if (panelOpen) {
      const fresh = await api.refreshData();
      renderStats(fresh);
    }
  }

  function renderStats(data) {
    if (!data) return;
    stats = data;
    const s = data.activeSession;
    const warnPct = Number(settings.contextWarnPct) || 70;

    if (s) {
      el.modelBadge.textContent = s.modelInfo?.shortName || 'AGY';
      const act = s.activity || { key: 'idle', label: '待机中' };
      el.activityPill.textContent = act.label;
      el.activityPill.classList.toggle('working', Boolean(s.isWorking));

      setRollingText(el.pillCtx, `${s.contextPct}%`);
      const secondTxt = s.isWorking
        ? act.label
        : s.isSleeping
          ? '💤 打盹'
          : s.latestSpeedTokSec
            ? `${s.latestSpeedTokSec}/s · ${s.sessionCacheHitPct}%`
            : `缓存 ${s.sessionCacheHitPct}%`;
      setRollingText(el.pillSecond, secondTxt);

      el.pillDot.className = 'pill-dot';
      if (s.isWorking) el.pillDot.classList.add('working');
      else if (s.isSleeping) el.pillDot.classList.add('sleeping');
      else if (s.contextPct >= 85 || s.isCacheCliff) el.pillDot.classList.add('danger');
      else if (s.contextPct >= warnPct) el.pillDot.classList.add('warn');

      setRollingText(el.ctxValue, `${fmtTok(s.contextTokens)} / ${fmtTok(s.contextLimit)} (${s.contextPct}%)`);
      el.ctxBar.style.width = `${Math.max(2, s.contextPct)}%`;
      el.ctxBar.className = 'progress-fill';
      if (s.contextPct >= 85 || s.isCacheCliff) el.ctxBar.classList.add('danger');
      else if (s.contextPct >= warnPct) el.ctxBar.classList.add('warn');

      if (s.isCacheCliff) el.ctxHint.textContent = '⚠ 检测到缓存断层，注意避免中途改动常驻规则';
      else if (s.contextPct >= 85) el.ctxHint.textContent = '🚨 接近自动压缩红线，强烈建议开新会话或 /compact';
      else if (s.contextPct >= warnPct) el.ctxHint.textContent = '💦 上下文偏胖啦，换话题记得开新对话哦';
      else el.ctxHint.textContent = `峰值 ${fmtTok(s.peakContextTokens)} · 记忆清爽稳定 ✨`;

      el.compactionTag.textContent = `已压缩 ${s.compactionCount} 次`;
      el.compactionTag.classList.toggle('hidden', !s.compactionCount);

      setRollingText(el.mCache, `${s.sessionCacheHitPct}%`);
      el.mCacheSub.textContent = `最近一步 ${s.stepCacheHitPct}%`;
      setRollingText(el.mSpeed, s.latestSpeedTokSec ? `${s.latestSpeedTokSec} tok/s` : '--');
      el.mSpeedSub.textContent = s.avgSpeedTokSec
        ? `会话均速 ${s.avgSpeedTokSec} tok/s`
        : s.latestDurationSec ? `最近步耗时 ${s.latestDurationSec}s` : '等待新输出';
      setRollingText(el.mInOut, fmtTok(s.totalInput + s.totalOutput));
      el.mInOutSub.textContent = `${s.turns} 轮 · ${s.plannerSteps} 步`;
      setRollingText(el.mCacheTok, fmtTok(s.totalCacheRead));
      el.mRefUsd.textContent = `API参考 ${fmtUsd(s.totalEstUsd)}`;
    } else {
      setRollingText(el.pillCtx, '待机');
      setRollingText(el.pillSecond, '等待对话');
      el.activityPill.textContent = '待机中';
      el.ctxHint.textContent = '尚未检测到 Antigravity 本地会话日志';
    }

    const q = data.quota;
    if (q && q.localBudget) {
      el.quotaLabel.textContent = q.source === 'usage-monitor-cache' ? '云端额度池（联动缓存）' : '今日净耗参考预算';
      setRollingText(el.quotaVal, `${fmtTok(q.localBudget.usedTokens)} / ${fmtTok(q.localBudget.budgetTokens)} (${q.localBudget.usedPct}%)`);
      el.quotaBar.style.width = `${Math.min(100, q.localBudget.usedPct)}%`;
      el.todayUsd.textContent = `参考 ${fmtUsd(data.ledger.today.estUsd)}`;
      el.quotaSub.textContent = q.pluginInstalled ? '已检测到 usage-monitor · 兼容模式' : '纯本地日志直读 · 非 Pro 真实扣费';
    }

    const recent = data.ledger.recentSessions || [];
    const curVal = data.pinnedSessionId || '';
    const opts = ['<option value="">自动追踪最新主会话</option>'];
    for (const r of recent) {
      const tag = r.isSubagent ? '[子代理] ' : '';
      const sel = r.id === curVal ? ' selected' : '';
      opts.push(`<option value="${r.id}"${sel}>${tag}${escapeHtml(r.title)} (${r.contextPct}%)</option>`);
    }
    el.sessionSelect.innerHTML = opts.join('');

    const td = data.ledger.today;
    const d7 = data.ledger.last7Days;
    const all = data.ledger.allTime;
    el.lTodayTok.textContent = fmtTok(td.input + td.output);
    el.lTodayMeta.textContent = `${td.turns} 轮 · 缓存 ${fmtTok(td.cacheRead)}`;
    el.l7dTok.textContent = fmtTok(d7.input + d7.output);
    el.l7dMeta.textContent = `参考 ${fmtUsd(d7.estUsd)}`;
    el.lAllTok.textContent = fmtTok(all.input + all.output);
    el.lAllMeta.textContent = `${all.sessions} 会话`;

    const series = data.ledger.dailySeries || [];
    const maxDay = Math.max(1, ...series.map((x) => x.input + x.output));
    el.dailyChart.innerHTML = series.map((d, idx) => {
      const net = d.input + d.output;
      const pct = Math.max(4, Math.round((net / maxDay) * 100));
      const isToday = idx === series.length - 1;
      const tip = `${d.date}\n净耗: ${fmtTok(net)} (In ${fmtTok(d.input)} / Out ${fmtTok(d.output)})\n缓存复用: ${fmtTok(d.cacheRead)}\n轮次: ${d.turns}`;
      return `<div class="day-col" title="${escapeHtml(tip)}">
        <div class="day-bar-wrap"><div class="day-bar${isToday ? ' today' : ''}" style="height:${pct}%"></div></div>
        <span class="day-label">${d.label}</span>
      </div>`;
    }).join('');

    const models = (data.ledger.byModel || []).slice(0, 5);
    const maxMod = Math.max(1, ...models.map((m) => m.input + m.output));
    el.modelList.innerHTML = models.length === 0
      ? '<div class="muted">暂无模型调用记录</div>'
      : models.map((m) => {
          const net = m.input + m.output;
          const pct = Math.max(4, Math.round((net / maxMod) * 100));
          return `<div class="model-item">
            <div class="model-row-top"><span>${escapeHtml(m.displayName)}</span><span class="muted">${fmtTok(net)} · ${m.calls} 步</span></div>
            <div class="model-bar-bg"><div class="model-bar-fg" style="width:${pct}%;background:${m.color}"></div></div>
          </div>`;
        }).join('');

    el.recentList.innerHTML = recent.slice(0, 8).map((r) => {
      const isActive = s && r.id === s.id;
      return `<div class="recent-item${isActive ? ' active' : ''}" data-sid="${r.id}">
        <span class="recent-title">${r.isSubagent ? '🤖 ' : ''}${escapeHtml(r.title)}</span>
        <span class="recent-meta">${r.modelShort} · ${r.contextPct}%</span>
      </div>`;
    }).join('');

    updateMascotVisual(false);
  }

  // ==================== Mascot Pat / Drag / Click ====================
  async function handlePatInteraction() {
    const res = await api.patPet();
    if (res) renderPetState(res);
    const lines = (activeSkin && activeSkin.pokeLines && activeSkin.pokeLines.length)
      ? activeSkin.pokeLines
      : [['别戳啦，Token 在烧着呢！', '双击我可展开监测面板 ✦']];
    const [line, mood] = lines[pokeCount % lines.length];
    pokeCount++;
    setTransientPose('poked', 2200);
    playSfx('poke');
    if (res && res.gained > 0) {
      spawnFloatParticle(res.leveledUp ? `🎉 Lv.${res.tier.level}!` : '+1 ♥');
    }
    const finalMood = res && res.leveledUp ? `🎉 羁绊升级为「${res.tier.title}」！` : mood;
    showBubble(line, finalMood, false, true);
  }

  el.mascotHit.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    isPointerDown = true;
    isDragging = false;
    downPos = { x: e.screenX, y: e.screenY };
    el.mascotJelly.classList.remove('squish-bounce');
    el.mascotJelly.classList.add('squish-down');
    el.mascotHit.setPointerCapture(e.pointerId);
  });

  el.mascotHit.addEventListener('pointermove', (e) => {
    if (!isPointerDown) return;
    if (!isDragging && Math.hypot(e.screenX - downPos.x, e.screenY - downPos.y) > 5) {
      isDragging = true;
      el.mascotHit.classList.add('dragging');
      el.mascotJelly.classList.remove('squish-down');
      api.startDrag();
    }
  });

  function finishPointer(e) {
    if (!isPointerDown) return;
    isPointerDown = false;
    try { el.mascotHit.releasePointerCapture(e.pointerId); } catch {}
    if (isDragging) {
      isDragging = false;
      el.mascotHit.classList.remove('dragging');
      api.endDrag();
      triggerJellyBounce();
      return;
    }
    triggerJellyBounce();
    if (clickDebounceTimer) {
      clearTimeout(clickDebounceTimer);
      clickDebounceTimer = null;
      togglePanel();
      playSfx('panel');
      return;
    }
    clickDebounceTimer = setTimeout(() => {
      clickDebounceTimer = null;
      handlePatInteraction();
    }, 220);
  }

  el.mascotHit.addEventListener('pointerup', finishPointer);
  el.mascotHit.addEventListener('pointercancel', finishPointer);
  el.mascotHit.addEventListener('contextmenu', (e) => { e.preventDefault(); api.openContextMenu(); });

  el.statusPill.addEventListener('click', () => { playSfx('panel'); togglePanel(); });
  el.statusPill.addEventListener('contextmenu', (e) => { e.preventDefault(); api.openContextMenu(); });
  el.bubbleClose.addEventListener('click', (e) => { e.stopPropagation(); hideBubble(); });
  el.floatingNote.addEventListener('click', async () => {
    await togglePanel(true);
    switchTab('tools');
    el.noteTextarea.focus();
  });

  // ==================== Panel & Tabs ====================
  el.btnClosePanel.addEventListener('click', () => { playSfx('panel'); togglePanel(false); });
  el.btnOpenNebula.addEventListener('click', async () => {
    playSfx('happy');
    const res = await api.openNebula();
    if (!res || !res.ok) {
      showBubble('打开记忆星图失败 💦', res?.error || '请先在 Antigravity 确认 local-memory 插件已启用', true, true);
    }
  });
  el.btnOpenSettings.addEventListener('click', () => {
    playSfx('panel');
    switchTab(activeTab === 'settings' ? 'live' : 'settings');
  });
  el.btnRefresh.addEventListener('click', async () => {
    renderStats(await api.refreshData());
    triggerJellyBounce();
    playSfx('panel');
  });

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  el.sessionSelect.addEventListener('change', async () => renderStats(await api.pinSession(el.sessionSelect.value || null)));
  el.recentList.addEventListener('click', async (e) => {
    const item = e.target.closest('.recent-item');
    if (!item) return;
    renderStats(await api.pinSession(item.dataset.sid));
    switchTab('live');
  });

  // ==================== Companion & Snake Events ====================
  el.btnPatPet.addEventListener('click', () => { triggerJellyBounce(); handlePatInteraction(); });
  el.btnFeedPet.addEventListener('click', async () => {
    const res = await api.feedPet(1);
    if (!res || !res.ok) {
      playSfx('alert');
      showBubble('星光小鱼干吃光啦 🐟', '多完成几轮对话、保持高缓存或完成番茄钟就会掉落哦！', false, true);
      return;
    }
    renderPetState(res.state);
    setTransientPose('happy', 3200);
    triggerJellyBounce();
    playSfx('happy');
    spawnFloatParticle(res.leveledUp ? `🎉 升级 Lv.${res.state.tier.level}!` : '🐟 +5 ♥');
    showBubble(
      `谢谢投喂星光小鱼干！好感度 +${res.gained} ♥`,
      res.leveledUp ? `🎉 恭喜解锁新羁绊称号「${res.state.tier.title}」✨` : `${getDisplayPetName()} 吃得超开心～`,
      false,
      true
    );
  });

  el.btnSaveNickname.addEventListener('click', async () => {
    if (!activeSkin) return;
    const snap = await api.setPetNickname(activeSkin.id, el.petNicknameInput.value);
    renderPetState(snap);
    playSfx('happy');
    showBubble(`以后就叫我「${getDisplayPetName()}」啦 ✦`, '专属昵称已保存！', false, true);
  });

  el.btnSnakeStart.addEventListener('click', () => snakeGame.togglePause());
  el.btnSnakeRestart.addEventListener('click', () => snakeGame.startNew());
  document.querySelectorAll('.dpad-btn').forEach((b) => {
    b.addEventListener('click', () => {
      const [dx, dy] = b.dataset.dir.split(',').map(Number);
      snakeGame.setDirection(dx, dy);
    });
  });

  window.addEventListener('keydown', (e) => {
    if (!panelOpen || activeTab !== 'companion') return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { e.preventDefault(); snakeGame.setDirection(0, -1); }
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { e.preventDefault(); snakeGame.setDirection(0, 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); snakeGame.setDirection(-1, 0); }
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); snakeGame.setDirection(1, 0); }
    else if (e.key === ' ') { e.preventDefault(); snakeGame.togglePause(); }
    else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); snakeGame.startNew(); }
  });

  // ==================== Toolbox Events ====================
  el.btnPomoToggle.addEventListener('click', () => { playSfx('panel'); toolbox.togglePomodoro(); });
  el.btnPomoReset.addEventListener('click', () => { playSfx('panel'); toolbox.resetPomodoro(); });
  el.btnPomoSwitch.addEventListener('click', () => {
    const cur = toolbox.getComputedDisplay().pomo.phase;
    playSfx('panel');
    toolbox.resetPomodoro(cur === 'work' ? 'break' : 'work');
  });
  el.pomoWorkMin.addEventListener('change', () => toolbox.setPomodoroDurations(el.pomoWorkMin.value, el.pomoBreakMin.value));
  el.pomoBreakMin.addEventListener('change', () => toolbox.setPomodoroDurations(el.pomoWorkMin.value, el.pomoBreakMin.value));

  el.hydroEnabled.addEventListener('change', () => toolbox.setHydration(el.hydroEnabled.checked, el.hydroInterval.value));
  el.hydroInterval.addEventListener('change', () => toolbox.setHydration(el.hydroEnabled.checked, el.hydroInterval.value));
  el.btnHydroAck.addEventListener('click', async () => {
    toolbox.ackHydration();
    const res = await api.rewardPet({ treats: 0, affinity: 1 });
    if (res && res.state) renderPetState(res.state);
    spawnFloatParticle('💧 +1 ♥');
    playSfx('happy');
    showBubble('补水打卡成功 💧', '身体棒棒，写论文和代码效率翻倍！', false, true);
  });

  el.noteVisible.addEventListener('change', () =>
    api.updateSettings({ toolbox: { stickyNote: { visible: el.noteVisible.checked } } })
  );
  el.noteTextarea.addEventListener('input', () => {
    if (noteSaveTimer) clearTimeout(noteSaveTimer);
    noteSaveTimer = setTimeout(() => {
      api.updateSettings({ toolbox: { stickyNote: { text: el.noteTextarea.value } } });
    }, 300);
  });

  // ==================== Skin Library Events ====================
  el.skinGrid.addEventListener('click', async (e) => {
    const delBtn = e.target.closest('[data-del-skin]');
    if (delBtn) {
      e.stopPropagation();
      const res = await api.deleteSkin(delBtn.dataset.delSkin);
      if (res && res.skins) { skins = res.skins; renderSkinGallery(); updateMascotVisual(true); }
      return;
    }
    const card = e.target.closest('.skin-card');
    if (!card) return;
    const sid = card.dataset.skinId;
    await api.updateSettings({ activeSkinId: sid });
    const sk = skins.find((x) => x.id === sid);
    triggerJellyBounce();
    playSfx('happy');
    if (sk && sk.greeting) showBubble(sk.greeting[0], sk.greeting[1], false, true);
  });

  el.btnImportSkin.addEventListener('click', async () => {
    const res = await api.importSkin();
    if (res && !res.canceled && res.skins) {
      skins = res.skins;
      renderSkinGallery();
      updateMascotVisual(true);
      triggerJellyBounce();
      playSfx('happy');
      showBubble('自定义形象导入成功 ✦', '下方还可以按状态逐个替换表情图哦！', false, true);
    }
  });

  el.btnImportPetdex.addEventListener('click', async () => {
    const res = await api.importPetdexFolder();
    if (res && !res.canceled && res.skins) {
      skins = res.skins;
      renderSkinGallery();
      updateMascotVisual(true);
      triggerJellyBounce();
      playSfx('happy');
      showBubble('Petdex / 精灵图皮肤导入成功 ✦', '可以在下方拉动帧率滑块调动画流畅度！', false, true);
    }
  });

  el.btnSyncSkinSound.addEventListener('click', async () => {
    const sk = resolveActiveSkin();
    if (!sk || !sk.recommendedSoundPack) return;
    await api.updateSettings({ sound: { pack: sk.recommendedSoundPack } });
    const packObj = SOUND_PACKS.find((p) => p.id === sk.recommendedSoundPack);
    playSfx('turn', { force: true, packOverride: sk.recommendedSoundPack });
    showBubble(`已配对「${packObj ? packObj.name : sk.recommendedSoundPack}」音效包 ✦`, '随时可在「音效」页继续微调参数', false, true);
  });

  el.btnOpenSkins.addEventListener('click', () => api.openSkinsFolder());
  el.setFps.addEventListener('input', () => {
    const f = Number(el.setFps.value);
    el.setFpsVal.textContent = `${f} FPS`;
    spritePlayer.setFps(f);
  });
  el.setFps.addEventListener('change', () => api.updateSettings({ spriteFps: Number(el.setFps.value) }));

  document.querySelectorAll('.pose-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pose = btn.dataset.pose;
      setTransientPose(pose, 2800);
      triggerJellyBounce();
      playSfx(pose === 'sweat' ? 'alert' : pose === 'happy' ? 'happy' : 'poke');
    });
  });

  document.querySelectorAll('.replace-state-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!activeSkin || activeSkin.builtin) return;
      const st = btn.dataset.replace;
      const res = await api.replaceSkinState(activeSkin.id, st);
      if (res && !res.canceled && res.skins) {
        skins = res.skins;
        renderSkinGallery();
        setTransientPose(st, 2500);
        playSfx('happy');
      }
    });
  });

  // ==================== Sound Studio Events ====================
  const patchSound = (patch) => api.updateSettings({ sound: patch });

  el.sndEnabled.addEventListener('change', () => patchSound({ enabled: el.sndEnabled.checked }));
  el.btnOpenSounds.addEventListener('click', () => api.openSoundsFolder());
  el.btnResetSound.addEventListener('click', async () => { applySettings(await api.resetSound()); playSfx('turn', { force: true }); });
  el.btnPreviewChord.addEventListener('click', () => playSfx('turn', { force: true }));

  el.soundPackGrid.addEventListener('click', async (e) => {
    const card = e.target.closest('.pack-card');
    if (!card) return;
    await patchSound({ pack: card.dataset.pack });
    playSfx('turn', { force: true, packOverride: card.dataset.pack });
  });

  el.sndVol.addEventListener('input', () => { settings.sound.volume = Number(el.sndVol.value); el.sndVolVal.textContent = `${Math.round(settings.sound.volume * 100)}%`; });
  el.sndVol.addEventListener('change', () => { patchSound({ volume: Number(el.sndVol.value) }); playSfx('poke', { force: true }); });
  el.sndPitch.addEventListener('input', () => { const p = Number(el.sndPitch.value); settings.sound.pitchSemitones = p; el.sndPitchVal.textContent = `${p > 0 ? '+' : ''}${p} st`; });
  el.sndPitch.addEventListener('change', () => { patchSound({ pitchSemitones: Number(el.sndPitch.value) }); playSfx('poke', { force: true }); });
  el.sndSpeed.addEventListener('input', () => { const s = Number(el.sndSpeed.value); settings.sound.speed = s; el.sndSpeedVal.textContent = `${s.toFixed(2).replace(/0$/, '')}x`; });
  el.sndSpeed.addEventListener('change', () => { patchSound({ speed: Number(el.sndSpeed.value) }); playSfx('turn', { force: true }); });
  el.sndDecay.addEventListener('input', () => { const d = Number(el.sndDecay.value); settings.sound.decay = d; el.sndDecayVal.textContent = `${d.toFixed(1)}x`; });
  el.sndDecay.addEventListener('change', () => { patchSound({ decay: Number(el.sndDecay.value) }); playSfx('turn', { force: true }); });
  el.sndBright.addEventListener('input', () => { const b = Number(el.sndBright.value); settings.sound.brightness = b; el.sndBrightVal.textContent = `${Math.round(b * 100)}%`; });
  el.sndBright.addEventListener('change', () => { patchSound({ brightness: Number(el.sndBright.value) }); playSfx('turn', { force: true }); });

  el.soundEventList.addEventListener('change', (e) => {
    const row = e.target.closest('.ev-row');
    if (!row) return;
    const ev = row.dataset.ev;
    if (e.target.classList.contains('ev-toggle')) patchSound({ events: { [ev]: { enabled: e.target.checked } } });
    else if (e.target.classList.contains('ev-select')) {
      const packOverride = e.target.value;
      patchSound({ events: { [ev]: { packOverride } } });
      playSfx(ev, { force: true, packOverride: packOverride || settings.sound.pack });
    }
  });

  el.soundEventList.addEventListener('click', async (e) => {
    const row = e.target.closest('.ev-row');
    if (!row) return;
    const ev = row.dataset.ev;
    if (e.target.classList.contains('ev-play')) playSfx(ev, { force: true });
    else if (e.target.classList.contains('ev-import')) {
      const res = await api.importSoundForEvent(ev);
      if (res && !res.canceled) { applySettings(res.settings); playSfx(ev, { force: true }); }
    } else if (e.target.classList.contains('ev-clear')) {
      applySettings(await api.clearSoundForEvent(ev));
      playSfx(ev, { force: true });
    }
  });

  // ==================== Settings Events ====================
  el.setFollowMode.addEventListener('change', () => api.updateSettings({ followMode: el.setFollowMode.value }));
  el.setScale.addEventListener('input', () => { el.setScaleVal.textContent = `${Math.round(Number(el.setScale.value) * 100)}%`; });
  el.setScale.addEventListener('change', () => api.updateSettings({ scale: Number(el.setScale.value) }));
  el.setAutoStart.addEventListener('change', async () => {
    const ok = await api.setAutoStart(el.setAutoStart.checked);
    el.setAutoStart.checked = Boolean(ok);
    playSfx(ok ? 'happy' : 'panel');
    showBubble(
      ok ? '已开启开机静默潜伏 ✦' : '已关闭开机自启',
      ok ? '以后打开 Antigravity 我就会自动现身啦！' : '可随时再重新开启',
      false,
      true
    );
  });
  el.setSilentLurk.addEventListener('change', () => api.updateSettings({ silentLurk: el.setSilentLurk.checked }));
  el.setQuiet.addEventListener('change', () => api.updateSettings({ quietWhileWorking: el.setQuiet.checked }));
  el.setSleepSec.addEventListener('change', () => api.updateSettings({ sleepAfterSec: Math.max(60, Math.min(3600, Number(el.setSleepSec.value) || 300)) }));
  el.setFlip.addEventListener('change', () => api.updateSettings({ flipOnLeft: el.setFlip.checked }));
  el.setSnapTop.addEventListener('change', () => api.updateSettings({ snapTopEnabled: el.setSnapTop.checked }));
  el.setPill.addEventListener('change', () => api.updateSettings({ showCompactPill: el.setPill.checked }));
  el.setBubble.addEventListener('change', () => api.updateSettings({ bubbleEnabled: el.setBubble.checked }));
  el.setBubbleSec.addEventListener('change', () => api.updateSettings({ bubbleDurationSec: Math.max(0, Math.min(30, Number(el.setBubbleSec.value) || 0)) }));
  el.setBubbleTpl.addEventListener('change', () => api.updateSettings({ bubbleTemplate: el.setBubbleTpl.value.trim() || '本轮 +{turnTokens} · 缓存 {cachePct}% · {speed}' }));

  document.querySelectorAll('.tpl-chips .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      el.setBubbleTpl.value = (el.setBubbleTpl.value + ' ' + chip.dataset.insert).trim();
      api.updateSettings({ bubbleTemplate: el.setBubbleTpl.value });
    });
  });

  el.btnTestBubble.addEventListener('click', () => {
    const mock = {
      delta: { input: 2450, output: 680, cacheRead: 98400, turnEstUsd: 0.018, stepCacheHitPct: 95, speedTokSec: 74.2 },
      contextPct: stats?.activeSession?.contextPct ?? 24,
      isCacheCliff: false,
      modelInfo: stats?.activeSession?.modelInfo || { shortName: 'G4 Neon' }
    };
    const { text, mood, isAlert } = formatTurnBubble(mock);
    setTransientPose('happy', 3200);
    triggerJellyBounce();
    showBubble(text, mood, isAlert, true);
    playSfx('happy', { force: true });
  });

  el.setWarn.addEventListener('input', () => { el.setWarnVal.textContent = `${el.setWarn.value}%`; });
  el.setWarn.addEventListener('change', () => api.updateSettings({ contextWarnPct: Number(el.setWarn.value) }));
  el.setBudget.addEventListener('change', () => api.updateSettings({ dailyBudgetTokens: Math.round(Math.max(0.2, Math.min(50, Number(el.setBudget.value) || 2)) * 1e6) }));

  el.btnOpenLogs.addEventListener('click', () => api.openBrainFolder());
  el.btnResetPos.addEventListener('click', () => api.updateSettings({ dockEdge: 'right', relativeOffset: { dx: -18, dy: -16 }, globalPos: { x: null, y: null } }));
  el.btnResetAll.addEventListener('click', async () => applySettings(await api.resetSettings()));

  // ==================== IPC Subscriptions ====================
  api.onStatsUpdate((snapshot) => renderStats(snapshot));
  api.onSettingsChanged((next) => applySettings(next));
  api.onPetStateChanged((ps) => renderPetState(ps));
  api.onSnapped(() => playSfx('snap'));

  api.onTurnEvent((evt) => {
    const { text, mood, isAlert, isHappy } = formatTurnBubble(evt);
    const isIntermediateToolStep = (evt.delta?.toolCallsCount || 0) > 0 && !evt.delta?.hasReplyText;

    // Quiet-while-working rule: don't chatter during intermediate tool calls unless urgent alert!
    if (settings.quietWhileWorking !== false && isIntermediateToolStep && !isAlert) {
      if (evt.treatsEarned) spawnFloatParticle(`+${evt.treatsEarned} 🐟`);
      return;
    }

    if (evt.treatsEarned) spawnFloatParticle(`+${evt.treatsEarned} 🐟`);
    if (isAlert) {
      setTransientPose('sweat', 8000);
      playSfx('alert');
    } else if (isHappy) {
      setTransientPose('happy', 6500);
      playSfx('happy');
    } else {
      playSfx('turn');
    }
    triggerJellyBounce();
    showBubble(text, mood, isAlert, false);
  });

  // Boot
  (async function init() {
    const initial = await api.getInitialState();
    skins = initial.skins || [];
    panelOpen = Boolean(initial.panelOpen);
    if (initial.pet) renderPetState(initial.pet);
    el.setAutoStart.checked = Boolean(initial.autoStart);
    applySettings(initial.settings);
    renderPanelVisibility();
    renderStats(initial.stats);
    toolbox.start();
    setTimeout(() => {
      const g = (activeSkin && activeSkin.greeting) || [`${getDisplayPetName()} 已就位 ✦`, '左键摸头 · 双击或点脚下胶囊打开控制台'];
      showBubble(g[0], g[1], false, true);
      triggerJellyBounce();
    }, 650);
  })();
})();
