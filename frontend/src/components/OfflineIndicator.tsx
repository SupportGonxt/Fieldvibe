// Small trust pill for the field PWA: shows "Offline" when there's no signal and
// "N queued" while offline writes wait to sync. Silent when online with nothing pending,
// so it never adds noise on a good connection. Reads the same offline-storage layer the
// axios interceptors write to (utils/offline-storage.ts).
import { useEffect, useState } from 'react'
import { CloudOff, RefreshCw } from 'lucide-react'
import { isOnline, onConnectivityChange, getSyncQueueCount } from '../utils/offline-storage'

export default function OfflineIndicator() {
  const [online, setOnline] = useState(isOnline())
  const [pending, setPending] = useState(0)

  useEffect(() => {
    let alive = true
    const refresh = () => getSyncQueueCount().then((n) => { if (alive) setPending(n) })
    refresh()
    const stop = onConnectivityChange((o) => { setOnline(o); refresh() })
    // Poll the queue while mounted — writes drain in the background on reconnect.
    const t = setInterval(refresh, 5000)
    return () => { alive = false; stop(); clearInterval(t) }
  }, [])

  if (online && pending === 0) return null

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-amber-300">
      {online ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CloudOff className="w-3.5 h-3.5" />}
      <span className="text-[11px] font-medium">
        {online ? `Syncing ${pending}…` : pending > 0 ? `Offline · ${pending} queued` : 'Offline'}
      </span>
    </div>
  )
}
