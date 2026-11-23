'use strict';

(() => {
  const SHARED_COOLDOWN_MS = 10000;

  class ToolboxController {
    constructor(callbacks = {}) {
      this.getSettings = callbacks.getSettings;
      this.patchToolbox = callbacks.patchToolbox;
      this.isBusy = callbacks.isBusy || (() => false);
      this.onNotify = callbacks.onNotify || (() => {});
      this.onRender = callbacks.onRender || (() => {});
      this.onPomodoroComplete = callbacks.onPomodoroComplete || (() => {});

      this.lastNotifyAt = 0;
      this.timer = null;
    }

    start() {
      if (this.timer) return;
      this.timer = setInterval(() => this.tick(), 1000);
      this.tick();
    }

    stop() {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    }

    _getState() {
      const s = this.getSettings() || {};
      const tb = s.toolbox || {};
      return {
        quiet: Boolean(s.quietWhileWorking),
        pomo: {
          workMin: 25,
          breakMin: 5,
          phase: 'work',
          running: false,
          endAt: 0,
          remainingSec: 25 * 60,
          ...(tb.pomodoro || {})
        },
        hydro: {
          enabled: false,
          intervalMin: 45,
          nextAt: 0,
          lastNotifiedAt: 0,
          ...(tb.hydration || {})
        },
        note: {
          visible: false,
          text: '',
          ...(tb.stickyNote || {})
        }
      };
    }

    getComputedDisplay() {
      const { pomo, hydro, note } = this._getState();
      let remSec = Math.max(0, Math.round(pomo.remainingSec || pomo.workMin * 60));
      if (pomo.running && pomo.endAt > 0) {
        remSec = Math.max(0, Math.ceil((pomo.endAt - Date.now()) / 1000));
      }
      const mm = String(Math.floor(remSec / 60)).padStart(2, '0');
      const ss = String(remSec % 60).padStart(2, '0');

      let hydroRemainMin = null;
      if (hydro.enabled && hydro.nextAt > 0) {
        hydroRemainMin = Math.max(0, Math.ceil((hydro.nextAt - Date.now()) / 60000));
      }

      return {
        pomo: { ...pomo, remSec, formatted: `${mm}:${ss}` },
        hydro: { ...hydro, remainMin: hydroRemainMin },
        note
      };
    }

    togglePomodoro() {
      const { pomo } = this._getState();
      if (pomo.running) {
        const rem = Math.max(1, Math.ceil((pomo.endAt - Date.now()) / 1000));
        return this.patchToolbox({
          pomodoro: { running: false, endAt: 0, remainingSec: rem }
        });
      }
      const baseSec = pomo.remainingSec > 0 ? pomo.remainingSec : (pomo.phase === 'work' ? pomo.workMin : pomo.breakMin) * 60;
      return this.patchToolbox({
        pomodoro: { running: true, endAt: Date.now() + baseSec * 1000, remainingSec: baseSec }
      });
    }

    resetPomodoro(phaseOverride) {
      const { pomo } = this._getState();
      const nextPhase = phaseOverride || 'work';
      const sec = (nextPhase === 'work' ? pomo.workMin : pomo.breakMin) * 60;
      return this.patchToolbox({
        pomodoro: { phase: nextPhase, running: false, endAt: 0, remainingSec: sec }
      });
    }

    setPomodoroDurations(workMin, breakMin) {
      const w = Math.max(1, Math.min(120, Math.round(Number(workMin) || 25)));
      const b = Math.max(1, Math.min(60, Math.round(Number(breakMin) || 5)));
      const { pomo } = this._getState();
      const patch = { workMin: w, breakMin: b };
      if (!pomo.running) {
        patch.remainingSec = (pomo.phase === 'work' ? w : b) * 60;
      }
      return this.patchToolbox({ pomodoro: patch });
    }

    setHydration(enabled, intervalMin) {
      const { hydro } = this._getState();
      const iv = Math.max(10, Math.min(180, Math.round(Number(intervalMin || hydro.intervalMin) || 45)));
      const nextAt = enabled ? Date.now() + iv * 60000 : 0;
      return this.patchToolbox({
        hydration: { enabled: Boolean(enabled), intervalMin: iv, nextAt }
      });
    }

    ackHydration() {
      const { hydro } = this._getState();
      const nextAt = hydro.enabled ? Date.now() + hydro.intervalMin * 60000 : 0;
      return this.patchToolbox({
        hydration: { nextAt, lastNotifiedAt: Date.now() }
      });
    }

    tick() {
      const now = Date.now();
      const { quiet, pomo, hydro } = this._getState();
      const canNotifyNow = now - this.lastNotifyAt >= SHARED_COOLDOWN_MS;

      // 1. Pomodoro completion check
      if (pomo.running && pomo.endAt > 0 && now >= pomo.endAt) {
        const finishedWork = pomo.phase === 'work';
        const nextPhase = finishedWork ? 'break' : 'work';
        const nextSec = (nextPhase === 'work' ? pomo.workMin : pomo.breakMin) * 60;

        this.patchToolbox({
          pomodoro: {
            phase: nextPhase,
            running: false,
            endAt: 0,
            remainingSec: nextSec
          }
        });

        this.lastNotifyAt = now;
        if (finishedWork) {
          this.onPomodoroComplete();
          this.onNotify({
            kind: 'happy',
            title: '🍅 番茄专注完成！奖励 +3 星光小鱼干',
            mood: '起来伸个懒腰休息 5 分钟吧，辛苦啦 ✨'
          });
        } else {
          this.onNotify({
            kind: 'turn',
            title: '🍅 休息时间结束啦～',
            mood: '准备好了就点开始进入下一轮专注吧 ✦'
          });
        }
      }

      // 2. Hydration / stretch reminder (respects shared 10s cooldown & quiet-while-working deferral)
      if (hydro.enabled && hydro.nextAt > 0 && now >= hydro.nextAt && canNotifyNow) {
        if (!quiet || !this.isBusy()) {
          this.lastNotifyAt = now;
          this.patchToolbox({
            hydration: {
              nextAt: now + hydro.intervalMin * 60000,
              lastNotifiedAt: now
            }
          });
          this.onNotify({
            kind: 'turn',
            title: '💧 久坐 & 喝水提醒时间到！',
            mood: `已经专注 ${hydro.intervalMin} 分钟啦，喝口温水活动下肩颈喵～`
          });
        }
      }

      this.onRender(this.getComputedDisplay());
    }
  }

  window.ToolboxController = ToolboxController;
})();
