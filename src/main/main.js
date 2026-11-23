'use strict';

const { app, BrowserWindow, ipcMain, Menu, Tray, screen, nativeImage, shell, dialog } = require('electron');
const { execFile } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const { SettingsStore } = require('../core/settings-store');
const { QuotaAdapter } = require('../core/quota-adapter');
const { TranscriptMonitor } = require('../core/transcript-monitor');
const { SkinManager } = require('../core/skin-manager');
const { PetStateStore } = require('../core/pet-state');
const { WindowTracker } = require('./window-tracker');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const LOG_PATH = path.join(PROJECT_ROOT, 'widget.log');
function writeLog(msg) {
  try {
    fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${msg}\n`, 'utf8');
  } catch {}
}
try {
  fs.writeFileSync(LOG_PATH, `[${new Date().toISOString()}] Widget v2 boot pid=${process.pid} electron=${process.versions.electron}\n`, 'utf8');
} catch {}
process.on('uncaughtException', (err) => writeLog(`uncaughtException: ${err?.stack || err}`));
process.on('unhandledRejection', (err) => writeLog(`unhandledRejection: ${err?.stack || err}`));

const COMPACT_BASE_W = 264;
const COMPACT_BASE_H = 278;
const PANEL_W = 392;
const PANEL_H = 508;
const PANEL_GAP = 10;

const CLI_LURK = process.argv.includes('--lurk');
const CLI_SIDECAR = process.argv.includes('--sidecar');
const STARTUP_VBS_PATH = path.join(
  process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
  'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup',
  'agy-gemini-widget-autostart.vbs'
);

let win = null;
let nebulaWin = null;
let tray = null;
let settingsStore = null;
let quotaAdapter = null;
let monitor = null;
let skinManager = null;
let petStore = null;
let tracker = null;

let isPanelOpen = false;
let isDragging = false;
let dragTimer = null;
let dragOriginCursor = null;
let dragOriginBounds = null;
let userHidden = false;
let lastTargetDipRect = null;
let lastTargetState = null;
let modalDialogOpen = false;
const launchGraceUntil = Date.now() + 7000;

function getCompactSize(scale) {
  const s = Math.max(0.7, Math.min(1.4, Number(scale) || 1.0));
  return {
    width: Math.round(COMPACT_BASE_W * Math.max(0.92, s)),
    height: Math.round(COMPACT_BASE_H * Math.max(0.88, s))
  };
}

function getWindowSize(scale, panelOpen) {
  const c = getCompactSize(scale);
  if (!panelOpen) return c;
  return {
    width: c.width + PANEL_W + PANEL_GAP,
    height: Math.max(c.height, PANEL_H)
  };
}

function getTargetContainerRect() {
  const settings = settingsStore.getAll();
  if (settings.followMode === 'antigravity' && lastTargetDipRect && lastTargetDipRect.width > 200) {
    return lastTargetDipRect;
  }
  const primary = screen.getPrimaryDisplay().workArea;
  if (win && !win.isDestroyed()) {
    try {
      return screen.getDisplayMatching(win.getBounds()).workArea;
    } catch {
      return primary;
    }
  }
  return primary;
}

function computeAnchoredBounds(panelOpen = isPanelOpen) {
  const settings = settingsStore.getAll();
  const size = getWindowSize(settings.scale, panelOpen);
  const compact = getCompactSize(settings.scale);
  const container = getTargetContainerRect();

  let stageX;
  let stageY;

  if (settings.followMode === 'antigravity' && lastTargetDipRect && lastTargetDipRect.width > 200) {
    const off = settings.relativeOffset || { dx: -18, dy: -16 };
    if (settings.dockEdge === 'left') {
      stageX = container.x + Math.max(4, off.dx);
    } else {
      stageX = container.x + container.width - compact.width + off.dx;
    }
    stageY = container.y + container.height - compact.height + off.dy;
  } else {
    const gp = settings.globalPos || {};
    if (typeof gp.x === 'number' && typeof gp.y === 'number') {
      stageX = gp.x;
      stageY = gp.y;
    } else {
      stageX = container.x + container.width - compact.width - 18;
      stageY = container.y + container.height - compact.height - 16;
    }
  }

  stageX = Math.max(container.x - 20, Math.min(container.x + container.width - compact.width + 20, stageX));
  stageY = Math.max(container.y - 20, Math.min(container.y + container.height - compact.height + 20, stageY));

  let winX = stageX;
  let winY = stageY;

  if (panelOpen) {
    const onLeft = settings.dockEdge === 'left';
    winX = onLeft ? stageX : stageX - (size.width - compact.width);
    winY = stageY - (size.height - compact.height);

    const disp = screen.getDisplayNearestPoint({ x: Math.round(stageX), y: Math.round(stageY) }).workArea;
    if (winX < disp.x) winX = disp.x;
    if (winX + size.width > disp.x + disp.width) winX = disp.x + disp.width - size.width;
    if (winY < disp.y) winY = disp.y;
    if (winY + size.height > disp.y + disp.height) winY = disp.y + disp.height - size.height;
  }

  return {
    x: Math.round(winX),
    y: Math.round(winY),
    width: size.width,
    height: size.height
  };
}

function applyWindowBounds(bounds) {
  if (!win || win.isDestroyed()) return;
  const cur = win.getBounds();
  const sizeChanged = Math.abs(cur.width - bounds.width) > 1 || Math.abs(cur.height - bounds.height) > 1;
  const posChanged = Math.abs(cur.x - bounds.x) > 1 || Math.abs(cur.y - bounds.y) > 1;
  if (sizeChanged) {
    win.setBounds(bounds, false);
  } else if (posChanged) {
    win.setPosition(bounds.x, bounds.y, false);
  }
}

function syncWindowPositionAndVisibility() {
  if (!win || win.isDestroyed() || isDragging || modalDialogOpen) return;
  const settings = settingsStore.getAll();

  if (userHidden) {
    if (win.isVisible()) win.hide();
    return;
  }

  if (settings.followMode === 'antigravity') {
    const st = lastTargetState;
    const lurkActive = Boolean(settings.silentLurk || CLI_LURK);
    if (st && st.found) {
      const inGrace = !lurkActive && Date.now() < launchGraceUntil;
      const shouldShow = !st.minimized && (st.foreground || st.widgetForeground || isPanelOpen || inGrace);
      if (shouldShow) {
        const bounds = computeAnchoredBounds(isPanelOpen);
        applyWindowBounds(bounds);
        if (!win.isVisible()) win.showInactive();
        win.setAlwaysOnTop(true, 'screen-saver');
      } else {
        if (win.isVisible()) win.hide();
      }
      return;
    }
    if (lurkActive) {
      if (win.isVisible()) win.hide();
      return;
    }
    const bounds = computeAnchoredBounds(isPanelOpen);
    applyWindowBounds(bounds);
    if (!win.isVisible()) win.showInactive();
    return;
  }

  const bounds = computeAnchoredBounds(isPanelOpen);
  applyWindowBounds(bounds);
  if (!win.isVisible()) win.showInactive();
  win.setAlwaysOnTop(true, 'screen-saver');
}

function broadcastSettings() {
  const s = settingsStore.getAll();
  if (win && !win.isDestroyed()) {
    win.webContents.send('settings:changed', s);
  }
  rebuildTrayMenu();
}

function startWindowDrag() {
  if (!win || win.isDestroyed() || isDragging) return;
  isDragging = true;
  win.setIgnoreMouseEvents(false);
  dragOriginCursor = screen.getCursorScreenPoint();
  dragOriginBounds = win.getBounds();

  dragTimer = setInterval(() => {
    if (!isDragging || !win || win.isDestroyed()) return;
    const cur = screen.getCursorScreenPoint();
    const nx = dragOriginBounds.x + (cur.x - dragOriginCursor.x);
    const ny = dragOriginBounds.y + (cur.y - dragOriginCursor.y);
    win.setPosition(Math.round(nx), Math.round(ny), false);
  }, 16);
}

function endWindowDrag() {
  if (!isDragging) return;
  isDragging = false;
  if (dragTimer) {
    clearInterval(dragTimer);
    dragTimer = null;
  }
  if (!win || win.isDestroyed()) return;

  const settings = settingsStore.getAll();
  const bounds = win.getBounds();
  const compact = getCompactSize(settings.scale);
  const container = getTargetContainerRect();

  const wasLeft = settings.dockEdge === 'left';
  let stageX = isPanelOpen && !wasLeft ? bounds.x + (bounds.width - compact.width) : bounds.x;
  let stageY = isPanelOpen ? bounds.y + (bounds.height - compact.height) : bounds.y;

  const snap = Number(settings.snapThreshold) || 56;
  const pad = 10;
  let snapped = false;

  let newDockEdge = 'right';
  const distLeft = Math.abs(stageX - container.x);
  const distRight = Math.abs((container.x + container.width) - (stageX + compact.width));

  if (distLeft <= snap && distLeft <= distRight) {
    stageX = container.x + pad;
    newDockEdge = 'left';
    snapped = true;
  } else if (distRight <= snap) {
    stageX = container.x + container.width - compact.width - pad;
    newDockEdge = 'right';
    snapped = true;
  } else {
    stageX = Math.max(container.x, Math.min(container.x + container.width - compact.width, stageX));
    const center = stageX + compact.width / 2;
    newDockEdge = center < container.x + container.width / 2 ? 'left' : 'right';
  }

  const distBottom = Math.abs((container.y + container.height) - (stageY + compact.height));
  const distTop = Math.abs(stageY - container.y);
  if (distBottom <= snap) {
    stageY = container.y + container.height - compact.height - pad;
    snapped = true;
  } else if (settings.snapTopEnabled && distTop <= snap) {
    stageY = container.y + pad;
    snapped = true;
  } else {
    stageY = Math.max(container.y, Math.min(container.y + container.height - compact.height, stageY));
  }

  const patch = { dockEdge: newDockEdge };
  if (settings.followMode === 'antigravity' && lastTargetDipRect && lastTargetDipRect.width > 200) {
    const dx =
      newDockEdge === 'left'
        ? Math.round(stageX - container.x)
        : Math.round(stageX - (container.x + container.width - compact.width));
    const dy = Math.round(stageY - (container.y + container.height - compact.height));
    patch.relativeOffset = { dx, dy };
  } else {
    patch.globalPos = { x: Math.round(stageX), y: Math.round(stageY) };
  }

  settingsStore.update(patch);
  broadcastSettings();
  syncWindowPositionAndVisibility();
  if (snapped && win && !win.isDestroyed()) {
    win.webContents.send('window:snapped', { dockEdge: newDockEdge });
  }
}

function isAutoStartEnabled() {
  return fs.existsSync(STARTUP_VBS_PATH);
}

function setAutoStartEnabled(enabled) {
  try {
    if (enabled) {
      fs.mkdirSync(path.dirname(STARTUP_VBS_PATH), { recursive: true });
      const electronExe = path.join(PROJECT_ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
      const vbs = [
        'Set WshShell = CreateObject("WScript.Shell")',
        `WshShell.CurrentDirectory = "${PROJECT_ROOT.replace(/"/g, '""')}"`,
        `WshShell.Run """${electronExe.replace(/"/g, '""')}"" . --lurk", 0, False`,
        ''
      ].join('\r\n');
      fs.writeFileSync(STARTUP_VBS_PATH, vbs, 'utf8');
      settingsStore.update({ silentLurk: true, followMode: 'antigravity' });
      broadcastSettings();
    } else if (fs.existsSync(STARTUP_VBS_PATH)) {
      fs.rmSync(STARTUP_VBS_PATH, { force: true });
    }
    return isAutoStartEnabled();
  } catch (err) {
    writeLog(`setAutoStartEnabled failed: ${err}`);
    return isAutoStartEnabled();
  }
}

function resolveLocalMemoryPython(home) {
  try {
    const mcpCfgPath = path.join(home, '.gemini', 'config', 'plugins', 'local-memory', 'mcp_config.json');
    if (fs.existsSync(mcpCfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(mcpCfgPath, 'utf8'));
      const cmd = cfg && cfg.mcpServers && cfg.mcpServers['local-memory'] && cfg.mcpServers['local-memory'].command;
      if (cmd && (fs.existsSync(cmd) || !path.isAbsolute(cmd))) return cmd;
    }
  } catch {}
  return process.platform === 'win32' ? 'python' : 'python3';
}

function openMemoryNebulaWindow() {
  return new Promise((resolve) => {
    const home = process.env.USERPROFILE || os.homedir();
    const scriptsDir = path.join(home, '.gemini', 'config', 'plugins', 'local-memory', 'scripts');
    const fallbackCandidates = [
      path.join(home, '.gemini', 'antigravity', 'plugin_data', 'local-memory', 'nebula.html'),
      path.join(home, '.gemini', 'config', 'plugins', 'local-memory', 'data', 'nebula.html')
    ];
    const fallbackHtml = fallbackCandidates.find((p) => fs.existsSync(p)) || fallbackCandidates[0];
    const pyBin = resolveLocalMemoryPython(home);

    const showFile = (htmlPath) => {
      if (!htmlPath || !fs.existsSync(htmlPath)) {
        resolve({ ok: false, error: '未找到本地记忆星图文件，请先安装 agy-local-memory 插件' });
        return;
      }
      if (nebulaWin && !nebulaWin.isDestroyed()) {
        nebulaWin.loadFile(htmlPath);
        if (nebulaWin.isMinimized()) nebulaWin.restore();
        nebulaWin.show();
        nebulaWin.focus();
        resolve({ ok: true, path: htmlPath });
        return;
      }
      nebulaWin = new BrowserWindow({
        width: 1120,
        height: 720,
        title: 'Antigravity · 记忆星图 (Local Memory Nebula)',
        backgroundColor: '#020106',
        autoHideMenuBar: true,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false
        }
      });
      nebulaWin.removeMenu();
      nebulaWin.loadFile(htmlPath);
      nebulaWin.on('closed', () => { nebulaWin = null; });
      resolve({ ok: true, path: htmlPath });
    };

    if (!fs.existsSync(path.join(scriptsDir, 'memory_store.py'))) {
      showFile(fallbackHtml);
      return;
    }

    const pyCode = [
      'import sys, json',
      `sys.path.insert(0, ${JSON.stringify(scriptsDir)})`,
      'import memory_store',
      'res = memory_store.generate_nebula()',
      'print(res.get("nebula_path", ""))'
    ].join('; ');

    execFile(pyBin, ['-c', pyCode], { windowsHide: true, timeout: 10000 }, (err, stdout) => {
      const outPath = String(stdout || '').trim().split(/\r?\n/).pop();
      if (!err && outPath && fs.existsSync(outPath)) {
        showFile(outPath);
      } else {
        showFile(fallbackHtml);
      }
    });
  });
}

function buildContextMenuTemplate() {
  const s = settingsStore.getAll();
  const skins = skinManager ? skinManager.listSkins() : [];
  return [
    {
      label: isPanelOpen ? '收起监测面板' : '展开监测面板',
      click: () => {
        isPanelOpen = !isPanelOpen;
        syncWindowPositionAndVisibility();
        if (win && !win.isDestroyed()) {
          win.webContents.send('settings:changed', { ...settingsStore.getAll(), _panelOpen: isPanelOpen });
        }
      }
    },
    {
      label: '打开记忆星图 🌌',
      click: () => openMemoryNebulaWindow()
    },
    {
      label: '快速切换形象',
      submenu: skins.map((sk) => ({
        label: `${sk.name}（${sk.tag}）`,
        type: 'radio',
        checked: s.activeSkinId === sk.id,
        click: () => {
          settingsStore.update({ activeSkinId: sk.id });
          broadcastSettings();
        }
      }))
    },
    { type: 'separator' },
    {
      label: '窗口跟随模式',
      submenu: [
        {
          label: '跟随 Antigravity 窗口（切后台隐身）',
          type: 'radio',
          checked: s.followMode === 'antigravity',
          click: () => {
            settingsStore.update({ followMode: 'antigravity' });
            broadcastSettings();
            syncWindowPositionAndVisibility();
          }
        },
        {
          label: '全局桌面置顶常驻',
          type: 'radio',
          checked: s.followMode === 'global',
          click: () => {
            settingsStore.update({ followMode: 'global' });
            broadcastSettings();
            syncWindowPositionAndVisibility();
          }
        }
      ]
    },
    {
      label: '开启音效',
      type: 'checkbox',
      checked: Boolean(s.sound?.enabled),
      click: (item) => {
        settingsStore.update({ sound: { enabled: item.checked } });
        broadcastSettings();
      }
    },
    {
      label: '显示消耗泡泡',
      type: 'checkbox',
      checked: s.bubbleEnabled,
      click: (item) => {
        settingsStore.update({ bubbleEnabled: item.checked });
        broadcastSettings();
      }
    },
    {
      label: '贴左吸附水平翻转',
      type: 'checkbox',
      checked: s.flipOnLeft,
      click: (item) => {
        settingsStore.update({ flipOnLeft: item.checked });
        broadcastSettings();
      }
    },
    {
      label: '归位右下角',
      click: () => {
        settingsStore.update({
          dockEdge: 'right',
          relativeOffset: { dx: -18, dy: -16 },
          globalPos: { x: null, y: null }
        });
        broadcastSettings();
        syncWindowPositionAndVisibility();
      }
    },
    { type: 'separator' },
    {
      label: userHidden ? '显示挂件' : '暂时隐藏到托盘',
      click: () => {
        userHidden = !userHidden;
        syncWindowPositionAndVisibility();
        rebuildTrayMenu();
      }
    },
    {
      label: '退出挂件',
      click: () => app.quit()
    }
  ];
}

function rebuildTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate(buildContextMenuTemplate()));
}

function createTray() {
  const iconPath = path.join(PROJECT_ROOT, 'assets', 'sprites', 'tray-icon.png');
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 20, height: 20 })
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  tray.setToolTip('Antigravity · Gemini 监测挂件');
  tray.on('click', () => {
    userHidden = !userHidden;
    syncWindowPositionAndVisibility();
    rebuildTrayMenu();
  });
  rebuildTrayMenu();
}

function createWindow() {
  const bounds = computeAnchoredBounds(false);
  win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    title: '',
    frame: false,
    thickFrame: false,
    roundedCorners: false,
    autoHideMenuBar: true,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: true,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: !(CLI_LURK || settingsStore.getAll().silentLurk),
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.removeMenu();
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.webContents.on('did-finish-load', () => {
    writeLog(`Renderer loaded, bounds=${JSON.stringify(win.getBounds())}`);
  });
  win.webContents.on('console-message', (event) => {
    if (event && event.level >= 2) writeLog(`Renderer console[${event.level}]: ${event.message}`);
  });

  win.on('closed', () => {
    win = null;
  });
}

function broadcastPetState() {
  if (win && !win.isDestroyed() && petStore) {
    win.webContents.send('pet:changed', petStore.getSnapshot());
  }
}

function registerIpc() {
  ipcMain.handle('widget:get-initial', () => ({
    settings: settingsStore.getAll(),
    stats: monitor.lastSnapshot || monitor.scan(true),
    skins: skinManager.listSkins(),
    pet: petStore.getSnapshot(),
    autoStart: isAutoStartEnabled(),
    launchedBySidecar: CLI_SIDECAR,
    target: lastTargetState,
    panelOpen: isPanelOpen
  }));

  ipcMain.handle('nebula:open', () => openMemoryNebulaWindow());
  ipcMain.handle('autostart:get', () => isAutoStartEnabled());
  ipcMain.handle('autostart:set', (_, enabled) => setAutoStartEnabled(Boolean(enabled)));

  ipcMain.handle('widget:refresh', () => monitor.scan(false));

  // Affinity & Pet Companion IPC
  ipcMain.handle('pet:get', () => petStore.getSnapshot());
  ipcMain.handle('pet:pat', () => {
    const res = petStore.pat();
    broadcastPetState();
    return res;
  });
  ipcMain.handle('pet:feed', (_, amount) => {
    const res = petStore.feed(amount);
    broadcastPetState();
    return res;
  });
  ipcMain.handle('pet:reward', (_, payload) => {
    const res = petStore.reward(payload?.treats || 0, payload?.affinity || 0, payload || {});
    broadcastPetState();
    return res;
  });
  ipcMain.handle('pet:snake-score', (_, score) => {
    const res = petStore.recordSnakeScore(score);
    broadcastPetState();
    return res;
  });
  ipcMain.handle('pet:nickname', (_, { skinId, name }) => {
    const snap = petStore.setNickname(skinId, name);
    broadcastPetState();
    return snap;
  });

  ipcMain.handle('settings:update', (_, patch) => {
    const next = settingsStore.update(patch);
    broadcastSettings();
    syncWindowPositionAndVisibility();
    return next;
  });

  ipcMain.handle('settings:reset', () => {
    const next = settingsStore.reset();
    broadcastSettings();
    syncWindowPositionAndVisibility();
    return next;
  });

  ipcMain.handle('settings:reset-sound', () => {
    const next = settingsStore.resetSound();
    broadcastSettings();
    return next;
  });

  ipcMain.handle('session:pin', (_, sessionId) => {
    monitor.setPinnedSession(sessionId);
    return monitor.lastSnapshot;
  });

  // Skin Library IPC
  ipcMain.handle('skins:list', () => skinManager.listSkins());

  ipcMain.handle('skins:import', async () => {
    modalDialogOpen = true;
    try {
      const res = await dialog.showOpenDialog(win, {
        title: '选择自定义形象图片（支持 PNG 透明图 / GIF / JPG / SVG）',
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png', 'gif', 'webp', 'svg', 'jpg', 'jpeg'] }]
      });
      if (res.canceled || !res.filePaths[0]) return { canceled: true };
      const newId = skinManager.importCustomSkin(res.filePaths[0]);
      settingsStore.update({ activeSkinId: newId });
      broadcastSettings();
      return { canceled: false, skinId: newId, skins: skinManager.listSkins() };
    } finally {
      modalDialogOpen = false;
      syncWindowPositionAndVisibility();
    }
  });

  ipcMain.handle('skins:import-petdex', async () => {
    modalDialogOpen = true;
    try {
      const res = await dialog.showOpenDialog(win, {
        title: '选择 Petdex / 精灵图皮肤文件夹（含 pet.json 或 spritesheet 图片）',
        properties: ['openDirectory']
      });
      if (res.canceled || !res.filePaths[0]) return { canceled: true };
      const newId = skinManager.importPetdexFolder(res.filePaths[0]);
      settingsStore.update({ activeSkinId: newId });
      broadcastSettings();
      return { canceled: false, skinId: newId, skins: skinManager.listSkins() };
    } finally {
      modalDialogOpen = false;
      syncWindowPositionAndVisibility();
    }
  });

  ipcMain.handle('skins:replace-state', async (_, { skinId, stateName }) => {
    modalDialogOpen = true;
    try {
      const res = await dialog.showOpenDialog(win, {
        title: `替换「${stateName}」状态立绘`,
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png', 'gif', 'webp', 'svg', 'jpg', 'jpeg'] }]
      });
      if (res.canceled || !res.filePaths[0]) return { canceled: true };
      skinManager.replaceSkinState(skinId, stateName, res.filePaths[0]);
      return { canceled: false, skins: skinManager.listSkins() };
    } finally {
      modalDialogOpen = false;
      syncWindowPositionAndVisibility();
    }
  });

  ipcMain.handle('skins:delete', (_, skinId) => {
    const ok = skinManager.deleteCustomSkin(skinId);
    if (ok && settingsStore.getAll().activeSkinId === skinId) {
      settingsStore.update({ activeSkinId: 'catgirl-classic' });
      broadcastSettings();
    }
    return { ok, skins: skinManager.listSkins() };
  });

  // Custom Sound File Import IPC
  ipcMain.handle('sounds:import', async (_, eventKey) => {
    modalDialogOpen = true;
    try {
      const res = await dialog.showOpenDialog(win, {
        title: '选择本地音效文件（MP3 / WAV / OGG / M4A）',
        properties: ['openFile'],
        filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac'] }]
      });
      if (res.canceled || !res.filePaths[0]) return { canceled: true };
      const info = skinManager.importCustomSound(eventKey, res.filePaths[0]);
      const next = settingsStore.update({
        sound: {
          events: {
            [eventKey]: {
              customUrl: info.url,
              customName: info.fileName
            }
          }
        }
      });
      broadcastSettings();
      return { canceled: false, info, settings: next };
    } finally {
      modalDialogOpen = false;
      syncWindowPositionAndVisibility();
    }
  });

  ipcMain.handle('sounds:clear', (_, eventKey) => {
    const next = settingsStore.update({
      sound: {
        events: {
          [eventKey]: {
            customUrl: '',
            customName: ''
          }
        }
      }
    });
    broadcastSettings();
    return next;
  });

  ipcMain.handle('window:set-panel-open', (_, open) => {
    isPanelOpen = Boolean(open);
    syncWindowPositionAndVisibility();
    rebuildTrayMenu();
    return isPanelOpen;
  });

  ipcMain.on('window:ignore-mouse', (_, ignore) => {
    if (!win || win.isDestroyed() || isDragging) return;
    if (ignore) {
      win.setIgnoreMouseEvents(true, { forward: true });
    } else {
      win.setIgnoreMouseEvents(false);
    }
  });

  ipcMain.on('drag:start', () => startWindowDrag());
  ipcMain.on('drag:end', () => endWindowDrag());

  ipcMain.on('menu:context', () => {
    if (!win || win.isDestroyed()) return;
    Menu.buildFromTemplate(buildContextMenuTemplate()).popup({ window: win });
  });

  ipcMain.on('shell:open-brain', () => {
    const home = process.env.USERPROFILE || os.homedir();
    shell.openPath(path.join(home, '.gemini', 'antigravity', 'brain'));
  });
  ipcMain.on('shell:open-skins', () => shell.openPath(skinManager.skinsRoot));
  ipcMain.on('shell:open-sounds', () => shell.openPath(skinManager.soundsCustomDir));

  ipcMain.on('window:hide', () => {
    userHidden = true;
    syncWindowPositionAndVisibility();
    rebuildTrayMenu();
  });

  ipcMain.on('app:quit', () => app.quit());
}

app.on('second-instance', () => {
  userHidden = false;
  syncWindowPositionAndVisibility();
});

app.whenReady().then(() => {
  settingsStore = new SettingsStore();
  skinManager = new SkinManager(PROJECT_ROOT);
  petStore = new PetStateStore();
  quotaAdapter = new QuotaAdapter();
  monitor = new TranscriptMonitor(quotaAdapter, settingsStore);
  tracker = new WindowTracker('Antigravity');

  createWindow();
  createTray();
  registerIpc();

  monitor.on('update', (snapshot) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('stats:update', snapshot);
    }
  });

  monitor.on('turn', (evt) => {
    // Award starlight treats automatically on completed turns (+2 if high cache hit >= 85%, else +1)
    const highCache = (evt.delta?.stepCacheHitPct || 0) >= 85;
    const rewardRes = petStore.reward(highCache ? 2 : 1, highCache ? 2 : 1);
    broadcastPetState();
    if (win && !win.isDestroyed()) {
      win.webContents.send('stats:turn', {
        ...evt,
        treatsEarned: highCache ? 2 : 1,
        leveledUp: rewardRes.leveledUp
      });
    }
  });

  tracker.on('state', (st) => {
    lastTargetState = st;
    if (st.found && !st.minimized && st.width > 200 && st.height > 150) {
      try {
        lastTargetDipRect = screen.screenToDipRect(win, {
          x: st.x,
          y: st.y,
          width: st.width,
          height: st.height
        });
      } catch {
        lastTargetDipRect = { x: st.x, y: st.y, width: st.width, height: st.height };
      }
    }
    syncWindowPositionAndVisibility();
    if (win && !win.isDestroyed()) {
      win.webContents.send('target:changed', st);
    }
  });

  monitor.start();
  tracker.start();
});

app.on('before-quit', () => {
  if (monitor) monitor.stop();
  if (tracker) tracker.stop();
});

app.on('window-all-closed', () => {
  app.quit();
});
