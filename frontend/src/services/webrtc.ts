import { API_CONFIG } from '../config/api.config'
import { getAuthToken } from '../store/auth.store'

// Thin P2P audio call helper. Signaling goes over a WebSocket to the CallRoom
// Durable Object, which relays JSON {type: offer|answer|ice|bye} between the two
// peers. Caller is the initiator (creates the offer); callee answers.

export type CallState =
  | 'connecting'   // acquiring mic + opening socket
  | 'ringing'      // offer sent, waiting for the other side
  | 'connected'    // media flowing
  | 'reconnecting' // ICE dropped, may recover
  | 'ended'        // hung up / peer left
  | 'declined'     // callee rejected the call
  | 'failed'       // mic denied or ICE failed

export interface CallSessionOpts {
  callId: string
  iceServers: RTCIceServer[]
  initiator: boolean
  onState: (s: CallState) => void
}

function signalingUrl(callId: string): string {
  const base = API_CONFIG.BASE_URL // e.g. https://host/api or /api
  const abs = base.startsWith('http') ? base : window.location.origin + base
  const u = new URL(abs.replace(/\/$/, '') + '/field-ops/calls/ws')
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
  u.searchParams.set('callId', callId)
  const token = getAuthToken()
  if (token) u.searchParams.set('access_token', token) // browsers can't set WS headers
  return u.toString()
}

export class CallSession {
  private pc!: RTCPeerConnection
  private ws!: WebSocket
  private localStream?: MediaStream
  private remoteAudio?: HTMLAudioElement
  private ended = false
  constructor(private opts: CallSessionOpts) {}

  async start(): Promise<void> {
    this.opts.onState('connecting')
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      this.opts.onState('failed')
      throw new Error('no_mic')
    }

    const pc = new RTCPeerConnection({ iceServers: this.opts.iceServers })
    this.pc = pc
    this.localStream.getTracks().forEach((t) => pc.addTrack(t, this.localStream!))

    this.remoteAudio = new Audio()
    this.remoteAudio.autoplay = true
    pc.ontrack = (e) => {
      if (this.remoteAudio) {
        this.remoteAudio.srcObject = e.streams[0]
        this.remoteAudio.play().catch(() => {})
      }
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) this.send({ type: 'ice', candidate: e.candidate })
    }
    pc.onconnectionstatechange = () => {
      if (this.ended) return
      const st = pc.connectionState
      if (st === 'connected') this.opts.onState('connected')
      else if (st === 'disconnected') this.opts.onState('reconnecting')
      else if (st === 'failed') this.fail()
    }

    const ws = new WebSocket(signalingUrl(this.opts.callId))
    this.ws = ws
    ws.onopen = async () => {
      if (this.opts.initiator) {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        this.send({ type: 'offer', sdp: pc.localDescription })
        this.opts.onState('ringing')
      }
    }
    ws.onmessage = (evt) => this.onSignal(evt.data)
  }

  private async onSignal(raw: any): Promise<void> {
    let msg: any
    try { msg = JSON.parse(raw) } catch { return }
    const pc = this.pc
    if (msg.type === 'offer') {
      await pc.setRemoteDescription(msg.sdp)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      this.send({ type: 'answer', sdp: pc.localDescription })
    } else if (msg.type === 'answer') {
      await pc.setRemoteDescription(msg.sdp)
    } else if (msg.type === 'ice') {
      try { await pc.addIceCandidate(msg.candidate) } catch { /* stale candidate */ }
    } else if (msg.type === 'bye') {
      this.opts.onState(msg.reason === 'declined' ? 'declined' : 'ended')
      this.cleanup()
    }
  }

  private send(obj: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj))
  }

  // Returns true when now muted.
  toggleMute(): boolean {
    const track = this.localStream?.getAudioTracks()[0]
    if (!track) return false
    track.enabled = !track.enabled
    return !track.enabled
  }

  private fail(): void {
    if (this.ended) return
    this.opts.onState('failed')
    this.cleanup()
  }

  hangup(): void {
    this.send({ type: 'bye' })
    this.opts.onState('ended')
    this.cleanup()
  }

  private cleanup(): void {
    if (this.ended) return
    this.ended = true
    try { this.ws?.close() } catch { /* */ }
    try { this.pc?.close() } catch { /* */ }
    this.localStream?.getTracks().forEach((t) => t.stop())
    if (this.remoteAudio) this.remoteAudio.srcObject = null
  }
}
