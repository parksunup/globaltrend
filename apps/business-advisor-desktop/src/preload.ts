import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('advisor', {
  status: () => ipcRenderer.invoke('chatgpt:status'),
  connect: () => ipcRenderer.invoke('chatgpt:connect'),
  disconnect: () => ipcRenderer.invoke('chatgpt:disconnect'),
  ask: (question: string, jurisdictions: string[]) => ipcRenderer.invoke('chatgpt:ask', question, jurisdictions),
  openSource: (url: string) => ipcRenderer.invoke('source:open', url),
})
