// WebAudio ringer — no audio asset to ship or cache. Two sounds:
//  'incoming'  callee side: four dual-tone pulses per cycle + vibration.
//  'ringback'  caller side: quiet single tone, 1s on / 3s off (ETSI ringback),
//              so "Ringing…" is audible, not just a label.
// Autoplay: an AudioContext only runs after the page has ever had a user
// gesture. Callers reach this via a click; callees may not (SW message), so
// resume() is best-effort and vibration covers the silent case.

type RingKind = 'incoming' | 'ringback'

function schedulePulse(ctx: AudioContext, freqs: number[], at: number, dur: number, gain: number) {
  const g = ctx.createGain()
  g.connect(ctx.destination)
  // Short attack/release ramps avoid clicks at pulse edges.
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(gain, at + 0.02)
  g.gain.setValueAtTime(gain, at + dur - 0.03)
  g.gain.linearRampToValueAtTime(0, at + dur)
  for (const f of freqs) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = f
    o.connect(g)
    o.start(at)
    o.stop(at + dur)
  }
}

/** Start ringing; returns a stop function. Safe to call anywhere (no-ops on failure). */
export function startRinger(kind: RingKind): () => void {
  let ctx: AudioContext | null = null
  let interval: number | undefined
  try {
    const AC = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (AC) {
      ctx = new AC()
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})
      const cycle = () => {
        if (!ctx || ctx.state !== 'running') return
        const t = ctx.currentTime + 0.05
        if (kind === 'incoming') {
          for (let i = 0; i < 4; i++) schedulePulse(ctx, [440, 554], t + i * 0.45, 0.3, 0.12)
        } else {
          schedulePulse(ctx, [425], t, 1.0, 0.05)
        }
      }
      cycle()
      interval = window.setInterval(cycle, kind === 'incoming' ? 3000 : 4000)
    }
  } catch { /* no audio available */ }

  let vibrate: number | undefined
  if (kind === 'incoming' && 'vibrate' in navigator) {
    const buzz = () => { try { navigator.vibrate([400, 200, 400, 200, 400]) } catch { /* */ } }
    buzz()
    vibrate = window.setInterval(buzz, 3000)
  }

  return () => {
    if (interval) clearInterval(interval)
    if (vibrate) {
      clearInterval(vibrate)
      try { navigator.vibrate(0) } catch { /* */ }
    }
    ctx?.close().catch(() => {})
  }
}
