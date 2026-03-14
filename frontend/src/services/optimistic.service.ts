import { apiClient } from './api.service'

interface QueuedAction {
  id: string
  type: 'visit_start' | 'visit_end' | 'order_draft' | 'photo_upload'
  payload: Record<string, unknown>
  timestamp: number
  retries: number
}

const QUEUE_KEY = 'fieldvibe_offline_queue'

function getQueue(): QueuedAction[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveQueue(queue: QueuedAction[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function enqueueAction(type: QueuedAction['type'], payload: Record<string, unknown>) {
  const queue = getQueue()
  queue.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    type,
    payload,
    timestamp: Date.now(),
    retries: 0,
  })
  saveQueue(queue)
}

export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  const queue = getQueue()
  if (queue.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0
  const remaining: QueuedAction[] = []

  for (const action of queue) {
    try {
      const endpointMap: Record<string, string> = {
        visit_start: '/visits/quick-start',
        visit_end: '/visits/checkout',
        order_draft: '/sales/orders/create',
        photo_upload: '/visits/photos',
      }
      await apiClient.post(endpointMap[action.type] || '/sync', action.payload)
      synced++
    } catch {
      action.retries++
      if (action.retries < 5) {
        remaining.push(action)
      }
      failed++
    }
  }

  saveQueue(remaining)
  return { synced, failed }
}

export function getQueueSize(): number {
  return getQueue().length
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY)
}
