const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('captureHelper', {
  getState: () => ipcRenderer.invoke('state:get'),
  beginLogin: () => ipcRenderer.invoke('auth:begin'),
  finishLogin: deviceCode => ipcRenderer.invoke('auth:finish', deviceCode),
  openPluginFolder: () => ipcRenderer.invoke('plugin:open-folder'),
  openTaskFolder: () => ipcRenderer.invoke('drive:open-folder'),
  retry: () => ipcRenderer.invoke('uploader:retry'),
  quit: () => ipcRenderer.invoke('app:quit'),
  onState: listener => ipcRenderer.on('state:changed', (_event, state) => listener(state))
});
