// Increment this whenever the offline page, manifest, or PWA icons change.
const CACHE_NAME = 'opendojos-static-v13'
const OFFLINE_URL = '/offline.html'
const STATIC_ASSETS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/platform/manifest.webmanifest',
  '/portal/manifest.webmanifest',
  '/admin-pwa-icon-180.png',
  '/admin-pwa-icon-192.png',
  '/admin-pwa-icon-512.png',
  '/admin-pwa-icon-maskable-512.png',
  '/platform-pwa-icon-180.png',
  '/platform-pwa-icon-192.png',
  '/platform-pwa-icon-512.png',
  '/platform-pwa-icon-maskable-512.png',
  '/student-pwa-icon-180.png',
  '/student-pwa-icon-192.png',
  '/student-pwa-icon-512.png',
  '/student-pwa-icon-maskable-512.png'
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)))
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('opendojos-') && key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Never cache authenticated API responses or user-uploaded content. This
  // prevents data from one signed-in session being available offline later.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
    return
  }

  const isPwaAsset = STATIC_ASSETS.includes(url.pathname)
  if (!isPwaAsset) return

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
      }
      return response
    }))
  )
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data?.json() || {}
  } catch {
    payload = { body: event.data?.text() || 'You have a new student portal notification.' }
  }

  const title = typeof payload.title === 'string' ? payload.title : 'OpenDojos Student'
  const body = typeof payload.body === 'string' ? payload.body : 'You have a new notification.'
  const url = typeof payload.url === 'string' && payload.url.startsWith('/portal') ? payload.url : '/portal'
  const tag = typeof payload.tag === 'string' ? payload.tag : 'student-notification'
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    renotify: true,
    silent: false,
    icon: '/student-pwa-icon-192.png',
    badge: '/student-pwa-icon-192.png',
    vibrate: [220, 90, 220],
    data: { url },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const rawUrl = event.notification.data?.url || '/portal'
  const target = new URL(rawUrl, self.location.origin)
  if (target.origin !== self.location.origin || !target.pathname.startsWith('/portal')) target.pathname = '/portal'

  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
    const portalClient = windowClients.find(client => {
      const clientUrl = new URL(client.url)
      return clientUrl.origin === target.origin && clientUrl.pathname.startsWith('/portal')
    })
    if (portalClient) {
      await portalClient.navigate(target.href)
      return portalClient.focus()
    }
    return self.clients.openWindow(target.href)
  }))
})
