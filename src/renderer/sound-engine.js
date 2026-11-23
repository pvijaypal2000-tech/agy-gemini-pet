'use strict';

(() => {
  const SOUND_PACKS = [
    { id: 'starlight', name: '星光八音盒', desc: '清脆星辰水晶风铃与柔和泛音' },
    { id: 'meow-bell', name: '猫铃铛喵波', desc: '俏皮铃铛泛音 + 软萌上扬喵声滑音' },
    { id: 'arcade-8bit', name: '8-Bit 电玩', desc: '红白机金币、升级与像素预警音' },
    { id: 'glass-droplet', name: '水滴玻璃琴', desc: '清透冰滴混响，安静治愈不刺耳' },
    { id: 'cyber-sci', name: '反重力科幻', desc: '未来太空舱谐波脉冲与星环扫频' },
    { id: 'lofi-piano', name: 'Lo-Fi 暖电钢', desc: '温暖爵士七和弦，长编码超治愈' }
  ];

  const SOUND_EVENTS = [
    { key: 'poke', label: '戳一戳猫娘' },
    { key: 'turn', label: '每轮对话完成' },
    { key: 'happy', label: '高缓存/高速夸夸' },
    { key: 'alert', label: '上下文/断层告警' },
    { key: 'panel', label: '面板展开/收起' },
    { key: 'snap', label: '拖拽吸边停靠' }
  ];

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.bufferCache = new Map(); // fileUrl -> AudioBuffer
    }

    _ensureCtx() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    _createMasterChain(ctx, cfg) {
      const master = ctx.createGain();
      const vol = Math.max(0.05, Math.min(1.0, Number(cfg.volume ?? 0.72)));
      master.gain.setValueAtTime(vol * 0.58, ctx.currentTime);

      // Real-time brightness lowpass filter (600Hz warm -> 14000Hz crystal bright)
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      const bright = Math.max(0.15, Math.min(1.0, Number(cfg.brightness ?? 0.78)));
      const cutoff = 650 * Math.pow(22, bright);
      filter.frequency.setValueAtTime(Math.min(18000, cutoff), ctx.currentTime);
      filter.Q.setValueAtTime(0.8, ctx.currentTime);

      // Gentle soft limiter via DynamicsCompressor so chords never clip even at 100% volume
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-10, ctx.currentTime);
      comp.ratio.setValueAtTime(4, ctx.currentTime);

      filter.connect(master);
      master.connect(comp);
      comp.connect(ctx.destination);
      return filter;
    }

    _note(ctx, dest, now, offsetSec, freqStart, freqEnd, durSec, peakGain, wave = 'triangle', cfg) {
      const pitchMul = Math.pow(2, (Number(cfg.pitchSemitones) || 0) / 12);
      const spd = Math.max(0.5, Math.min(1.8, Number(cfg.speed) || 1.0));
      const dec = Math.max(0.4, Math.min(2.2, Number(cfg.decay) || 1.0));

      const t0 = now + offsetSec / spd;
      const d = Math.max(0.04, (durSec / spd) * dec);
      const f0 = Math.max(60, Math.min(12000, freqStart * pitchMul));
      const f1 = Math.max(60, Math.min(12000, (freqEnd || freqStart) * pitchMul));

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(f0, t0);
      if (Math.abs(f1 - f0) > 1) {
        osc.frequency.exponentialRampToValueAtTime(f1, t0 + d * 0.68);
      }

      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(peakGain, t0 + Math.min(0.014, d * 0.2));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);

      osc.connect(g);
      g.connect(dest);
      osc.start(t0);
      osc.stop(t0 + d + 0.03);
    }

    async _playCustomUrl(url, cfg) {
      const ctx = this._ensureCtx();
      const dest = this._createMasterChain(ctx, cfg);
      let buffer = this.bufferCache.get(url);
      if (!buffer) {
        const res = await fetch(url);
        const arr = await res.arrayBuffer();
        buffer = await ctx.decodeAudioData(arr);
        this.bufferCache.set(url, buffer);
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const pitchMul = Math.pow(2, (Number(cfg.pitchSemitones) || 0) / 12);
      const spd = Math.max(0.5, Math.min(1.8, Number(cfg.speed) || 1.0));
      src.playbackRate.setValueAtTime(Math.max(0.35, Math.min(2.5, pitchMul * spd)), ctx.currentTime);
      src.connect(dest);
      src.start(ctx.currentTime);
    }

    play(eventKey, soundConfig, options = {}) {
      const cfg = soundConfig || {};
      const force = Boolean(options.force);
      if (!force && !cfg.enabled) return;

      const evCfg = (cfg.events && cfg.events[eventKey]) || {};
      if (!force && evCfg.enabled === false) return;

      // Custom local audio file takes precedence unless explicitly previewing a preset pack
      if (!options.packOverride && evCfg.customUrl) {
        this._playCustomUrl(evCfg.customUrl, cfg).catch(() => {
          this._playSynth(eventKey, evCfg.packOverride || cfg.pack || 'starlight', cfg);
        });
        return;
      }

      const pack = options.packOverride || evCfg.packOverride || cfg.pack || 'starlight';
      this._playSynth(eventKey, pack, cfg);
    }

    _playSynth(ev, pack, cfg) {
      try {
        const ctx = this._ensureCtx();
        const dest = this._createMasterChain(ctx, cfg);
        const now = ctx.currentTime;
        const n = (off, f0, f1, dur, gain, wave) => this._note(ctx, dest, now, off, f0, f1, dur, gain, wave, cfg);

        if (pack === 'meow-bell') {
          if (ev === 'poke') {
            // Playful upward meow glide + tiny collar bell overtone
            n(0, 580, 960, 0.14, 0.72, 'triangle');
            n(0.06, 1760, 1760, 0.22, 0.32, 'sine');
            n(0.065, 2637, 2637, 0.18, 0.18, 'sine');
          } else if (ev === 'turn') {
            n(0, 880, 1046.5, 0.14, 0.65, 'triangle');
            n(0.09, 1318.5, 1568, 0.22, 0.7, 'triangle');
            n(0.11, 2637, 2637, 0.26, 0.26, 'sine');
          } else if (ev === 'happy') {
            n(0, 1046.5, 1174.6, 0.11, 0.65, 'triangle');
            n(0.08, 1318.5, 1568, 0.12, 0.68, 'triangle');
            n(0.16, 1568, 2093, 0.28, 0.72, 'sine');
            n(0.17, 3136, 3136, 0.24, 0.24, 'sine');
          } else if (ev === 'alert') {
            // Startled kitty double downward mew
            n(0, 920, 560, 0.17, 0.75, 'sawtooth');
            n(0.18, 820, 460, 0.22, 0.72, 'triangle');
          } else if (ev === 'snap') {
            n(0, 1568, 1568, 0.14, 0.45, 'sine');
            n(0.02, 2349, 2349, 0.12, 0.25, 'sine');
          } else {
            n(0, 987.7, 1318.5, 0.12, 0.48, 'sine');
          }
          return;
        }

        if (pack === 'arcade-8bit') {
          if (ev === 'poke') {
            // Classic Mario-style coin ping (B5 -> E6)
            n(0, 987.77, 987.77, 0.08, 0.55, 'square');
            n(0.075, 1318.51, 1318.51, 0.24, 0.52, 'square');
          } else if (ev === 'turn') {
            // Level-up 4-note chiptune arpeggio
            n(0, 523.25, 523.25, 0.07, 0.48, 'square');
            n(0.065, 659.25, 659.25, 0.07, 0.48, 'square');
            n(0.13, 783.99, 783.99, 0.07, 0.50, 'square');
            n(0.195, 1046.5, 1046.5, 0.22, 0.55, 'square');
          } else if (ev === 'happy') {
            n(0, 659.25, 659.25, 0.06, 0.5, 'square');
            n(0.06, 783.99, 783.99, 0.06, 0.5, 'square');
            n(0.12, 1318.5, 1318.5, 0.06, 0.5, 'square');
            n(0.18, 1046.5, 1046.5, 0.06, 0.5, 'square');
            n(0.24, 1568.0, 1568.0, 0.26, 0.55, 'square');
          } else if (ev === 'alert') {
            n(0, 440, 330, 0.12, 0.55, 'sawtooth');
            n(0.14, 349, 220, 0.22, 0.55, 'sawtooth');
          } else if (ev === 'snap') {
            n(0, 440, 880, 0.08, 0.42, 'square');
          } else {
            n(0, 784, 1046.5, 0.09, 0.38, 'square');
          }
          return;
        }

        if (pack === 'glass-droplet') {
          if (ev === 'poke') {
            // Pure water drop upward blip + gentle echo
            n(0, 520, 1180, 0.12, 0.72, 'sine');
            n(0.11, 1180, 1480, 0.16, 0.28, 'sine');
          } else if (ev === 'turn') {
            n(0, 660, 990, 0.16, 0.65, 'sine');
            n(0.10, 880, 1320, 0.26, 0.62, 'sine');
            n(0.22, 1320, 1320, 0.24, 0.22, 'sine');
          } else if (ev === 'happy') {
            n(0, 784, 1046.5, 0.15, 0.62, 'sine');
            n(0.09, 1046.5, 1568, 0.20, 0.64, 'sine');
            n(0.18, 1568, 2093, 0.32, 0.52, 'sine');
          } else if (ev === 'alert') {
            n(0, 740, 480, 0.20, 0.72, 'sine');
            n(0.20, 620, 390, 0.26, 0.68, 'sine');
          } else if (ev === 'snap') {
            n(0, 620, 930, 0.10, 0.46, 'sine');
          } else {
            n(0, 700, 1050, 0.12, 0.45, 'sine');
          }
          return;
        }

        if (pack === 'cyber-sci') {
          if (ev === 'poke') {
            n(0, 420, 1260, 0.11, 0.58, 'sawtooth');
            n(0.05, 840, 1680, 0.16, 0.42, 'sine');
          } else if (ev === 'turn') {
            n(0, 587.3, 880, 0.12, 0.55, 'triangle');
            n(0.08, 880, 1174.6, 0.14, 0.58, 'sine');
            n(0.16, 1174.6, 1760, 0.26, 0.52, 'sine');
          } else if (ev === 'happy') {
            n(0, 440, 880, 0.12, 0.52, 'triangle');
            n(0.07, 659.2, 1318.5, 0.15, 0.55, 'sine');
            n(0.14, 880, 1760, 0.30, 0.60, 'sine');
          } else if (ev === 'alert') {
            n(0, 960, 640, 0.13, 0.62, 'sawtooth');
            n(0.14, 960, 520, 0.22, 0.62, 'sawtooth');
          } else if (ev === 'snap') {
            n(0, 360, 720, 0.09, 0.45, 'triangle');
          } else {
            n(0, 520, 980, 0.10, 0.45, 'sine');
          }
          return;
        }

        if (pack === 'lofi-piano') {
          // Warm electric piano chords (FMaj7 / CMaj9)
          if (ev === 'poke') {
            n(0, 523.25, 523.25, 0.26, 0.52, 'sine');
            n(0.03, 659.25, 659.25, 0.26, 0.42, 'triangle');
            n(0.06, 987.77, 987.77, 0.30, 0.35, 'sine');
          } else if (ev === 'turn') {
            // CMaj9 arpeggio
            n(0, 523.25, 523.25, 0.36, 0.50, 'sine');
            n(0.05, 659.25, 659.25, 0.36, 0.44, 'triangle');
            n(0.10, 783.99, 783.99, 0.38, 0.42, 'sine');
            n(0.15, 987.77, 987.77, 0.42, 0.38, 'sine');
            n(0.20, 1174.66, 1174.66, 0.46, 0.32, 'sine');
          } else if (ev === 'happy') {
            n(0, 587.33, 587.33, 0.32, 0.48, 'sine');
            n(0.06, 739.99, 739.99, 0.34, 0.44, 'triangle');
            n(0.12, 880.0, 880.0, 0.38, 0.44, 'sine');
            n(0.18, 1108.73, 1108.73, 0.46, 0.40, 'sine');
          } else if (ev === 'alert') {
            // Minor 7th gentle heads-up
            n(0, 440, 440, 0.28, 0.55, 'triangle');
            n(0.08, 523.25, 523.25, 0.28, 0.45, 'sine');
            n(0.16, 392.0, 392.0, 0.38, 0.52, 'triangle');
          } else if (ev === 'snap') {
            n(0, 659.25, 659.25, 0.18, 0.42, 'sine');
            n(0.04, 783.99, 783.99, 0.20, 0.34, 'sine');
          } else {
            n(0, 523.25, 523.25, 0.18, 0.40, 'sine');
            n(0.04, 783.99, 783.99, 0.22, 0.34, 'sine');
          }
          return;
        }

        // Default: 'starlight' (Crystal Starlight Music Box)
        if (ev === 'poke') {
          n(0, 740, 1244, 0.11, 0.72, 'triangle');
          n(0.07, 1318.5, 1568, 0.20, 0.62, 'sine');
          n(0.075, 2637, 2637, 0.18, 0.22, 'sine');
        } else if (ev === 'turn') {
          n(0, 1046.5, 1046.5, 0.18, 0.64, 'triangle');
          n(0.08, 1318.5, 1318.5, 0.20, 0.68, 'triangle');
          n(0.16, 1568.0, 1568.0, 0.30, 0.74, 'sine');
          n(0.17, 2093.0, 2093.0, 0.28, 0.30, 'sine');
        } else if (ev === 'happy') {
          n(0, 1046.5, 1046.5, 0.15, 0.62, 'triangle');
          n(0.07, 1318.5, 1318.5, 0.16, 0.65, 'triangle');
          n(0.14, 1568.0, 1568.0, 0.18, 0.68, 'sine');
          n(0.21, 2093.0, 2093.0, 0.34, 0.72, 'sine');
          n(0.22, 3136.0, 3136.0, 0.28, 0.24, 'sine');
        } else if (ev === 'alert') {
          n(0, 880, 620, 0.18, 0.75, 'triangle');
          n(0.19, 784, 523.25, 0.26, 0.75, 'triangle');
        } else if (ev === 'snap') {
          n(0, 1174.6, 1568, 0.12, 0.48, 'sine');
        } else {
          n(0, 880, 1174.6, 0.13, 0.50, 'sine');
        }
      } catch {}
    }
  }

  window.SoundLibrary = {
    SOUND_PACKS,
    SOUND_EVENTS,
    SoundEngine
  };
})();
