const CACHE_NAME = 'fieldvibe-v2'
const STATIC_CACHE = 'fieldvibe-static-v2'

// Only cache the app shell and static assets — NEVER cache API responses
const APP_SHELL_URLS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
]

// Install: pre-cache app shell only
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting()) // Activate immediately
  )
})

// Activate: clean up old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim()) // Take control of all pages immediately
  )
})

// Fetch: network-first for everything, cache-first only for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // NEVER intercept API calls — let them go straight to network
  if (url.pathname.startsWith('/api') || url.hostname !== self.location.hostname) {
    return // Don't call event.respondWith — browser handles natively (fastest path)
  }

  // For JS/CSS/image assets: cache-first (they have content hashes in filenames)
  if (event.request.destination === 'script' ||
      event.request.destination === 'style' ||
      event.request.destination === 'image' ||
      event.request.destination === 'font' ||
      url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone))
          }
          return response
        }).catch(() => cached || new Response('', { status: 503 }))
      })
    )
    return
  }

  // For navigation (HTML pages): network-first, fall back to cached app shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('/', clone))
          return response
        })
        .catch(() => caches.match('/').then((cached) => cached || caches.match('/offline')))
    )
    return
  }
})

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync())
  }
})

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification from FieldVibe',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Details',
        icon: '/icon-192x192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icon-192x192.png'
      }
    ]
  }

  event.waitUntil(
    self.registration.showNotification('SalesSync', options)
  )
})

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/agent/dashboard')
    )
  }
})

// Skip waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Background sync function
async function doBackgroundSync() {
  try {
    // Get pending operations from IndexedDB or localStorage
    const pendingOperations = JSON.parse(localStorage.getItem('offline_operations') || '[]')
    
    for (const operation of pendingOperations) {
      try {
        // Attempt to sync each operation
        await fetch('/api/' + operation.entity, {
          method: operation.type === 'create' ? 'POST' : operation.type === 'update' ? 'PUT' : 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(operation.data)
        })
        
        // Remove successful operation
        const updatedOperations = pendingOperations.filter(op => op.id !== operation.id)
        localStorage.setItem('offline_operations', JSON.stringify(updatedOperations))
      } catch (error) {
        console.error('Failed to sync operation:', operation.id, error)
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error)
  }
}
