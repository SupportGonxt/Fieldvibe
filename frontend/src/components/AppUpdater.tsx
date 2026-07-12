import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { APP_VERSION, checkForUpdate } from '../lib/appUpdate'

const KEY = 'fv-app-version'

// Makes releases visible to field users. The service worker force-reloads to a
// new build on deploy (main.tsx controllerchange) — this confirms it after the
// reload lands, and speeds discovery by re-checking whenever the PWA returns to
// the foreground (the common "reopen the app" path, which the hourly poll misses).
// Renders nothing.
export default function AppUpdater() {
  useEffect(() => {
    const prev = localStorage.getItem(KEY)
    if (prev && prev !== APP_VERSION) {
      toast.success('Updated to the latest version')
    }
    localStorage.setItem(KEY, APP_VERSION)

    const onVisible = () => { if (document.visibilityState === 'visible') checkForUpdate() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  return null
}
