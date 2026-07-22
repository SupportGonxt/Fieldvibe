import { apiClient } from './api.service'

// GSM dial-out: resolve the agent's phone number via the API (which also logs
// the attempt for call history / daily targets), then open the device's dialer
// with the number pre-filled. The actual call runs on the carrier network, so
// it reaches agents with no data. Returns the number so callers can show it —
// useful on desktop browsers, where tel: often has no handler.
export async function dialUser(userId: string): Promise<string> {
  let data: { success?: boolean; phone?: string; message?: string }
  try {
    const res = await apiClient.post('/field-ops/calls/dial', { callee_id: userId })
    data = res.data
  } catch (err) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    throw new Error(msg || 'Could not start the call')
  }
  if (!data?.phone) throw new Error(data?.message || 'No phone number on file for this agent')
  window.location.href = `tel:${data.phone.replace(/[^+\d]/g, '')}`
  return data.phone
}
