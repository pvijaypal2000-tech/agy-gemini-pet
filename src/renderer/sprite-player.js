'use strict';

(() => {
  class SpriteSheetPlayer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.sheet = null;
      this.img = null;
      this.pose = 'idle';
      this.fps = 8;
      this.pixelated = true;
      this.frame = 0;
      this.rafId = null;
      this.lastTick = 0;
      this.loadedUrl = '';
    }

    configure(sheet, fps = 8, pixelated = true) {
      this.sheet = sheet;
      this.fps = Math.max(1, Math.min(24, Number(fps) || sheet?.fps || 8));
      this.pixelated = Boolean(pixelated);

      if (!sheet || !sheet.url) {
        this.stop();
        return;
      }
      if (this.loadedUrl !== sheet.url) {
        this.loadedUrl = sheet.url;
        this.img = new Image();
        this.img.onload = () => {
          this.frame = 0;
          this.drawFrame();
        };
        this.img.src = sheet.url;
      }
      this.start();
    }

    setPose(pose) {
      if (this.pose !== pose) {
        this.pose = pose;
        this.frame = 0;
        this.drawFrame();
      }
    }

    setFps(fps) {
      this.fps = Math.max(1, Math.min(24, Number(fps) || 8));
    }

    start() {
      if (this.rafId) return;
      this.lastTick = performance.now();
      const loop = (now) => {
        this.rafId = requestAnimationFrame(loop);
        const interval = 1000 / this.fps;
        if (now - this.lastTick >= interval) {
          this.lastTick = now - ((now - this.lastTick) % interval);
          this.frame += 1;
          this.drawFrame();
        }
      };
      this.rafId = requestAnimationFrame(loop);
    }

    stop() {
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawFrame() {
      if (!this.sheet || !this.img || !this.img.complete || this.img.naturalWidth === 0) return;
      const cols = Math.max(1, Number(this.sheet.cols) || 1);
      const rows = Math.max(1, Number(this.sheet.rows) || 1);
      const states = this.sheet.states || {};
      const st = states[this.pose] || states.idle || { row: 0, frames: cols };

      const row = Math.max(0, Math.min(rows - 1, Number(st.row) || 0));
      const frameCount = Math.max(1, Math.min(cols, Number(st.frames) || cols));
      const col = this.frame % frameCount;

      const cellW = this.img.naturalWidth / cols;
      const cellH = this.img.naturalHeight / rows;

      const cw = this.canvas.width;
      const ch = this.canvas.height;
      const scale = Math.min((cw * 0.92) / cellW, (ch * 0.92) / cellH);
      const dw = cellW * scale;
      const dh = cellH * scale;
      const dx = (cw - dw) / 2;
      const dy = ch - dh - 4;

      this.ctx.clearRect(0, 0, cw, ch);
      this.ctx.imageSmoothingEnabled = !this.pixelated;
      this.ctx.drawImage(this.img, col * cellW, row * cellH, cellW, cellH, dx, dy, dw, dh);
    }
  }

  window.SpriteSheetPlayer = SpriteSheetPlayer;
})();
