import { useNavigate } from 'react-router-dom'
import { Monitor, Smartphone, ArrowRight } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { fieldHome, officeHome } from '../../utils/workspace'

// Landing screen for roles that can use both surfaces. Not remembered by
// design: it's just the default landing — direct URLs (/dashboard, /agent/*)
// still work, so a bookmark is the "remember this" escape hatch.
export default function ChooseWorkspace() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const role = user?.role

  const options = [
    {
      key: 'office',
      title: 'Back Office',
      desc: 'Full dashboard — reports, insights, admin, team management.',
      icon: Monitor,
      to: officeHome(role),
    },
    {
      key: 'field',
      title: 'Field App',
      desc: 'The mobile field workspace — visits, reconcile, on-the-ground work.',
      icon: Smartphone,
      to: fieldHome(role),
    },
  ]

  return (
    <div className="min-h-screen bg-[#06090F] text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Where to?</h1>
          <p className="mt-2 text-sm text-white/60">
            {user?.first_name ? `Welcome back, ${user.first_name}. ` : ''}
            Pick a workspace — you can switch any time.
          </p>
        </div>

        <div className="space-y-3">
          {options.map((o) => {
            const Icon = o.icon
            return (
              <button
                key={o.key}
                onClick={() => navigate(o.to, { replace: true })}
                className="group flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-primary/60 hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{o.title}</span>
                  <span className="block text-xs text-white/50">{o.desc}</span>
                </span>
                <ArrowRight size={18} className="shrink-0 text-white/30 transition group-hover:text-primary" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
