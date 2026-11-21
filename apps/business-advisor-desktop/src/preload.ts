import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('advisor', {
  status: () => ipcRenderer.invoke('chatgpt:status'),
  connect: () => ipcRenderer.invoke('chatgpt:connect'),
  disconnect: () => ipcRenderer.invoke('chatgpt:disconnect'),
  models: () => ipcRenderer.invoke('chatgpt:models'),
  ask: (question: string, history: { role: 'user' | 'assistant'; content: string }[], model: string, assessmentContext = '') => ipcRenderer.invoke('chatgpt:ask', question, history, model, assessmentContext),
  takeAssessment: () => ipcRenderer.invoke('assessment:take'),
  onAssessmentHandoff: (callback: () => void) => ipcRenderer.on('assessment:handoff-ready', callback),
  openSource: (url: string) => ipcRenderer.invoke('source:open', url),
})
