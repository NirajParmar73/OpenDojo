interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default defineNuxtPlugin(() => {
  if (!import.meta.client || !('serviceWorker' in navigator)) return

  if (import.meta.dev) {
    // A development service worker can keep serving old Nuxt modules after a
    // source edit. Remove only OpenDojos registrations and caches on localhost;
    // PWA installation should be tested with the production preview instead.
    window.addEventListener('load', async () => {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(registration => registration.unregister()))
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.filter(name => name.startsWith('opendojos-')).map(name => caches.delete(name)))
      }
    })
    return
  }

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
      let hadController = Boolean(navigator.serviceWorker.controller)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // The worker activates immediately, but the open page still contains
        // the previous JavaScript until the user accepts the refresh prompt.
        if (hadController) updateAvailable.value = true
        hadController = true
      })

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

      const checkForUpdate = () => registration.update().catch(() => undefined)
      // Check at launch, whenever the installed app returns to the foreground,
      // and periodically while it remains open. Browser update throttling still
      // applies, so these calls are inexpensive.
      checkForUpdate()
      window.addEventListener('focus', checkForUpdate)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
      window.setInterval(checkForUpdate, 30 * 60 * 1000)
    }).catch((error) => {
      console.warn('OpenDojos service worker registration failed.', error)
    })
  })
})
