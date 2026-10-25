const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('sanctum', {
  chooseFolder: () => ipcRenderer.invoke('folder:choose'),
  scanFolder: folder => ipcRenderer.invoke('folder:scan', folder),
  organize: payload => ipcRenderer.invoke('files:organize', payload),
  getHistory: () => ipcRenderer.invoke('history:get'),
  undo: id => ipcRenderer.invoke('history:undo', id),
  findDuplicates: folder => ipcRenderer.invoke('duplicates:find', folder),
  startAuto: folder => ipcRenderer.invoke('watcher:start', folder),
  stopAuto: () => ipcRenderer.invoke('watcher:stop'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveRules: rules => ipcRenderer.invoke('rules:save', rules),
  onProgress: callback => { const listener = (_event, data) => callback(data); ipcRenderer.on('operation:progress', listener); return () => ipcRenderer.removeListener('operation:progress', listener); }
});
