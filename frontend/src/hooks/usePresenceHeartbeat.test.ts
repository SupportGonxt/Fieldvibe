import { describe, it, expect } from 'vitest'
import { shouldSample } from './usePresenceHeartbeat'

describe('shouldSample', () => {
  const gap = 4 * 60 * 1000

  it('fires when the gap is exceeded', () => {
    expect(shouldSample(gap + 1, 0)).toBe(true)
  })

  it('blocks when too soon since last send', () => {
    const now = 10_000_000
    expect(shouldSample(now, now - 1000)).toBe(false)
  })

  it('fires on lastSent=0 (never sent)', () => {
    expect(shouldSample(Date.now(), 0)).toBe(true)
  })
})
