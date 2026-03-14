import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { apiClient } from '../services/api.service'

export function usePageTracking() {
  const location = useLocation()
  const startTime = useRef(Date.now())
  const lastPath = useRef('')

  useEffect(() => {
    const now = Date.now()
    // Track previous page duration
    if (lastPath.current && lastPath.current !== location.pathname) {
      const duration = now - startTime.current
      apiClient.post('/analytics/track', {
        page: lastPath.current,
        action: 'view',
        duration_ms: duration,
        metadata: { referrer: lastPath.current }
      }).catch(() => {}) // fire-and-forget
    }
    lastPath.current = location.pathname
    startTime.current = now
  }, [location.pathname])
}
