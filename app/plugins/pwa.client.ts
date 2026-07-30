import { classifyAppHost } from '#shared/utils/app-host'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default defineNuxtPlugin(() => {
  if (!import.meta.client || !('serviceWorker' in navigator)) return
  const runtimeConfig = useRuntimeConfig()
  const appHost = classifyAppHost(window.location.hostname, String(runtimeConfig.public.tenantBaseDomain || ''))
  const isInstallableApp = ['platform', 'staff', 'portal', 'legacy'].includes(appHost.surface)

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
  if (!isInstallableApp) return

  // This event can fire before a component's mounted hook. Keep the native
  // browser prompt in app state so the visible Install button can always use it.
  const deferredPrompt = useState<BeforeInstallPromptEvent | null>('pwa-install-prompt', () => null)
  const updateAvailable = useState<boolean>('pwa-update-available', () => false)
  const updateInstalling = useState<boolean>('pwa-update-installing', () => false)
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt.value = event as BeforeInstallPromptEvent
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      let reloadingForUpdate = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloadingForUpdate) window.location.reload()
      })

      const watchInstallingWorker = () => {
        const worker = registration.installing
        if (!worker) return
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) updateAvailable.value = true
        })
      }
      registration.addEventListener('updatefound', watchInstallingWorker)
      watchInstallingWorker()
      if (registration.waiting && navigator.serviceWorker.controller) updateAvailable.value = true

      const checkForDeployedVersion = async () => {
        try {
          const response = await fetch(`/app-version?time=${Date.now()}`, { cache: 'no-store' })
          const deployed = await response.json() as { version?: string }
          if (deployed.version && deployed.version !== runtimeConfig.public.appVersion) updateAvailable.value = true
        } catch {
          // An offline installed app should continue working without warnings.
        }
      }
      const checkForUpdate = () => {
        void registration.update().catch(() => undefined)
        void checkForDeployedVersion()
      }

      window.addEventListener('opendojos:apply-update', async () => {
        updateInstalling.value = true
        await registration.update().catch(() => undefined)
        if (registration.waiting) {
          reloadingForUpdate = true
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
          // Reload even if a browser fails to dispatch controllerchange.
          window.setTimeout(() => window.location.reload(), 5000)
          return
        }
        window.location.reload()
      })

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
