import { apiClient } from './api.service'

// VAPID public key (safe to ship — it's the applicationServerKey the browser
// needs). Backend holds the matching private key as a Cloudflare secret.
const VAPID_PUBLIC_KEY =
  'BJ4L8SDZ8swmv4P_NFWJv8azlow_piVQOjzcmMTETD75HniyQjUpvI2M7LRvzM-5Sq58FYNwWNYkk_8w126Ndb8'

function urlB64ToUint8Array(b64: string): Uint8Array {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4)
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/**
 * Best-effort push subscribe. Degrades silently on every unsupported branch —
 * a call still rings via the 5s poll fallback when push isn't available.
 * Safe to call on every agent app-open; the browser dedupes existing subs.
 */
export async function ensurePushSubscription(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return
    if (Notification.permission === 'denied') return
    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') return
    }
    const reg = await navigator.serviceWorker.ready
    const sub =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      }))
    await apiClient.post('/field-ops/calls/push/subscribe', sub.toJSON())
  } catch {
    /* unsupported / permission race / offline — poll fallback covers it */
  }
}
