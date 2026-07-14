import React from 'react'

const TRACKED_ROLES = ['field_agent', 'sales_rep', 'agent', 'team_lead']
const CONSENT_KEY = 'fv-presence-consent'

/**
 * One-time POPIA disclosure shown to tracked field roles before the first presence
 * sample. Acknowledging sets the consent flag and dispatches an event so the
 * heartbeat hook starts sampling without a reload.
 */
export default function PresenceConsentNotice({ role }: { role: string | undefined }) {
  const [dismissed, setDismissed] = React.useState(
    () => localStorage.getItem(CONSENT_KEY) === 'granted'
  )

  if (!role || !TRACKED_ROLES.includes(role) || dismissed) return null

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, 'granted')
    window.dispatchEvent(new Event('fv-presence-consent'))
    setDismissed(true)
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div className="max-w-md mx-auto bg-[#0A1628] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 p-4">
        <p className="text-sm text-gray-300 leading-relaxed">
          FieldVibe records your location during work hours to verify field presence,
          per your work policy. Continue?
        </p>
        <button
          onClick={accept}
          className="mt-3 w-full py-2.5 rounded-xl bg-gradient-to-br from-primary to-[#00D06E] text-[#0A1628] text-sm font-semibold active:scale-95 transition-transform"
        >
          I understand
        </button>
      </div>
    </div>
  )
}
