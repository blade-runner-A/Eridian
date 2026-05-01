export {}

declare global {
  interface EridianStorageBridge {
    loadScene: (id?: string) => Promise<string | null>
    saveScene: (id: string | undefined, data: string) => Promise<boolean>
  }

  interface Window {
    eridianDesktop?: {
      platform: string
    }
    eridianStorage?: EridianStorageBridge
    spectralboardStorage?: EridianStorageBridge
  }
}
