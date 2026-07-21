import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { Phone, PhoneOff, Mic, MicOff, Loader2 } from 'lucide-react'
import { apiClient } from '../../services/api.service'
import { CallSession, type CallState } from '../../services/webrtc'
import { startRinger } from '../../services/ringtone'
import { closeCallNotification } from '../../services/push'

// Full-screen call UI, rendered outside AgentLayout (no bottom nav / header).
// Outgoing:  /agent/call/:callId   — initiator, call already started server-side.
// Incoming:  /agent/call/incoming  — callee answers; callId+iceServers via nav state.

type NavState = {
  iceServers?: RTCIceServer[]
  peerName?: string
  callId?: string // incoming passes it here (route has no :callId)
  calleePhone?: string | null // outgoing: GSM fallback when the app can't reach them
  reachable?: boolean // outgoing: false = callee has no push-capable device
}

const LABELS: Record<CallState, string> = {
  connecting: 'Connecting…',
  ringing: 'Ringing…',
  connected: '',
  reconnecting: 'Reconnecting…',
  ended: 'Call ended',
  declined: 'Call declined',
  failed: 'Call failed',
}

// How long the caller rings before the call is written off as missed.
const RING_TIMEOUT_MS = 45_000

export default function CallScreen({ incoming = false }: { incoming?: boolean }) {
  const navigate = useNavigate()
  const params = useParams()
  const location = useLocation()
  const nav = (location.state || {}) as NavState

  // Push-opened windows (app was closed) carry callId/peerName in the query
  // string, not nav state — fall back to those.
  const query = new URLSearchParams(location.search)
  const callId = incoming ? (nav.callId || query.get('callId') || '') : params.callId!
  const iceServers = nav.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }]
  const peerName = nav.peerName || query.get('callerName') || (incoming ? 'Incoming call' : 'Calling')

  // Callee starts "ringing" (pre-accept); caller starts "connecting".
  const [state, setState] = useState<CallState>(incoming ? 'ringing' : 'connecting')
  const [muted, setMuted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [noAnswer, setNoAnswer] = useState(false)
  // Incoming calls wait for the user to accept before touching the mic.
  const [accepted, setAccepted] = useState(!incoming)
  const sessionRef = useRef<CallSession | null>(null)

  const over = state === 'ended' || state === 'failed' || state === 'declined'
  const waitingForAnswer = !incoming && !over && state !== 'connected' && state !== 'reconnecting'

  // GSM fallback — an internet call can't reach a phone with no data, so when
  // the app can't get through we hand the caller to the real dialer instead.
  const calleePhone = (!incoming && nav.calleePhone) || null
  const telHref = calleePhone ? `tel:${calleePhone.replace(/[^+\d]/g, '')}` : ''
  const unreachable = !incoming && nav.reachable === false
  const phoneFallback = !!calleePhone && (noAnswer || state === 'failed')

  // A push-opened window has no history to go back to.
  const leave = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/agent/dashboard', { replace: true })
  }

  // Bail out of the ringing app call into the phone dialer (the tel: href does
  // the dialing; this just finalizes the in-app attempt as missed).
  const bailToPhone = () => {
    apiClient.post(`/field-ops/calls/${callId}/end`, { reason: 'no_answer' }).catch(() => {})
    sessionRef.current?.hangup()
  }

  // Duration timer — runs while connected.
  useEffect(() => {
    if (state !== 'connected') return
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [state])

  // Leave the call screen a moment after it terminates — unless we're offering
  // the phone-dialer fallback, which needs the caller to read and act on it.
  useEffect(() => {
    if (over && !phoneFallback) {
      const id = setTimeout(leave, 1500)
      return () => clearTimeout(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over, phoneFallback])

  // Audible ring: callee hears a ringtone (+vibration) until they act; caller
  // hears a quiet ringback while waiting — "Ringing…" shouldn't be silent.
  useEffect(() => {
    if (incoming && !accepted && !over) return startRinger('incoming')
    if (!incoming && state === 'ringing') return startRinger('ringback')
  }, [incoming, accepted, over, state])

  // Caller gives up after RING_TIMEOUT_MS: finalize as missed (the server then
  // clears the ring on the callee's devices via a call_cancelled push).
  useEffect(() => {
    if (!waitingForAnswer) return
    const id = setTimeout(() => {
      apiClient.post(`/field-ops/calls/${callId}/end`, { reason: 'no_answer' }).catch(() => {})
      setNoAnswer(true)
      sessionRef.current?.hangup()
    }, RING_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [waitingForAnswer, callId])

  // Caller hung up / call was handled elsewhere while we were still ringing
  // (relayed by the SW as a call_cancelled message → window event).
  useEffect(() => {
    if (!incoming || accepted) return
    const onCancelled = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (d?.callId === callId) setState('ended')
    }
    window.addEventListener('fv:call-cancelled', onCancelled)
    return () => window.removeEventListener('fv:call-cancelled', onCancelled)
  }, [incoming, accepted, callId])

  // Start the WebRTC session once the call is live (outgoing: immediately;
  // incoming: after the user accepts).
  useEffect(() => {
    if (!accepted) return
    const session = new CallSession({
      callId,
      iceServers,
      initiator: !incoming,
      onState: setState,
    })
    sessionRef.current = session
    session.start().catch(() => {
      // 'no_mic' already surfaced via onState('failed'); tell the server.
      apiClient.post(`/field-ops/calls/${callId}/end`, { reason: 'no_mic' }).catch(() => {})
    })
    return () => session.hangup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accepted])

  const accept = async () => {
    closeCallNotification(callId)
    try {
      const { data } = await apiClient.post(`/field-ops/calls/${callId}/answer`)
      // Stale notification tap — the caller already gave up; don't join an empty room.
      if (data && data.active === false) {
        setState('ended')
        return
      }
    } catch { /* offline blip — still try to join */ }
    setAccepted(true)
  }
  const decline = async () => {
    closeCallNotification(callId)
    try { await apiClient.post(`/field-ops/calls/${callId}/decline`) } catch { /* */ }
    leave()
  }
  const hangup = () => {
    apiClient.post(`/field-ops/calls/${callId}/end`, {}).catch(() => {})
    sessionRef.current?.hangup()
    leave()
  }
  const toggleMute = () => {
    const m = sessionRef.current?.toggleMute() ?? false
    setMuted(m)
  }

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  const status =
    state === 'connected' ? mmss
    : noAnswer ? 'No answer'
    : incoming && !accepted && state === 'ringing' ? 'Incoming call…'
    : LABELS[state]

  return (
    <div className="fixed inset-0 z-[100] bg-bg flex flex-col items-center justify-between px-6 py-16">
      {/* Peer identity */}
      <div className="flex flex-col items-center mt-8">
        <div className="w-28 h-28 rounded-full bg-white/[0.06] border border-token flex items-center justify-center mb-6">
          <span className="text-4xl font-semibold text-token">
            {peerName.trim().charAt(0).toUpperCase() || '?'}
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-token text-center">{peerName}</h1>
        <div className="mt-3 flex items-center gap-2 text-primary tabular-nums">
          {(state === 'connecting' || state === 'ringing' || state === 'reconnecting') && (
            <Loader2 className="w-4 h-4 animate-spin" />
          )}
          <span className={state === 'failed' ? 'text-red-400' : state === 'connected' ? 'text-token' : 'text-token-muted'}>
            {status}
          </span>
        </div>
        {unreachable && waitingForAnswer && (
          <p className="mt-3 max-w-[260px] text-center text-xs text-amber-500">
            Their app can't be reached right now — they may be offline or haven't enabled notifications.
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="w-full max-w-xs">
        {phoneFallback ? (
          <div className="flex flex-col items-center gap-4">
            <a
              href={telHref}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-on-primary shadow-lg shadow-primary/30 active:scale-95 transition-transform"
            >
              <Phone className="w-5 h-5" /> Call {calleePhone} instead
            </a>
            <button onClick={leave} className="text-sm text-token-muted">Close</button>
          </div>
        ) : over ? null : incoming && !accepted ? (
          <div className="flex items-center justify-around">
            <button
              onClick={decline}
              className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center active:scale-95 transition-transform"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
            <button
              onClick={accept}
              className="w-16 h-16 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform shadow-lg shadow-primary/30 animate-pulse"
            >
              <Phone className="w-7 h-7 text-on-primary" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-8">
            <button
              onClick={toggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center border transition-colors ${
                muted ? 'bg-white/90 border-white text-token' : 'bg-white/[0.06] border-token text-token'
              }`}
            >
              {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            <button
              onClick={hangup}
              className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center active:scale-95 transition-transform"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
          </div>
        )}
        {waitingForAnswer && calleePhone && (
          <a
            href={telHref}
            onClick={bailToPhone}
            className="mt-8 block text-center text-sm text-primary underline underline-offset-4"
          >
            Can't reach them? Call {calleePhone}
          </a>
        )}
      </div>
    </div>
  )
}
