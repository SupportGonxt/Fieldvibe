// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { applyTenantTheme } from './applyTenantTheme'

const root = () => document.documentElement

beforeEach(() => {
  root().style.cssText = ''
  document.head.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove())
})

describe('applyTenantTheme', () => {
  it('sets --color-primary and --color-primary-rgb from a valid hex', () => {
    applyTenantTheme({ primaryColor: '#FF5500' })
    expect(root().style.getPropertyValue('--color-primary')).toBe('#FF5500')
    expect(root().style.getPropertyValue('--color-primary-rgb')).toBe('255 85 0')
  })

  it('updates <meta name="theme-color">', () => {
    applyTenantTheme({ primaryColor: '#FF5500' })
    const meta = document.head.querySelector('meta[name="theme-color"]') as HTMLMetaElement
    expect(meta?.content).toBe('#FF5500')
  })

  it('rejects invalid hex — resets to tokens.css defaults', () => {
    applyTenantTheme({ primaryColor: 'red' })
    applyTenantTheme({ primaryColor: '#12345' })
    applyTenantTheme({ primaryColor: '#GGGGGG' })
    expect(root().style.getPropertyValue('--color-primary')).toBe('')
  })

  it('no theme → clears managed tokens (brand green from tokens.css stands)', () => {
    applyTenantTheme(undefined)
    applyTenantTheme({})
    expect(root().style.getPropertyValue('--color-primary')).toBe('')
  })

  it('flips --color-on-primary to white for dark tenant colors (contrast guard)', () => {
    applyTenantTheme({ primaryColor: '#003300' }) // very dark green
    expect(root().style.getPropertyValue('--color-on-primary')).toBe('#FFFFFF')
  })

  it('keeps default on-primary for light tenant colors', () => {
    applyTenantTheme({ primaryColor: '#FFDD00' }) // bright yellow
    expect(root().style.getPropertyValue('--color-on-primary')).toBe('')
  })

  it('switching dark → light removes the stale white on-primary override', () => {
    applyTenantTheme({ primaryColor: '#003300' }) // dark: sets white override
    applyTenantTheme({ primaryColor: '#FFDD00' }) // light: must clear it
    expect(root().style.getPropertyValue('--color-on-primary')).toBe('')
  })

  it('switching to no theme removes all managed tokens and resets meta', () => {
    applyTenantTheme({ primaryColor: '#003300' })
    applyTenantTheme(undefined)
    expect(root().style.getPropertyValue('--color-primary')).toBe('')
    expect(root().style.getPropertyValue('--color-primary-rgb')).toBe('')
    expect(root().style.getPropertyValue('--color-on-primary')).toBe('')
    const meta = document.head.querySelector('meta[name="theme-color"]') as HTMLMetaElement
    expect(meta?.content).toBe('#0A0F1C')
  })
})
