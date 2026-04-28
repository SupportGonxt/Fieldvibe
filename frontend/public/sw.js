// Service worker kill-switch.
//
// This file replaces the previous /sw.js (which had been a legacy "salessync-v1"
// cache-first SW for some time, then briefly a workbox SW from vite-plugin-pwa).
// Both were causing field-ops login failures. Until the PWA is re-enabled with
// a properly debugged config, this no-op SW takes ownership of /sw.js, deletes
// every cache it ever owned, unregisters itself, and reloads any open clients
// so they go back to a no-SW network-only experience.
//
// Browsers that already have the previous SW installed will pick this up on
// their next page load (browsers re-check sw.js when the byte-content differs).
//
// To re-enable PWA later: replace this file with workbox output (or delete it
// and re-add VitePWA in vite.config.ts), then bump CACHE_VERSION below.

const KILL_SWITCH_VERSION = '2026-04-28-1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      // Wipe every cache this origin owns, including any prior workbox or
      // salessync-v1 caches. Without this, stale cached responses (notably
      // login responses or the cached app shell pointing at deleted chunks)
      // can keep breaking auth even after the SW unregisters.
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) { /* best-effort */ }

    try {
      await self.registration.unregister();
    } catch (e) { /* best-effort */ }

    try {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of clients) {
        try { c.navigate(c.url); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* best-effort */ }
  })());
});

// While this SW is briefly active (between install and unregister completing),
// always pass through to network. Never serve from cache.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// Tag for debugging.
self.KILL_SWITCH_VERSION = KILL_SWITCH_VERSION;