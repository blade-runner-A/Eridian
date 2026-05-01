const { contextBridge, ipcRenderer } = require('electron')

const storage = {
  loadScene: (id = 'default') => ipcRenderer.invoke('eridian:scene:get', id),
  saveScene: (id = 'default', data) => ipcRenderer.invoke('eridian:scene:save', id, data),
}

contextBridge.exposeInMainWorld('eridianDesktop', {
  platform: process.platform,
})

contextBridge.exposeInMainWorld('eridianAI', {
  chat: (messages) => ipcRenderer.invoke('eridian:ai:chat', messages),
})

contextBridge.exposeInMainWorld('eridianExternal', {
  onToolCall: (callback) => ipcRenderer.on('eridian:ext:tool-call', (_event, data) => callback(data)),
  sendToolResult: (id, result) => ipcRenderer.send('eridian:ext:tool-result', id, result),
})

contextBridge.exposeInMainWorld('eridianStorage', storage)
contextBridge.exposeInMainWorld('spectralboardStorage', storage)
