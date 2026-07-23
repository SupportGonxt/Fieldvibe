/* Web Push handlers, imported into the workbox-generated service worker.
 * Call payload (from backend ringCallee): { type: 'incoming_call', callId, callerName }.
 * Generic payload (e.g. KPI nudge): { title, body, url? }. */

// Poisoned-cache purge. Before the cacheWillUpdate guard shipped (2026-07-16),
// the Pages SPA fallback answered a missing chunk URL with index.html + 200 and
// CacheFirst pinned that HTML under the .js URL. The guard blocks NEW poisoning
// but never evicts existing entries — CacheFirst reads don't revalidate — and a
// device whose EAGER chunk is poisoned runs no page JS at all, so only the SW
// can heal it. This file is cache-busted per deploy (?v=BUILD_ID), so every
// deploy installs a new SW and re-runs this sweep on activate.
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of ['static-assets-cache', 'image-cache']) {
      try {
        const cache = await caches.open(name);
        for (const req of await cache.keys()) {
          const res = await cache.match(req);
          const ct = (res && res.headers.get('content-type')) || '';
          if (ct.includes('text/html')) await cache.delete(req);
        }
      } catch (_) { /* best-effort; never block activation */ }
    }
  })());
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { /* non-JSON push */ }

  // Flag the home-screen icon while backgrounded. Use the exact count if the sender
  // supplied one, else a dot (setAppBadge() no-arg). The open PWA's NotificationCenter
  // reconciles the precise number on next foreground poll.
  if (self.navigator && self.navigator.setAppBadge) {
    const n = Number(data.badgeCount);
    self.navigator.setAppBadge(Number.isFinite(n) && n > 0 ? n : undefined).catch(() => {});
  }

  if (data.type === 'incoming_call' && data.callId) {
    const title = data.callerName || 'Back office';
    event.waitUntil((async () => {
      // Ring any open app window right away — the in-app full-screen ring must
      // not wait for a notification click.
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of wins) {
        w.postMessage({ type: 'incoming_call', callId: data.callId, callerName: title });
      }
      await self.registration.showNotification(title, {
        body: 'Incoming call',
        tag: 'call-' + data.callId, // collapse repeat rings for the same call
        requireInteraction: true,   // keep ringing until the agent acts
        renotify: true,
        vibrate: [400, 200, 400, 200, 400],
        data: { callId: data.callId, callerName: title },
        actions: [
          { action: 'answer', title: 'Answer' },
          { action: 'decline', title: 'Decline' },
        ],
      });
    })());
    return;
  }

  // Ring cancelled (caller gave up, or answered/declined on another device):
  // take down the ringing notification everywhere; a genuine miss leaves a
  // "Missed call" note in its place (same tag, so it replaces the ring).
  if (data.type === 'call_cancelled' && data.callId) {
    event.waitUntil((async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of wins) {
        w.postMessage({ type: 'call_cancelled', callId: data.callId });
      }
      const ns = await self.registration.getNotifications({ tag: 'call-' + data.callId });
      for (const n of ns) n.close();
      if (data.outcome === 'missed') {
        await self.registration.showNotification(data.callerName || 'Back office', {
          body: 'Missed call',
          tag: 'call-' + data.callId,
          data: { url: '/agent/dashboard' },
        });
      }
    })());
    return;
  }

  if (data.title) {
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body || '',
        tag: data.tag || 'fieldvibe-generic',
        data: { url: data.url || '/' },
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { callId, callerName, url } = event.notification.data || {};

  if (!callId) {
    // Generic notification: send an open window to the target URL, else open one there
    const target = url || '/';
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const c of clients) {
          if ('navigate' in c) return c.navigate(target).then((nc) => (nc || c).focus());
          if ('focus' in c) return c.focus();
        }
        return self.clients.openWindow(target);
      })
    );
    return;
  }
  if (event.action === 'decline') return;

  const target = '/agent/call/incoming?callId=' + encodeURIComponent(callId) +
    '&callerName=' + encodeURIComponent(callerName || '');
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an open PWA window and route it to the call; else open one.
      for (const c of clients) {
        if ('focus' in c) {
          c.postMessage({ type: 'incoming_call', callId, callerName });
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
