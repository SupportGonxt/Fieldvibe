import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function freshModule(key: string) {
  vi.resetModules()
  vi.stubEnv('VITE_NXTDESK_WIDGET_KEY', key)
  return import('./nxtdesk')
}

describe('nxtdesk', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    delete window.NXTDesk
    delete window.__nxtdeskLoaded
  })
  afterEach(() => vi.unstubAllEnvs())

  it('allows exactly GM, BO, super admin and admin', async () => {
    const { nxtDeskAllowed } = await freshModule('pk_test')
    for (const r of ['general_manager', 'backoffice_admin', 'super_admin', 'admin']) {
      expect(nxtDeskAllowed([r])).toBe(true)
    }
    for (const r of ['manager', 'team_lead', 'agent', 'field_agent', 'sales_rep', 'promoter', '', null, undefined]) {
      expect(nxtDeskAllowed([r])).toBe(false)
    }
    expect(nxtDeskAllowed(['agent', 'general_manager'])).toBe(true)
  })

  it('does nothing without a key', async () => {
    const { loadNxtDesk } = await freshModule('')
    loadNxtDesk()
    expect(document.querySelector('script')).toBeNull()
    expect(window.NXTDesk).toBeUndefined()
  })

  it('loads once, queues commands, and unloads cleanly', async () => {
    const { loadNxtDesk, unloadNxtDesk, isNxtDeskLoaded } = await freshModule('pk_test')
    loadNxtDesk()
    loadNxtDesk()
    const scripts = document.querySelectorAll('script')
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toBe('https://intake.gonxt.tech/widget.js')
    expect(scripts[0].getAttribute('data-key')).toBe('pk_test')
    expect(scripts[0].async).toBe(true)

    window.NXTDesk!('identify', { name: 'A', email: 'a@example.com' })
    expect(window.NXTDesk!.q).toHaveLength(1)

    // What the real script leaves behind once it has run.
    const host = document.createElement('div')
    host.id = 'nxtdesk-widget'
    document.body.appendChild(host)
    window.__nxtdeskLoaded = true

    unloadNxtDesk()
    expect(isNxtDeskLoaded()).toBe(false)
    expect(document.getElementById('nxtdesk-widget')).toBeNull()
    expect(document.querySelector('script')).toBeNull()
    expect(window.NXTDesk).toBeUndefined()
    expect(window.__nxtdeskLoaded).toBeUndefined()

    loadNxtDesk()
    expect(document.querySelectorAll('script')).toHaveLength(1)
    expect(window.NXTDesk!.q).toBeUndefined()
  })

  it('cleans up after a script that was removed mid-download and then ran', async () => {
    const { loadNxtDesk, unloadNxtDesk } = await freshModule('pk_test')
    loadNxtDesk()
    const s = document.querySelector('script')!
    unloadNxtDesk()
    expect(s.hasAttribute('data-key')).toBe(false)
    // The browser runs it anyway: widget.js sets its guard, then `load` fires.
    window.__nxtdeskLoaded = true
    s.dispatchEvent(new Event('load'))
    expect(window.__nxtdeskLoaded).toBeUndefined()
  })
})
