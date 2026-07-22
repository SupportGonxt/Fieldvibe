import { useState } from 'react'
import { apiClient } from '../services/api.service'
import { dialUser } from '../services/dialer'
import { useToast } from '../components/ui/Toast'

/**
 * The two remediation actions a supervisor can take on a person from any PWA roster row:
 * send a push/in-app nudge, or dial their phone (GSM — reaches agents with no data).
 * `busy` holds the id being acted on so the row can disable its own buttons.
 */
/** Pre-filled default shown in the nudge editor; also used when no message is passed. */
export const defaultNudgeMessage = (name: string) =>
  `${name}, your manager is checking in — log your next visit.`

export function useRemediate() {
  const { toast } = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  async function nudge(userId: string, name: string, message?: string) {
    if (busy) return
    setBusy(userId)
    try {
      await apiClient.post('/field-ops/kpi/remediate/nudge', {
        agentId: userId,
        message: message?.trim() || defaultNudgeMessage(name),
      })
      toast.success('Nudge sent')
    } catch {
      toast.error('Could not send nudge')
    } finally {
      setBusy(null)
    }
  }

  async function call(userId: string, name: string) {
    if (busy) return
    setBusy(userId)
    try {
      const phone = await dialUser(userId)
      toast.success(`Calling ${name} · ${phone}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start call')
    } finally {
      setBusy(null)
    }
  }

  return { busy, nudge, call }
}
