'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('geminiWidget', {
  getInitialState: () => ipcRenderer.invoke('widget:get-initial'),
  refreshData: () => ipcRenderer.invoke('widget:refresh'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),
  resetSound: () => ipcRenderer.invoke('settings:reset-sound'),
  pinSession: (sessionId) => ipcRenderer.invoke('session:pin', sessionId),

  // Affinity & Pet Companion APIs
  getPetState: () => ipcRenderer.invoke('pet:get'),
  patPet: () => ipcRenderer.invoke('pet:pat'),
  feedPet: (amount) => ipcRenderer.invoke('pet:feed', amount),
  rewardPet: (payload) => ipcRenderer.invoke('pet:reward', payload),
  recordSnakeScore: (score) => ipcRenderer.invoke('pet:snake-score', score),
  setPetNickname: (skinId, name) => ipcRenderer.invoke('pet:nickname', { skinId, name }),

  // Skin Library & Petdex/Spritesheet APIs
  listSkins: () => ipcRenderer.invoke('skins:list'),
  importSkin: () => ipcRenderer.invoke('skins:import'),
  importPetdexFolder: () => ipcRenderer.invoke('skins:import-petdex'),
  replaceSkinState: (skinId, stateName) => ipcRenderer.invoke('skins:replace-state', { skinId, stateName }),
  deleteSkin: (skinId) => ipcRenderer.invoke('skins:delete', skinId),
  openSkinsFolder: () => ipcRenderer.send('shell:open-skins'),

  // Custom Sound File Import APIs
  importSoundForEvent: (eventKey) => ipcRenderer.invoke('sounds:import', eventKey),
  clearSoundForEvent: (eventKey) => ipcRenderer.invoke('sounds:clear', eventKey),
  openSoundsFolder: () => ipcRenderer.send('shell:open-sounds'),

  // Window & Shell APIs
  setIgnoreMouse: (ignore) => ipcRenderer.send('window:ignore-mouse', Boolean(ignore)),
  setPanelOpen: (open) => ipcRenderer.invoke('window:set-panel-open', Boolean(open)),
  startDrag: () => ipcRenderer.send('drag:start'),
  endDrag: () => ipcRenderer.send('drag:end'),
  openContextMenu: () => ipcRenderer.send('menu:context'),
  openBrainFolder: () => ipcRenderer.send('shell:open-brain'),
  openNebula: () => ipcRenderer.invoke('nebula:open'),
  getAutoStart: () => ipcRenderer.invoke('autostart:get'),
  setAutoStart: (enabled) => ipcRenderer.invoke('autostart:set', Boolean(enabled)),
  hideToTray: () => ipcRenderer.send('window:hide'),
  quitApp: () => ipcRenderer.send('app:quit'),

  // Events
  onStatsUpdate: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('stats:update', handler);
    return () => ipcRenderer.removeListener('stats:update', handler);
  },
  onTurnEvent: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('stats:turn', handler);
    return () => ipcRenderer.removeListener('stats:turn', handler);
  },
  onPetStateChanged: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('pet:changed', handler);
    return () => ipcRenderer.removeListener('pet:changed', handler);
  },
  onSettingsChanged: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('settings:changed', handler);
    return () => ipcRenderer.removeListener('settings:changed', handler);
  },
  onTargetChanged: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('target:changed', handler);
    return () => ipcRenderer.removeListener('target:changed', handler);
  },
  onSnapped: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('window:snapped', handler);
    return () => ipcRenderer.removeListener('window:snapped', handler);
  }
});
