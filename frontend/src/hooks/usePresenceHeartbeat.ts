import { useEffect, useRef } from 'react'
import { gpsService } from '../services/gps.service'
import { fieldMarketingService } from '../services/field-marketing.service'

const TRACKED_ROLES = ['field_agent', 'sales_rep', 'agent', 'team_lead']
const CONSENT_KEY = 'fv-presence-consent'
const CONSENT_EVENT = 'fv-presence-consent'
const INTERVAL_MS = 5 * 60 * 1000
const FIRST_SAMPLE_MS = 15 * 1000

/** True when enough time has passed since the last successful send. Testable in isolation. */
export function shouldSample(now: number, lastSent: number, minGapMs = 4 * 60 * 1000): boolean {
  return now - lastSent >= minGapMs
}

function hasConsent(): boolean {
  return localStorage.getItem(CONSENT_KEY) === 'granted'
}

/**
 * Foreground GPS presence sampling for tracked field roles (disclosed-passive, POPIA).
 * No-op for untracked roles or until consent is granted. Samples only while the page
 * is visible, throttled so remount/visibility flaps can't spam the log endpoint.
 */
export function usePresenceHeartbeat(role: string | undefined) {
  const lastSentRef = useRef(0)

  useEffect(() => {
    if (!role || !TRACKED_ROLES.includes(role)) return

    let firstTimer: ReturnType<typeof setTimeout> | undefined
    let interval: ReturnType<typeof setInterval> | undefined

    const sample = async () => {
      if (document.visibilityState !== 'visible') return
      if (!hasConsent()) return
      if (!shouldSample(Date.now(), lastSentRef.current)) return
      try {
        const pos = await gpsService.getCurrentPosition(8000, 60000, false)
        await fieldMarketingService.logGPSLocation({
          latitude: pos.latitude,
          longitude: pos.longitude,
          accuracy: pos.accuracy,
          activity_type: 'presence',
        })
        lastSentRef.current = Date.now()
      } catch {
        // Denied fix / timeout / offline — skip silently; offline queue handles writes.
      }
    }

    const start = () => {
      if (interval) return
      if (document.visibilityState === 'visible') firstTimer = setTimeout(sample, FIRST_SAMPLE_MS)
      interval = setInterval(sample, INTERVAL_MS)
    }
    const stop = () => {
      if (firstTimer) { clearTimeout(firstTimer); firstTimer = undefined }
      if (interval) { clearInterval(interval); interval = undefined }
    }

    const onConsentChange = () => { if (hasConsent()) start() }
    const onVisibility = () => { if (document.visibilityState === 'visible') sample() }

    if (hasConsent()) start()

    window.addEventListener(CONSENT_EVENT, onConsentChange)
    window.addEventListener('storage', onConsentChange)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      window.removeEventListener(CONSENT_EVENT, onConsentChange)
      window.removeEventListener('storage', onConsentChange)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [role])
}
