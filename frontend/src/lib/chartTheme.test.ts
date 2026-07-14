// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { getChartColors } from './chartTheme'

describe('getChartColors', () => {
  it('reads token values from the document root', () => {
    document.documentElement.style.setProperty('--color-primary', '#123456')
    const c = getChartColors()
    expect(c.primary).toBe('#123456')
    expect(c.series[0]).toBe('#123456')
  })

  it('falls back to brand green when tokens are absent', () => {
    document.documentElement.style.removeProperty('--color-primary')
    const c = getChartColors()
    // rgb form, not hex — tokens.css is the only file allowed to contain the brand hex
    expect(c.primary).toBe('rgb(0 232 123)')
  })
})
