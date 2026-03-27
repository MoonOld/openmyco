/**
 * Electron API exposed via contextBridge
 */
export interface ElectronAPI {
  platform: NodeJS.Platform
  onSaveData: (callback: () => void) => void
  removeListener: (channel: string) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
