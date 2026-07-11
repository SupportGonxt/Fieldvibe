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

const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/**
 * Ask for notification permission. MUST be called synchronously from inside a user
 * gesture (the login submit) — iOS Safari rejects requestPermission() once an await
 * has broken the gesture's task, which is why subscribing from a layout's mount effect
 * silently never prompts there. Returns immediately if already granted or denied.
 */
export function requestPushPermission(): void {
  try {
    if (!pushSupported() || Notification.permission !== 'default') return
    // The prompt may still be open when the layout mounts and skips subscribing, so
    // whoever answers it owns the subscribe. Later app-opens go through the layouts.
    void Notification.requestPermission().then((perm) => {
      if (perm === 'granted') void ensurePushSubscription()
    })
  } catch {
    /* unsupported — ensurePushSubscription no-ops later */
  }
}

/**
 * Best-effort push subscribe. Degrades silently on every unsupported branch —
 * a call still rings via the 5s poll fallback when push isn't available.
 * Safe to call on every agent app-open; the browser dedupes existing subs.
 * Never prompts: permission comes from requestPushPermission() at login, so that a
 * prompt can't fire from a background mount with no gesture behind it.
 */
export async function ensurePushSubscription(): Promise<void> {
  try {
    if (!pushSupported()) return
    if (Notification.permission !== 'granted') return
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

/**
 * Fire a test push to this user's own devices. Ensures a subscription exists first
 * (no-op if permission isn't granted). Returns true only if the backend actually
 * delivered to at least one device. Powers the first-login tour's test button.
 */
export async function sendTestPush(): Promise<boolean> {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return false
    await ensurePushSubscription()
    const res = await apiClient.post('/field-ops/calls/push/test', {})
    return !!res?.data?.success
  } catch {
    return false
  }
}
