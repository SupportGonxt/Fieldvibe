/* Web Push handlers, imported into the workbox-generated service worker.
 * Payload shape (from backend ringCallee): { type, callId, callerName }. */

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { /* non-JSON push */ }
  if (data.type !== 'incoming_call' || !data.callId) return;

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
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { callId, callerName } = event.notification.data || {};
  if (!callId || event.action === 'decline') return;

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
