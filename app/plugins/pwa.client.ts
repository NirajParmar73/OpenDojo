interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default defineNuxtPlugin(() => {
  if (!import.meta.client || !('serviceWorker' in navigator)) return

  // This event can fire before a component's mounted hook. Keep the native
  // browser prompt in app state so the visible Install button can always use it.
  const deferredPrompt = useState<BeforeInstallPromptEvent | null>('pwa-install-prompt', () => null)
  const updateAvailable = useState<boolean>('pwa-update-available', () => false)
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt.value = event as BeforeInstallPromptEvent
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // `skipWaiting` activates a new worker immediately. If this browser was
      // already controlled, the installed worker represents a newer app shell.
      const watchInstallingWorker = () => {
        const worker = registration.installing
        if (!worker) return
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) updateAvailable.value = true
        })
      }
      registration.addEventListener('updatefound', watchInstallingWorker)
      watchInstallingWorker()
      // Ask the browser to check on every app launch instead of waiting for its
      // periodic service-worker update interval.
      registration.update().catch(() => undefined)
    }).catch((error) => {
      console.warn('OpenDojos service worker registration failed.', error)
    })
  })
})
