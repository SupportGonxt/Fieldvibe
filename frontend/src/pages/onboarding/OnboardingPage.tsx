import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../../services/api.service'

interface OnboardingStep {
  id: string
  title: string
  description: string
  completed: boolean
  action: string
  route: string
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [steps, setSteps] = useState<OnboardingStep[]>([
    { id: 'profile', title: 'Complete Your Profile', description: 'Set up your name, role, and contact details', completed: false, action: 'Go to Profile', route: '/settings/profile' },
    { id: 'company', title: 'Configure Company', description: 'Add your company name, logo, and business details', completed: false, action: 'Company Settings', route: '/admin/settings' },
    { id: 'customers', title: 'Add Your First Customer', description: 'Import or manually add your customer database', completed: false, action: 'Add Customer', route: '/customers/create' },
    { id: 'products', title: 'Set Up Products', description: 'Add your product catalog with pricing', completed: false, action: 'Add Product', route: '/products/create' },
    { id: 'warehouse', title: 'Configure Warehouse', description: 'Set up your warehouse and initial stock levels', completed: false, action: 'Warehouse Setup', route: '/inventory' },
    { id: 'agents', title: 'Invite Team Members', description: 'Add field agents, managers, and other team members', completed: false, action: 'Invite Users', route: '/admin/users' },
    { id: 'territory', title: 'Define Territories', description: 'Set up geographic territories and assign agents', completed: false, action: 'Setup Territories', route: '/admin/territory-management' },
    { id: 'first_order', title: 'Create First Order', description: 'Place a test sales order to verify the workflow', completed: false, action: 'Create Order', route: '/orders/create' },
  ])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetchProgress()
  }, [])

  const fetchProgress = async () => {
    try {
      const res = await apiClient.get('/onboarding/progress')
      const data = res.data as { completed_steps?: string[] }
      if (data.completed_steps) {
        setSteps(prev => prev.map(s => ({
          ...s,
          completed: data.completed_steps!.includes(s.id)
        })))
      }
    } catch { /* use defaults */ }
    setLoading(false)
  }

  const markComplete = async (stepId: string) => {
    try {
      await apiClient.post('/onboarding/complete-step', { step_id: stepId })
      setSteps(prev => prev.map(s => s.id === stepId ? { ...s, completed: true } : s))
    } catch { /* ignore */ }
  }

  const completedCount = steps.filter(s => s.completed).length
  const progressPct = Math.round((completedCount / steps.length) * 100)

  if (dismissed) return null
  if (loading) return <div className="p-6 text-center text-gray-400">Loading onboarding...</div>

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" role="main" aria-label="Onboarding Setup">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Welcome to FieldVibe</h1>
          <p className="text-gray-400 mt-1">Complete these steps to get your distribution operation running</p>
        </div>
        <button onClick={() => setDismissed(true)} className="text-gray-400 hover:text-gray-300 text-sm" aria-label="Dismiss onboarding">Skip for now</button>
      </div>

      {/* Progress bar */}
      <div className="bg-[#0A0E18] border border-[#1a1f2e] rounded-lg p-4">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium">{completedCount} of {steps.length} completed</span>
          <span className="text-sm text-[#00E87B] font-medium">{progressPct}%</span>
        </div>
        <div className="w-full bg-[#1a1f2e] rounded-full h-3">
          <div className="bg-[#00E87B] h-3 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div key={step.id} className={`bg-[#0A0E18] border rounded-lg p-4 flex items-center justify-between ${step.completed ? 'border-green-800/50' : 'border-[#1a1f2e]'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step.completed ? 'bg-green-900/40 text-green-400' : 'bg-[#1a1f2e] text-gray-400'}`}>
                {step.completed ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <div>
                <div className={`font-medium ${step.completed ? 'text-gray-500 line-through' : ''}`}>{step.title}</div>
                <div className="text-sm text-gray-400">{step.description}</div>
              </div>
            </div>
            {!step.completed && (
              <div className="flex gap-2">
                <button onClick={() => navigate(step.route)} className="px-4 py-2 bg-[#00E87B] text-black rounded-lg text-sm font-medium hover:bg-[#00d06e]" aria-label={step.action}>
                  {step.action}
                </button>
                <button onClick={() => markComplete(step.id)} className="px-3 py-2 border border-gray-600 rounded-lg text-sm hover:bg-gray-800" aria-label="Mark as done">Done</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {completedCount === steps.length && (
        <div className="bg-green-900/20 border border-green-800 rounded-lg p-6 text-center">
          <h2 className="text-xl font-bold text-green-400 mb-2">Setup Complete!</h2>
          <p className="text-gray-300 mb-4">Your FieldVibe account is ready. Start managing your field operations.</p>
          <button onClick={() => navigate('/dashboard')} className="px-6 py-2 bg-[#00E87B] text-black rounded-lg font-medium hover:bg-[#00d06e]">Go to Dashboard</button>
        </div>
      )}
    </div>
  )
}
