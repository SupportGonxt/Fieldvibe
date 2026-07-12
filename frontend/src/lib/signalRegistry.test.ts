import { describe, it, expect } from 'vitest'
import { signalText } from './signalRegistry'

// Regression: below_gate and unknown types must render real registry / humanized text,
// never the old generic 'Underperformance signal' fallback the switches used to emit.
describe('signalText', () => {
  it('below_gate renders real registry text mentioning the metric', () => {
    const out = signalText({ type: 'below_gate', detail: { metric: 'signups', shortfall: 1, target: 10 } })
    expect(out).not.toBe('Underperformance signal')
    expect(out).toContain('sign-ups') // humanized metric label, not the raw key
  })

  it('unknown type falls back to a humanized string, never the generic label', () => {
    const out = signalText({ type: 'some_new_signal', detail: {} })
    expect(out).not.toBe('Underperformance signal')
    expect(out).toBe('some new signal')
  })
})
