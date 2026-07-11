import React from 'react'
import { Bell, Check, X } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { requestPushPermission, sendTestPush } from '../../services/push'

// First-login help/tour, PWA-only (mounted in AgentLayout). Fires once per user
// on next login — gated by a per-user localStorage flag so it re-fires for a
// different account on a shared device. Content is role-tailored, not uniform:
// each role sees the tabs it actually has, ending in a shared notifications step.

type Step = { title: string; body: string; action?: 'notifications' }

const NOTIFY_STEP: Step = {
  title: 'Stay in the loop',
  body: 'Turn on notifications so you never miss an incoming call or a nudge — even when the app is closed. Try it now.',
  action: 'notifications',
}

const TOURS: Record<string, Step[]> = {
  team_lead: [
    { title: 'Welcome, Team Lead', body: 'Run your team from your phone. Here is the lay of the land.' },
    { title: 'Home', body: 'Your daily snapshot — targets, activity and anything that needs you.' },
    { title: 'Visits & New', body: 'Log a visit yourself with the green + button, or review the Visits tab.' },
    { title: 'Team', body: 'See every member, drill into an agent, and spot who is falling behind.' },
    NOTIFY_STEP,
  ],
  manager: [
    { title: 'Welcome, Manager', body: 'Oversee your teams on the go.' },
    { title: 'Home', body: 'Your snapshot — headline numbers and anything flagged for you.' },
    { title: 'Teams', body: 'Browse every team, drill into a team or an agent, and act on issues.' },
    { title: 'Stats', body: 'Track performance trends across your teams.' },
    NOTIFY_STEP,
  ],
  general_manager: [
    { title: 'Welcome, GM', body: 'The whole operation, from your pocket.' },
    { title: 'Overview', body: 'Company-wide health at a glance — coverage, activity and exceptions.' },
    { title: 'P&L', body: 'Revenue and cost lines so you can see the money, not just the motion.' },
    { title: 'Stats', body: 'Cross-company performance trends.' },
    NOTIFY_STEP,
  ],
  backoffice_admin: [
    { title: 'Welcome, Back Office', body: 'Reconcile and keep the books straight from here.' },
    { title: 'Reconcile', body: 'Match deposits to visits and clear what needs clearing.' },
    { title: 'Deposits', body: 'Review and confirm agent deposits.' },
    { title: 'Agents', body: 'Call an agent directly when something needs a human.' },
    NOTIFY_STEP,
  ],
  default: [
    { title: 'Welcome to FieldVibe', body: 'Everything you need for the field, in one place.' },
    { title: 'Home', body: 'Your day at a glance — today’s target and how you are tracking.' },
    { title: 'Log a visit', body: 'Tap the green + button to record a visit the moment it happens.' },
    { title: 'Stats', body: 'See your numbers — visits, sign-ups and conversion over time.' },
    NOTIFY_STEP,
  ],
}

function tourKey(userId: string) {
  return `fieldvibe_tour_seen_${userId}`
}

export default function FirstLoginTour() {
  const user = useAuthStore((s) => s.user)
  const [step, setStep] = React.useState(0)
  const [notifyState, setNotifyState] = React.useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  // Gate: render nothing once seen. Read lazily so it re-evaluates per user.
  const [open, setOpen] = React.useState(() => {
    if (!user?.id) return false
    return localStorage.getItem(tourKey(user.id)) !== 'true'
  })

  if (!open || !user?.id) return null

  const steps = TOURS[user.role] || TOURS.default
  const current = steps[step]
  const isLast = step === steps.length - 1

  const finish = () => {
    localStorage.setItem(tourKey(user.id), 'true')
    setOpen(false)
  }

  const testNotifications = async () => {
    requestPushPermission() // must run in this gesture (iOS)
    setNotifyState('sending')
    // Permission prompt may still be resolving; give it a beat, then try to deliver.
    setTimeout(async () => {
      const ok = await sendTestPush()
      setNotifyState(ok ? 'sent' : 'failed')
    }, 800)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#0A1628] border border-white/10 rounded-3xl p-6 shadow-2xl">
        {/* Progress dots + skip */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-6 bg-[#00E87B]' : 'w-1.5 bg-white/20'
                }`}
              />
            ))}
          </div>
          <button onClick={finish} className="p-2 -mr-2 text-gray-400 hover:text-white" aria-label="Skip tour">
            <X className="w-5 h-5" />
          </button>
        </div>

        <h2 className="text-xl font-semibold text-white mb-2">{current.title}</h2>
        <p className="text-gray-300 leading-relaxed">{current.body}</p>

        {current.action === 'notifications' && (
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
        )}

        <div className="flex items-center gap-3 mt-6">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 py-3 rounded-2xl border border-white/10 text-white font-medium"
            >
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
      </div>
    </div>
  )
}
