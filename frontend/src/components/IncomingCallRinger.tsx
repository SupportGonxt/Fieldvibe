import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'
import { ensurePushSubscription } from '../services/push'

// App-wide push registration + incoming-call ring. Mounted once in App so it
// covers every screen (field app, BO dashboard, cockpit).
// Outbound calling is GSM dial-out now (see services/dialer.ts), so nothing
// creates in-app rings today — but the push subscription registered here still
// powers nudges/news, and the incoming_call handling stays live in case a
// server-side flow rings a user again.
// `handled` remembers every callId this window has ringed or seen cancelled,
// so backing out of the call screen can't be re-ambushed by the same ring.

const handled = new Set<string>()

export default function IncomingCallRinger() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id)
  const navRef = useRef(navigate)
  navRef.current = navigate

  useEffect(() => {
    if (!userId) return
    ensurePushSubscription()

    const ring = (callId: string, callerName?: string) => {
      if (!callId || handled.has(callId)) return
      handled.add(callId)
      if (window.location.pathname.startsWith('/agent/call')) return // already on a call
      navRef.current('/agent/call/incoming', {
        state: { callId, peerName: callerName },
      })
    }

    const onSwMessage = (ev: MessageEvent) => {
      const d = ev.data
      if (d?.type === 'incoming_call' && d.callId) {
        ring(d.callId, d.callerName)
      } else if (d?.type === 'call_cancelled' && d.callId) {
        handled.add(d.callId)
        window.dispatchEvent(new CustomEvent('fv:call-cancelled', { detail: { callId: d.callId } }))
      }
    }
    navigator.serviceWorker?.addEventListener('message', onSwMessage)

    return () => {
      navigator.serviceWorker?.removeEventListener('message', onSwMessage)
    }
  }, [userId])

  return null
}
