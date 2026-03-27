const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Example: you can add IPC communication here later
  platform: process.platform,

  // Example methods for future use
  onSaveData: (callback) => ipcRenderer.on('save-data', callback),
  removeListener: (channel) => ipcRenderer.removeAllListeners(channel),
})
