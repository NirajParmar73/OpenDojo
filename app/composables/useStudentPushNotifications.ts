type PushPermission = NotificationPermission | 'unsupported'

function applicationServerKey(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const bytes = atob(base64)
  return Uint8Array.from(bytes, character => character.charCodeAt(0))
}

export function useStudentPushNotifications() {
  const config = useRuntimeConfig()
  const supported = useState('student-push-supported', () => false)
  const enabled = useState('student-push-enabled', () => false)
  const permission = useState<PushPermission>('student-push-permission', () => 'unsupported')
  const busy = useState('student-push-busy', () => false)
  const error = useState('student-push-error', () => '')

  async function saveSubscription(subscription: PushSubscription) {
    const serialized = subscription.toJSON()
    if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) {
      throw new Error('The browser returned an incomplete push subscription.')
    }
    await $fetch('/api/portal/push-subscriptions', {
      method: 'POST',
      body: { endpoint: serialized.endpoint, keys: serialized.keys },
    })
  }

  async function initialize() {
    if (!import.meta.client) return
    const publicKey = String(config.public.webPushPublicKey || '')
    supported.value = !import.meta.dev
      && Boolean(publicKey)
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window
    permission.value = 'Notification' in window ? Notification.permission : 'unsupported'
    if (!supported.value) return

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      enabled.value = permission.value === 'granted' && Boolean(subscription)
      if (subscription && permission.value === 'granted') await saveSubscription(subscription)
    } catch (cause) {
      console.warn('Could not initialize student push notifications.', cause)
      error.value = 'Device notifications could not be initialized.'
    }
  }

  async function enable() {
    if (!supported.value || busy.value) return false
    busy.value = true
    error.value = ''
    try {
      permission.value = await Notification.requestPermission()
      if (permission.value !== 'granted') {
        enabled.value = false
        error.value = permission.value === 'denied'
          ? 'Notifications are blocked in this browser’s settings.'
          : 'Notification permission was not granted.'
        return false
      }
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(String(config.public.webPushPublicKey || '')),
      })
      await saveSubscription(subscription)
      enabled.value = true
      return true
    } catch (cause) {
      console.warn('Could not enable student push notifications.', cause)
      error.value = 'Could not enable device notifications. On iPhone or iPad, install the Student app first.'
      enabled.value = false
      return false
    } finally {
      busy.value = false
    }
  }

  async function disable() {
    if (!import.meta.client || busy.value || !('serviceWorker' in navigator)) return
    busy.value = true
    error.value = ''
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration) {
        enabled.value = false
        return
      }
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await $fetch('/api/portal/push-subscriptions', {
          method: 'DELETE',
          body: { endpoint: subscription.endpoint },
        }).catch(() => undefined)
        await subscription.unsubscribe()
      }
      enabled.value = false
    } catch (cause) {
      console.warn('Could not disable student push notifications.', cause)
      error.value = 'Could not disable device notifications.'
    } finally {
      busy.value = false
    }
  }

  async function toggle() {
    if (enabled.value) await disable()
    else await enable()
  }

  return { supported, enabled, permission, busy, error, initialize, enable, disable, toggle }
}
