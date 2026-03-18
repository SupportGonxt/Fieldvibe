// ENH-17 / MOB-07: Offline Mode with IndexedDB caching, sync queue, conflict resolution

const DB_NAME = 'fieldvibe-offline'
const DB_VERSION = 1
const STORES = {
  CACHE: 'api-cache',
  SYNC_QUEUE: 'sync-queue',
  PENDING_UPLOADS: 'pending-uploads',
}

interface CacheEntry {
  key: string
  data: unknown
  timestamp: number
  expiresAt: number
}

interface SyncQueueItem {
  id: string
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  body?: unknown
  headers?: Record<string, string>
  createdAt: number
  retries: number
  status: 'pending' | 'syncing' | 'failed'
  error?: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORES.CACHE)) {
        db.createObjectStore(STORES.CACHE, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const store = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' })
        store.createIndex('status', 'status', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORES.PENDING_UPLOADS)) {
        db.createObjectStore(STORES.PENDING_UPLOADS, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function cacheResponse(key: string, data: unknown, ttlMs: number = 5 * 60 * 1000): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORES.CACHE, 'readwrite')
    const store = tx.objectStore(STORES.CACHE)
    const entry: CacheEntry = { key, data, timestamp: Date.now(), expiresAt: Date.now() + ttlMs }
    store.put(entry)
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
  } catch (error) {
    console.warn('Failed to cache response:', error)
  }
}

export async function getCachedResponse<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORES.CACHE, 'readonly')
    const store = tx.objectStore(STORES.CACHE)
    const request = store.get(key)
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined
        if (entry && entry.expiresAt > Date.now()) { resolve(entry.data as T) } else { resolve(null) }
      }
      request.onerror = () => reject(request.error)
    })
  } catch { return null }
}

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retries' | 'status'>): Promise<string> {
  const db = await openDB()
  const id = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite')
  const store = tx.objectStore(STORES.SYNC_QUEUE)
  const queueItem: SyncQueueItem = { ...item, id, createdAt: Date.now(), retries: 0, status: 'pending' }
  store.put(queueItem)
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
  return id
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORES.SYNC_QUEUE, 'readonly')
    const store = tx.objectStore(STORES.SYNC_QUEUE)
    const index = store.index('status')
    const request = index.getAll('pending')
    return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
  } catch { return [] }
}

export async function processSyncQueue(apiBaseUrl: string, authToken: string): Promise<{ succeeded: number; failed: number }> {
  const items = await getPendingSyncItems()
  let succeeded = 0
  let failed = 0
  for (const item of items) {
    try {
      await updateSyncItemStatus(item.id, 'syncing')
      const response = await fetch(`${apiBaseUrl}${item.url}`, {
        method: item.method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}`, ...item.headers },
        body: item.body ? JSON.stringify(item.body) : undefined,
      })
      if (response.ok) { await removeSyncItem(item.id); succeeded++ }
      else { const errorText = await response.text(); await updateSyncItemStatus(item.id, 'failed', errorText); failed++ }
    } catch (error) { await updateSyncItemStatus(item.id, 'failed', String(error)); failed++ }
  }
  return { succeeded, failed }
}

async function updateSyncItemStatus(id: string, status: SyncQueueItem['status'], error?: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite')
  const store = tx.objectStore(STORES.SYNC_QUEUE)
  const request = store.get(id)
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const item = request.result
      if (item) { item.status = status; item.retries = (item.retries || 0) + (status === 'failed' ? 1 : 0); if (error) item.error = error; store.put(item) }
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error)
    }
    request.onerror = () => reject(request.error)
  })
}

async function removeSyncItem(id: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite')
  tx.objectStore(STORES.SYNC_QUEUE).delete(id)
  await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
}

export async function getSyncQueueCount(): Promise<number> {
  try { return (await getPendingSyncItems()).length } catch { return 0 }
}

export async function clearExpiredCache(): Promise<number> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORES.CACHE, 'readwrite')
    const store = tx.objectStore(STORES.CACHE)
    const request = store.getAll()
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        let cleared = 0; const now = Date.now()
        for (const entry of request.result) { if (entry.expiresAt < now) { store.delete(entry.key); cleared++ } }
        tx.oncomplete = () => resolve(cleared); tx.onerror = () => reject(tx.error)
      }
      request.onerror = () => reject(request.error)
    })
  } catch { return 0 }
}

export function isOnline(): boolean { return navigator.onLine }

export function onConnectivityChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline) }
}
