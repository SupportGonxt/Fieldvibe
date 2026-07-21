import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'
import { apiClient } from '../services/api.service'
import { ensurePushSubscription } from '../services/push'

// App-wide incoming-call ring. Mounted once in App so a call reaches the user
// on ANY screen (field app, BO dashboard, cockpit) the moment it arrives:
//  - Web Push: push-sw.js posts {type:'incoming_call'} to open windows on the
//    push itself (no notification click needed) — instant in-app ring.
//  - Poll fallback: devices without push (permission denied, dev, unsupported)
//    poll /calls/incoming every 10s while visible.
// `handled` remembers every callId this window has ringed or seen cancelled,
// so backing out of the call screen can't be re-ambushed by the same ring
// (the flash-loop bug that got the old always-on poll removed).

const handled = new Set<string>()

export default function IncomingCallRinger() {
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.user?.id)
  const navRef = useRef(navigate)
  navRef.current = navigate

  useEffect(() => {
    if (!userId) return
    ensurePushSubscription()

    const ring = (callId: string, callerName?: string, iceServers?: RTCIceServer[]) => {
      if (!callId || handled.has(callId)) return
      handled.add(callId)
      if (window.location.pathname.startsWith('/agent/call')) return // already on a call
      navRef.current('/agent/call/incoming', {
        state: { callId, peerName: callerName, iceServers },
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

    // Poll only when push can't deliver — push-capable devices ring instantly
    // via the SW message above.
    let pollId: number | undefined
    const pushReady =
      import.meta.env.PROD &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window &&
      Notification.permission === 'granted'
    if (!pushReady) {
      const poll = async () => {
        if (document.visibilityState !== 'visible') return
        try {
          const { data } = await apiClient.get('/field-ops/calls/incoming')
          if (data?.call?.callId) ring(data.call.callId, data.call.callerName, data.iceServers)
        } catch { /* offline — next tick */ }
      }
      poll()
      pollId = window.setInterval(poll, 10_000)
    }

    return () => {
      navigator.serviceWorker?.removeEventListener('message', onSwMessage)
      if (pollId) clearInterval(pollId)
    }
  }, [userId])

  return null
}
