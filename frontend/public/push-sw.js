/* Web Push handlers, imported into the workbox-generated service worker.
 * Call payload (from backend ringCallee): { type: 'incoming_call', callId, callerName }.
 * Generic payload (e.g. KPI nudge): { title, body, url? }. */

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { /* non-JSON push */ }

  if (data.type === 'incoming_call' && data.callId) {
    const title = data.callerName || 'Back office';
    event.waitUntil(
      self.registration.showNotification(title, {
        body: 'Incoming call',
        tag: 'call-' + data.callId, // collapse repeat rings for the same call
        requireInteraction: true,   // keep ringing until the agent acts
        renotify: true,
        data: { callId: data.callId, callerName: title },
        actions: [
          { action: 'answer', title: 'Answer' },
          { action: 'decline', title: 'Decline' },
        ],
      })
    );
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
