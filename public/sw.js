const CACHE_NAME = 'opendojos-static-v2'
const OFFLINE_URL = '/offline.html'
const STATIC_ASSETS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png'
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)))
  self.skipWaiting()
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

  const isBuildAsset = url.pathname.startsWith('/_nuxt/')
  const isPwaAsset = STATIC_ASSETS.includes(url.pathname)
  if (!isBuildAsset && !isPwaAsset) return

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
