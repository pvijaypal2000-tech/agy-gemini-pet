'use strict';

const EventEmitter = require('events');
const { spawn } = require('child_process');
const path = require('path');

class WindowTracker extends EventEmitter {
  constructor(targetProcess = 'Antigravity') {
    super();
    this.targetProcess = targetProcess;
    this.proc = null;
    this.lastState = {
      found: false,
      minimized: false,
      foreground: false,
      widgetForeground: false,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      pid: 0
    };
    this.buffer = '';
    this.stopped = false;
  }

  start() {
    if (process.platform !== 'win32' || this.proc) return;
    this.stopped = false;
    const scriptPath = path.resolve(__dirname, '..', '..', 'scripts', 'win-tracker.ps1');
    this.proc = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-WindowStyle', 'Hidden',
        '-ExecutionPolicy', 'Bypass',
        '-File', scriptPath,
        '-WidgetPid', String(process.pid),
        '-TargetProcess', this.targetProcess,
        '-IntervalMs', '180'
      ],
      {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore']
      }
    );

    this.proc.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString('utf8');
      let nl;
      while ((nl = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, nl).trim();
        this.buffer = this.buffer.slice(nl + 1);
        if (!line.startsWith('{')) continue;
        try {
          const parsed = JSON.parse(line);
          this.lastState = parsed;
          this.emit('state', parsed);
        } catch {
          // Ignore malformed output
        }
      }
    });

    this.proc.on('exit', () => {
      this.proc = null;
      if (!this.stopped) {
        setTimeout(() => this.start(), 3000);
      }
    });

    this.proc.on('error', () => {
      this.proc = null;
    });
  }

  getLastState() {
    return this.lastState;
  }

  stop() {
    this.stopped = true;
    if (this.proc) {
      try {
        this.proc.kill();
      } catch {}
      this.proc = null;
    }
  }
}

module.exports = { WindowTracker };
