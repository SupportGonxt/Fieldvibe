import React from 'react'
import { Bell, Check, X } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { requestPushPermission, sendTestPush } from '../../services/push'

// First-login guided tour, PWA-only (mounted in AgentLayout). Fires once per user
// on next login — gated by a per-user localStorage flag. Instead of a text sheet it
// spotlights the real bottom-nav tabs one by one (dim the screen, cut a hole over the
// live element, point a tooltip at it), so it adapts to whatever tabs the user's role
// actually shows. Opens with a welcome, ends with an enable-notifications step.

// What each tab does. Keyed by route; falls back to the tab's own label.
const TAB_HELP: Record<string, string> = {
  '/agent/dashboard': 'Home base — your target for the day and how you’re tracking.',
  '/agent/overview': 'Overview — company-wide health at a glance: coverage, activity, exceptions.',
  '/agent/visits': 'Visits — everything you’ve logged, newest first.',
  '/agent/visits/create': 'The big green button — tap it to log a visit the moment it happens.',
  '/agent/team': 'Team — your members, and who needs a nudge.',
  '/agent/teams': 'Teams — drill into any team or agent and act on issues.',
  '/agent/stats': 'Stats — your numbers over time: visits, sign-ups, conversion.',
  '/agent/pnl': 'P&L — the money: revenue and cost lines, not just activity.',
  '/agent/reconcile': 'Reconcile — match deposits to visits and clear what’s outstanding.',
  '/agent/deposits': 'Deposits — review and confirm agent deposits.',
  '/agent/call-list': 'Agents — call an agent directly when something needs a human.',
  '/agent/profile': 'Profile — your account, settings and sign-out.',
}

const GREETING: Record<string, string> = {
  team_lead: 'Welcome, Team Lead',
  manager: 'Welcome, Manager',
  general_manager: 'Welcome, GM',
  backoffice_admin: 'Welcome, Back Office',
}

type Frame =
  | { kind: 'welcome' }
  | { kind: 'tab'; path: string; label: string }
  | { kind: 'notify' }

function tourKey(userId: string) {
  return `fieldvibe_tour_seen_${userId}`
}

export default function FirstLoginTour() {
  const user = useAuthStore((s) => s.user)
  const [step, setStep] = React.useState(0)
  const [frames, setFrames] = React.useState<Frame[]>([])
  const [rect, setRect] = React.useState<DOMRect | null>(null)
  const [notifyState, setNotifyState] = React.useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [open, setOpen] = React.useState(() => {
    if (!user?.id) return false
    return localStorage.getItem(tourKey(user.id)) !== 'true'
  })

  // Build the frame list from the nav tabs actually rendered for this role.
  // Runs after mount so the nav is in the DOM. If nav is absent (e.g. mounted on a
  // sub-page), we still show welcome + notify.
  React.useEffect(() => {
    if (!open) return
    const els = Array.from(document.querySelectorAll<HTMLElement>('nav [data-tour]'))
    const tabFrames: Frame[] = els.map((el) => ({
      kind: 'tab',
      path: el.dataset.tour || '',
      label: el.dataset.tourLabel || '',
    }))
    setFrames([{ kind: 'welcome' }, ...tabFrames, { kind: 'notify' }])
  }, [open])

  const current = frames[step]

  // Measure the highlighted element for the current step. Re-measure on resize.
  React.useLayoutEffect(() => {
    if (current?.kind !== 'tab') { setRect(null); return }
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`nav [data-tour="${current.path}"]`)
      setRect(el ? el.getBoundingClientRect() : null)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [current])

  if (!open || !user?.id || !frames.length || !current) return null

  const isLast = step === frames.length - 1

  const finish = () => {
    localStorage.setItem(tourKey(user.id), 'true')
    setOpen(false)
  }

  const testNotifications = () => {
    requestPushPermission() // must run in this gesture (iOS)
    setNotifyState('sending')
    setTimeout(async () => {
      const ok = await sendTestPush()
      setNotifyState(ok ? 'sent' : 'failed')
    }, 800)
  }

  const dots = (
    <div className="flex gap-1.5">
      {frames.map((_, i) => (
        <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-[#00E87B]' : 'w-1.5 bg-white/20'}`} />
      ))}
    </div>
  )

  const nav = (
    <div className="flex items-center gap-3 mt-5">
      {step > 0 && (
        <button onClick={() => setStep((s) => s - 1)} className="flex-1 py-3 rounded-2xl border border-white/10 text-white font-medium">
          Back
        </button>
      )}
      <button
        onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
        className="flex-1 py-3 rounded-2xl bg-[#00E87B] text-[#0A1628] font-semibold"
      >
        {isLast ? 'Get started' : 'Next'}
      </button>
    </div>
  )

  const skip = (
    <button onClick={finish} className="p-2 -mr-2 text-gray-400 hover:text-white" aria-label="Skip tour">
      <X className="w-5 h-5" />
    </button>
  )

  // --- Spotlight step: dim the screen, cut a hole over the live tab, tooltip above it.
  if (current.kind === 'tab' && rect) {
    const pad = 6
    return (
      <div className="fixed inset-0 z-[60]">
        {/* Cutout: a box the size of the target with a huge shadow spread dims everything else. */}
        <div
          className="absolute rounded-2xl ring-2 ring-[#00E87B] transition-all duration-200"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.78)',
          }}
        />
        {/* Tooltip floats just above the nav bar. */}
        <div
          className="absolute left-4 right-4 bg-[#0A1628] border border-white/10 rounded-3xl p-5 shadow-2xl"
          style={{ bottom: window.innerHeight - rect.top + 16 }}
        >
          <div className="flex items-center justify-between mb-3">
            {dots}
            {skip}
          </div>
          <h2 className="text-lg font-semibold text-white mb-1">{current.label}</h2>
          <p className="text-gray-300 leading-relaxed">{TAB_HELP[current.path] || `Open ${current.label}.`}</p>
          {nav}
        </div>
      </div>
    )
  }

  // --- Centered card: welcome / notify (and the fallback if a tab couldn't be measured).
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/78 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#0A1628] border border-white/10 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          {dots}
          {skip}
        </div>

        {current.kind === 'notify' ? (
          <>
            <h2 className="text-xl font-semibold text-white mb-2">Stay in the loop</h2>
            <p className="text-gray-300 leading-relaxed">
              Turn on notifications so you never miss an incoming call or a nudge — even when the app is closed. Try it now.
            </p>
            <button
              onClick={testNotifications}
              disabled={notifyState === 'sending' || notifyState === 'sent'}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#00E87B]/15 border border-[#00E87B]/40 text-[#00E87B] font-medium disabled:opacity-60"
            >
              {notifyState === 'sent' ? <Check className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
              {notifyState === 'idle' && 'Enable & send test'}
              {notifyState === 'sending' && 'Sending…'}
              {notifyState === 'sent' && 'Sent — check your notifications'}
              {notifyState === 'failed' && 'Retry (allow notifications)'}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-white mb-2">{GREETING[user.role] || 'Welcome to FieldVibe'}</h2>
            <p className="text-gray-300 leading-relaxed">
              Quick tour — we’ll point out what each button does. Takes ten seconds.
            </p>
          </>
        )}

        {nav}
      </div>
    </div>
  )
}
