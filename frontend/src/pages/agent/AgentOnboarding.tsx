import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Phone, Lock, MapPin, Store, User, Camera, CheckCircle,
  ChevronRight, ChevronLeft, ArrowRight, Smartphone, Shield,
  Target, BarChart3, Clock, Navigation, FileText, Play
} from 'lucide-react'

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to FieldVibe',
    subtitle: 'Your mobile field operations companion',
    icon: Smartphone,
    color: 'from-[#00E87B] to-[#00D06E]',
    content: [
      'FieldVibe helps you manage your daily visits, track performance, and stay connected with your team.',
      'This quick guide will walk you through everything you need to know to get started.',
    ],
    tips: [],
  },
  {
    id: 'login',
    title: 'Logging In',
    subtitle: 'Access your agent account',
    icon: Lock,
    color: 'from-blue-500 to-blue-600',
    content: [
      'Your manager will provide you with your phone number and a PIN code.',
      'Go to the Agent Login page and enter your phone number (starting with +27) and your PIN (4-6 digits).',
    ],
    tips: [
      'Default PIN is usually 12345 — change it after your first login',
      'Use "Change PIN" in your Profile tab to set a new PIN',
      'If you forget your PIN, ask your manager to reset it',
    ],
  },
  {
    id: 'dashboard',
    title: 'Your Dashboard',
    subtitle: 'Everything at a glance',
    icon: Target,
    color: 'from-purple-500 to-purple-600',
    content: [
      'After logging in, you\'ll see your dashboard with today\'s stats, daily targets, and recent visits.',
      'The dashboard shows your visit count, registration count, and progress towards daily targets for each company.',
    ],
    tips: [
      'Pull down to refresh your dashboard data',
      'Tap "View All" to see your complete visit history',
      'Green progress bars show how close you are to your targets',
    ],
  },
  {
    id: 'store-visit',
    title: 'Store Visits',
    subtitle: 'How to complete a store visit',
    icon: Store,
    color: 'from-purple-600 to-pink-500',
    content: [
      'Store visits are for shops and businesses. Tap the "Store Visit" button on your dashboard to start.',
    ],
    tips: [
      'Step 1: Select the company you are visiting for',
      'Step 2: Search for the store or register a new one',
      'Step 3: Allow GPS location — you must be within range of the store',
      'Step 4: Fill in the visit details and any survey questions',
      'Step 5: Take photos as required (shelves, boards, etc.)',
      'Step 6: Submit the visit — it will sync automatically',
    ],
  },
  {
    id: 'individual-visit',
    title: 'Individual Visits',
    subtitle: 'How to complete an individual visit',
    icon: User,
    color: 'from-cyan-500 to-blue-500',
    content: [
      'Individual visits are for people (customers, prospects). Tap the "Individual Visit" button to start.',
    ],
    tips: [
      'Step 1: Select the company you are visiting for',
      'Step 2: Search for the individual or register a new one',
      'Step 3: Allow GPS location for check-in',
      'Step 4: Fill in the visit details and survey responses',
      'Step 5: Take any required photos',
      'Step 6: Submit when done',
    ],
  },
  {
    id: 'gps',
    title: 'GPS & Location',
    subtitle: 'Why location matters',
    icon: Navigation,
    color: 'from-emerald-500 to-teal-500',
    content: [
      'FieldVibe uses GPS to verify your visits. You must allow location access when prompted.',
      'Your check-in location is recorded to confirm you were at the right place.',
    ],
    tips: [
      'Make sure Location Services are ON in your phone settings',
      'Allow FieldVibe to access your location "While Using the App"',
      'Stand close to the store/individual before checking in',
      'If GPS is weak, move to an open area and wait a moment',
    ],
  },
  {
    id: 'photos',
    title: 'Taking Photos',
    subtitle: 'Photo evidence for visits',
    icon: Camera,
    color: 'from-amber-500 to-orange-500',
    content: [
      'Some visits require photos as proof — shelf displays, product placements, board installations, etc.',
      'Make sure photos are clear, well-lit, and show the required items.',
    ],
    tips: [
      'Hold your phone steady and ensure good lighting',
      'Take photos before and after any changes you make',
      'Photos are compressed automatically to save data',
      'Each visit may require different photo types — follow the prompts',
    ],
  },
  {
    id: 'performance',
    title: 'Track Performance',
    subtitle: 'Your stats & achievements',
    icon: BarChart3,
    color: 'from-pink-500 to-rose-500',
    content: [
      'Use the Stats tab to see your performance metrics — visits completed, registrations, and target achievement.',
      'Your manager can see your stats too, so keep your numbers up!',
    ],
    tips: [
      'Check your stats daily to stay on track',
      'The progress ring shows your overall target achievement',
      'Company breakdowns show visits and registrations per company',
    ],
  },
  {
    id: 'tips',
    title: 'Pro Tips',
    subtitle: 'Get the most out of FieldVibe',
    icon: Shield,
    color: 'from-indigo-500 to-violet-500',
    content: [
      'Follow these best practices to be a top-performing agent:',
    ],
    tips: [
      'Start your day by checking your dashboard for targets',
      'Complete visits as you go — don\'t save them for later',
      'Always allow GPS and take clear photos',
      'Change your default PIN for security',
      'Check your Stats tab regularly to track progress',
      'Log out when you\'re done for the day',
      'Contact your team lead if you have issues',
    ],
  },
  {
    id: 'ready',
    title: 'You\'re Ready!',
    subtitle: 'Start making visits',
    icon: CheckCircle,
    color: 'from-[#00E87B] to-[#00D06E]',
    content: [
      'You now know everything you need to get started with FieldVibe.',
      'Head to your dashboard and start your first visit. Good luck!',
    ],
    tips: [],
  },
]

export default function AgentOnboarding() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)

  const step = STEPS[currentStep]
  const isFirst = currentStep === 0
  const isLast = currentStep === STEPS.length - 1
  const Icon = step.icon

  const goNext = () => {
    if (isLast) {
      localStorage.setItem('fieldvibe_onboarding_complete', 'true')
      navigate('/agent/dashboard')
    } else {
      setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1))
    }
  }

  const goBack = () => {
    setCurrentStep((s) => Math.max(s - 1, 0))
  }

  const skip = () => {
    localStorage.setItem('fieldvibe_onboarding_complete', 'true')
    navigate('/agent/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#06090F] flex flex-col">
      {/* Progress bar */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= currentStep ? 'bg-[#00E87B]' : 'bg-white/10'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-gray-500">Step {currentStep + 1} of {STEPS.length}</span>
          {!isLast && (
            <button onClick={skip} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Skip Guide
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 pt-4 pb-6 flex flex-col">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className={`w-20 h-20 bg-gradient-to-br ${step.color} rounded-3xl flex items-center justify-center shadow-lg`}>
            <Icon className="w-10 h-10 text-white" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">{step.title}</h1>
          <p className="text-sm text-gray-400">{step.subtitle}</p>
        </div>

        {/* Content */}
        <div className="space-y-3 mb-6">
          {step.content.map((text, i) => (
            <p key={i} className="text-sm text-gray-300 leading-relaxed text-center">
              {text}
            </p>
          ))}
        </div>

        {/* Tips */}
        {step.tips.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2.5 mb-6">
            {step.tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-[#00E87B]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ChevronRight className="w-3 h-3 text-[#00E87B]" />
                </div>
                <p className="text-sm text-gray-300">{tip}</p>
              </div>
            ))}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Navigation buttons */}
        <div className="flex gap-3">
          {!isFirst && (
            <button
              onClick={goBack}
              className="px-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white font-medium flex items-center gap-2 active:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <button
            onClick={goNext}
            className={`flex-1 py-3.5 bg-gradient-to-r ${step.color} text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform`}
          >
            {isLast ? (
              <>
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
