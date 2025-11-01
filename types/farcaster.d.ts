declare global {
  interface Window {
    frame?: {
      sdk: {
        actions: {
          ready: () => Promise<void>
        }
      }
    }
  }
}

export {}
