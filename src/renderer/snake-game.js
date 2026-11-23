'use strict';

(() => {
  const COLS = 16;
  const ROWS = 10;
  const CELL = 21;

  class StarSnakeGame {
    constructor(canvas, callbacks = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.canvas.width = COLS * CELL;
      this.canvas.height = ROWS * CELL;
      this.onScoreChange = callbacks.onScoreChange || (() => {});
      this.onGameOver = callbacks.onGameOver || (() => {});
      this.onEat = callbacks.onEat || (() => {});
      this.onStateChange = callbacks.onStateChange || (() => {});

      this.state = 'idle'; // 'idle' | 'countdown' | 'running' | 'paused' | 'over'
      this.snake = [];
      this.dir = { x: 1, y: 0 };
      this.nextDir = { x: 1, y: 0 };
      this.food = { x: 10, y: 5 };
      this.score = 0;
      this.countdownNum = 0;
      this.tickTimer = null;
      this.countdownTimer = null;
      this.accentColors = ['#60a5fa', '#a78bfa'];

      this._resetBoard();
      this.render();
    }

    setAccentColors(colors) {
      if (Array.isArray(colors) && colors.length >= 2) {
        this.accentColors = colors;
        this.render();
      }
    }

    _resetBoard() {
      this.snake = [
        { x: 6, y: 5 },
        { x: 5, y: 5 },
        { x: 4, y: 5 }
      ];
      this.dir = { x: 1, y: 0 };
      this.nextDir = { x: 1, y: 0 };
      this.score = 0;
      this._spawnFood();
      this.onScoreChange(0);
    }

    _spawnFood() {
      const occupied = new Set(this.snake.map((p) => `${p.x},${p.y}`));
      const inner = [];
      const outer = [];
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (occupied.has(`${x},${y}`)) continue;
          const isInner = x >= 2 && x <= COLS - 3 && y >= 1 && y <= ROWS - 2;
          if (isInner) inner.push({ x, y });
          else outer.push({ x, y });
        }
      }
      const pool = this.score < 10 && inner.length > 0 ? inner : inner.concat(outer);
      if (pool.length === 0) return;
      this.food = pool[Math.floor(Math.random() * pool.length)];
    }

    startNew() {
      this._clearTimers();
      this._resetBoard();
      this.state = 'countdown';
      this.countdownNum = 3;
      this.onStateChange(this.state);
      this.render();

      this.countdownTimer = setInterval(() => {
        this.countdownNum -= 1;
        if (this.countdownNum <= 0) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
          this.state = 'running';
          this.onStateChange(this.state);
          this._scheduleTick();
        }
        this.render();
      }, 650);
    }

    togglePause() {
      if (this.state === 'running') {
        this._clearTimers();
        this.state = 'paused';
        this.onStateChange(this.state);
        this.render();
      } else if (this.state === 'paused') {
        this.state = 'running';
        this.onStateChange(this.state);
        this._scheduleTick();
        this.render();
      } else if (this.state === 'idle' || this.state === 'over') {
        this.startNew();
      }
    }

    pauseIfRunning() {
      if (this.state === 'running') {
        this._clearTimers();
        this.state = 'paused';
        this.onStateChange(this.state);
        this.render();
      }
    }

    setDirection(dx, dy) {
      if (this.state === 'idle' || this.state === 'over') {
        this.startNew();
        return;
      }
      if (this.state !== 'running') return;
      if (dx === -this.dir.x && dy === -this.dir.y) return;
      this.nextDir = { x: dx, y: dy };
    }

    _clearTimers() {
      if (this.tickTimer) {
        clearTimeout(this.tickTimer);
        this.tickTimer = null;
      }
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
      }
    }

    _scheduleTick() {
      if (this.state !== 'running') return;
      const delay = Math.max(105, 215 - this.score * 4);
      this.tickTimer = setTimeout(() => {
        this._step();
        this._scheduleTick();
      }, delay);
    }

    _step() {
      this.dir = this.nextDir;
      const head = this.snake[0];
      const next = { x: head.x + this.dir.x, y: head.y + this.dir.y };

      const hitWall = next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS;
      const hitSelf = this.snake.some((seg, idx) => idx < this.snake.length - 1 && seg.x === next.x && seg.y === next.y);

      if (hitWall || hitSelf) {
        this._clearTimers();
        this.state = 'over';
        this.onStateChange(this.state);
        this.render();
        this.onGameOver(this.score);
        return;
      }

      this.snake.unshift(next);
      if (next.x === this.food.x && next.y === this.food.y) {
        this.score += 1;
        this.onScoreChange(this.score);
        this.onEat(this.score);
        this._spawnFood();
      } else {
        this.snake.pop();
      }
      this.render();
    }

    _drawStar(cx, cy, r, color) {
      const ctx = this.ctx;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const rad = i % 2 === 0 ? r : r * 0.36;
        const a = (i * Math.PI) / 4;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    render() {
      const ctx = this.ctx;
      const W = this.canvas.width;
      const H = this.canvas.height;

      // Starlight dark board
      ctx.fillStyle = '#0d1126';
      ctx.fillRect(0, 0, W, H);

      // Subtle grid lines
      ctx.strokeStyle = 'rgba(139, 155, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 1; x < COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * CELL + 0.5, 0);
        ctx.lineTo(x * CELL + 0.5, H);
        ctx.stroke();
      }
      for (let y = 1; y < ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL + 0.5);
        ctx.lineTo(W, y * CELL + 0.5);
        ctx.stroke();
      }

      // Draw glowing four-pointed star food
      this._drawStar(this.food.x * CELL + CELL / 2, this.food.y * CELL + CELL / 2, 8.5, '#fde047');

      // Draw stardust snake body & cat-head
      const [c1, c2] = this.accentColors;
      for (let i = this.snake.length - 1; i >= 0; i--) {
        const seg = this.snake[i];
        const px = seg.x * CELL + 2;
        const py = seg.y * CELL + 2;
        const sz = CELL - 4;
        const t = i / Math.max(1, this.snake.length - 1);

        ctx.save();
        ctx.fillStyle = i === 0 ? c2 : i % 2 === 0 ? c1 : '#c084fc';
        ctx.globalAlpha = Math.max(0.45, 1 - t * 0.45);
        ctx.beginPath();
        ctx.roundRect(px, py, sz, sz, i === 0 ? 6 : 5);
        ctx.fill();

        if (i === 0) {
          // Cute tiny heterochromatic eyes on the snake head!
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(px + 5.5, py + 7, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f472b6';
          ctx.beginPath();
          ctx.arc(px + sz - 5.5, py + 7, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Overlay messages
      if (this.state !== 'running') {
        ctx.fillStyle = 'rgba(10, 13, 30, 0.62)';
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (this.state === 'countdown') {
          ctx.fillStyle = '#fde047';
          ctx.font = '700 36px "Segoe UI", sans-serif';
          ctx.fillText(String(this.countdownNum), W / 2, H / 2);
        } else if (this.state === 'paused') {
          ctx.fillStyle = '#eef2ff';
          ctx.font = '700 16px "Segoe UI", sans-serif';
          ctx.fillText('已暂停 · 按 Space 继续', W / 2, H / 2);
        } else if (this.state === 'over') {
          ctx.fillStyle = '#fda4af';
          ctx.font = '700 17px "Segoe UI", sans-serif';
          ctx.fillText(`本局吃到 ${this.score} 颗星 ✦`, W / 2, H / 2 - 12);
          ctx.fillStyle = '#c4b5fd';
          ctx.font = '500 11.5px "Segoe UI", sans-serif';
          ctx.fillText('点「开始」或按 Space 再来一局', W / 2, H / 2 + 14);
        } else {
          ctx.fillStyle = '#eef2ff';
          ctx.font = '700 14px "Segoe UI", sans-serif';
          ctx.fillText('✦ 星喵贪吃蛇 ✦', W / 2, H / 2 - 12);
          ctx.fillStyle = '#9aa7c7';
          ctx.font = '500 11px "Segoe UI", sans-serif';
          ctx.fillText('方向键 / WASD 控制 · 满 10 分掉星糖', W / 2, H / 2 + 12);
        }
      }
    }
  }

  window.StarSnakeGame = StarSnakeGame;
})();
