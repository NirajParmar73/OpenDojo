interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default defineNuxtPlugin(() => {
  if (!import.meta.client || !('serviceWorker' in navigator)) return

  // This event can fire before a component's mounted hook. Keep the native
  // browser prompt in app state so the visible Install button can always use it.
  const deferredPrompt = useState<BeforeInstallPromptEvent | null>('pwa-install-prompt', () => null)
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt.value = event as BeforeInstallPromptEvent
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('OpenDojos service worker registration failed.', error)
    })
  })
})
