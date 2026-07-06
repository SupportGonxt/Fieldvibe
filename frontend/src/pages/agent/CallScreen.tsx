import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { Phone, PhoneOff, Mic, MicOff, Loader2 } from 'lucide-react'
import { apiClient } from '../../services/api.service'
import { CallSession, type CallState } from '../../services/webrtc'

// Full-screen call UI, rendered outside AgentLayout (no bottom nav / header).
// Outgoing:  /agent/call/:callId   — initiator, call already started server-side.
// Incoming:  /agent/call/incoming  — callee answers; callId+iceServers via nav state.

type NavState = {
  iceServers?: RTCIceServer[]
  peerName?: string
  callId?: string // incoming passes it here (route has no :callId)
}

const LABELS: Record<CallState, string> = {
  connecting: 'Connecting…',
  ringing: 'Ringing…',
  connected: '',
  reconnecting: 'Reconnecting…',
  ended: 'Call ended',
  failed: 'Call failed',
}

export default function CallScreen({ incoming = false }: { incoming?: boolean }) {
  const navigate = useNavigate()
  const params = useParams()
  const location = useLocation()
  const nav = (location.state || {}) as NavState

  const callId = incoming ? nav.callId! : params.callId!
  const iceServers = nav.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }]
  const peerName = nav.peerName || (incoming ? 'Incoming call' : 'Calling')

  const [state, setState] = useState<CallState>('connecting')
  const [muted, setMuted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  // Incoming calls wait for the user to accept before touching the mic.
  const [accepted, setAccepted] = useState(!incoming)
  const sessionRef = useRef<CallSession | null>(null)

  // Duration timer — runs while connected.
  useEffect(() => {
    if (state !== 'connected') return
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [state])

  // Leave the call screen a moment after it terminates.
  useEffect(() => {
    if (state === 'ended' || state === 'failed') {
      const id = setTimeout(() => navigate(-1), 1500)
      return () => clearTimeout(id)
    }
  }, [state, navigate])

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
    try { await apiClient.post(`/field-ops/calls/${callId}/answer`) } catch { /* */ }
    setAccepted(true)
  }
  const decline = async () => {
    try { await apiClient.post(`/field-ops/calls/${callId}/decline`) } catch { /* */ }
    navigate(-1)
  }
  const hangup = () => {
    apiClient.post(`/field-ops/calls/${callId}/end`, {}).catch(() => {})
    sessionRef.current?.hangup()
    navigate(-1)
  }
  const toggleMute = () => {
    const m = sessionRef.current?.toggleMute() ?? false
    setMuted(m)
  }

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  const status = state === 'connected' ? mmss : LABELS[state]

  return (
    <div className="fixed inset-0 z-[100] bg-[#06090F] flex flex-col items-center justify-between px-6 py-16">
      {/* Peer identity */}
      <div className="flex flex-col items-center mt-8">
        <div className="w-28 h-28 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center mb-6">
          <span className="text-4xl font-semibold text-white">
            {peerName.trim().charAt(0).toUpperCase() || '?'}
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-white text-center">{peerName}</h1>
        <div className="mt-3 flex items-center gap-2 text-[#00E87B] tabular-nums">
          {(state === 'connecting' || state === 'ringing' || state === 'reconnecting') && (
            <Loader2 className="w-4 h-4 animate-spin" />
          )}
          <span className={state === 'failed' ? 'text-red-400' : state === 'connected' ? 'text-white' : 'text-gray-400'}>
            {status}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="w-full max-w-xs">
        {incoming && !accepted ? (
          <div className="flex items-center justify-around">
            <button
              onClick={decline}
              className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center active:scale-95 transition-transform"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
            <button
              onClick={accept}
              className="w-16 h-16 rounded-full bg-[#00E87B] flex items-center justify-center active:scale-95 transition-transform shadow-lg shadow-[#00E87B]/30"
            >
              <Phone className="w-7 h-7 text-[#0A1628]" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-8">
            <button
              onClick={toggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center border transition-colors ${
                muted ? 'bg-white/90 border-white text-[#0A1628]' : 'bg-white/[0.06] border-white/10 text-white'
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
      </div>
    </div>
  )
}
