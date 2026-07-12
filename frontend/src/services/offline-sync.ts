// Wires the (previously dead) IndexedDB layer in utils/offline-storage.ts into the
// axios choke point so the field PWA works with no signal:
//   - reads:  every successful GET is written through to IDB; on a network error a
//             GET serves its last cached payload, so a cold offline open shows data.
//   - writes: a POST/PUT/PATCH/DELETE that fails offline is queued and replayed on
//             reconnect (processSyncQueue), instead of just erroring.
// api.service.ts calls the request/response helpers here; main.tsx calls startOfflineSync.
import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import type { QueryClient } from '@tanstack/react-query'
import { getAuthToken } from '../store/auth.store'
import { tenantService } from './tenant.service'
import { API_CONFIG } from '../config/api.config'
import {
  cacheResponse,
  getCachedResponse,
  addToSyncQueue,
  processSyncQueue,
  getSyncQueueCount,
  clearExpiredCache,
  onConnectivityChange,
  isOnline,
} from '../utils/offline-storage'

// Keep offline reads usable for a day — a field agent can lose signal for hours and
// still open the app to yesterday's data. The SW api-cache (5 min) never covered this.
const READ_TTL_MS = 24 * 60 * 60 * 1000

export function isWriteMethod(method?: string): boolean {
  const m = (method || 'get').toLowerCase()
  return m === 'post' || m === 'put' || m === 'patch' || m === 'delete'
}

// Stable IDB key for a request so write-through (on GET success) and read-fallback
// (on GET failure) address the same entry. Mirrors how axios resolves the URL.
export function cacheKeyFor(config: AxiosRequestConfig): string {
  const base = config.baseURL || ''
  const url = config.url || ''
  let params = ''
  if (config.params && typeof config.params === 'object') {
    params = '?' + new URLSearchParams(config.params as Record<string, string>).toString()
  }
  return `${base}${url}${params}`
}

function parseBody(data: unknown): unknown {
  if (typeof data !== 'string') return data
  try {
    return JSON.parse(data)
  } catch {
    return data
  }
}

// On a successful GET, persist the payload for later offline reads. Fire-and-forget.
export function cacheReadThrough(response: AxiosResponse): void {
  if ((response.config.method || 'get').toLowerCase() !== 'get') return
  cacheResponse(cacheKeyFor(response.config), response.data, READ_TTL_MS)
}

// Network down on a GET: serve the last cached payload if present, else null so the
// caller rejects as before. Returns a synthetic AxiosResponse React Query accepts.
export async function serveOfflineRead(config: AxiosRequestConfig): Promise<AxiosResponse | null> {
  if ((config.method || 'get').toLowerCase() !== 'get') return null
  const data = await getCachedResponse(cacheKeyFor(config))
  if (data == null) return null
  return { data, status: 200, statusText: 'OK (offline cache)', headers: {}, config } as AxiosResponse
}

// Network down on a write: queue for replay and resolve optimistically so the field
// action sticks in the UI. ponytail: last-write-wins on replay, no server-side conflict
// check — fine for the append-only field actions (note/nudge/commit/resolve/check-in).
// Revisit if a queued write can be legitimately server-rejected on replay.
export async function queueOfflineWrite(config: AxiosRequestConfig): Promise<AxiosResponse> {
  await addToSyncQueue({
    method: (config.method || 'post').toUpperCase() as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: config.url || '',
    body: parseBody(config.data),
    headers: { 'X-Tenant-Code': tenantService.getTenantCode() },
  })
  return { data: { queued: true }, status: 202, statusText: 'Queued offline', headers: {}, config } as AxiosResponse
}

let syncing = false
async function flush(queryClient?: QueryClient): Promise<void> {
  if (syncing || !isOnline()) return
  const token = getAuthToken()
  if (!token) return
  if ((await getSyncQueueCount()) === 0) return
  syncing = true
  try {
    const { succeeded } = await processSyncQueue(API_CONFIG.BASE_URL, token)
    if (succeeded > 0) queryClient?.invalidateQueries()
  } finally {
    syncing = false
  }
}

// Boot wiring: drop expired reads, flush any queued writes now, and replay on reconnect.
export function startOfflineSync(queryClient: QueryClient): void {
  clearExpiredCache()
  flush(queryClient)
  onConnectivityChange((online) => {
    if (online) flush(queryClient)
  })
}
