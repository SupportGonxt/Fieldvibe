import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Play, Store, User, MapPin, Camera, CheckCircle, FileText,
  ChevronDown, ChevronUp, Navigation, Clock, AlertTriangle,
  Smartphone, BookOpen, Target, Shield, Wifi
} from 'lucide-react'

interface Section {
  id: string
  title: string
  icon: React.ElementType
  color: string
  steps: Array<{
    step: number
    title: string
    description: string
    icon: React.ElementType
    important?: boolean
  }>
}

const SECTIONS: Section[] = [
  {
    id: 'before',
    title: 'Before You Start',
    icon: Shield,
    color: 'text-blue-400 bg-blue-500/10',
    steps: [
      {
        step: 1,
        title: 'Check Your Phone',
        description: 'Make sure your phone is charged, has mobile data or Wi-Fi, and GPS/Location Services are turned ON in settings.',
        icon: Smartphone,
      },
      {
        step: 2,
        title: 'Log In to FieldVibe',
        description: 'Open the FieldVibe app and log in with your phone number and PIN. If this is your first time, your manager gave you these credentials.',
        icon: Shield,
      },
      {
        step: 3,
        title: 'Check Your Dashboard',
        description: 'Review your daily targets, assigned companies, and any pending visits. Plan your route for the day.',
        icon: Target,
      },
      {
        step: 4,
        title: 'Ensure Internet Connection',
        description: 'Visits require internet to sync. Make sure you have a stable connection before starting. You can see your connection status (Online/Offline) at the top of the dashboard.',
        icon: Wifi,
      },
    ],
  },
  {
    id: 'store-visit',
    title: 'How to Do a Store Visit',
    icon: Store,
    color: 'text-purple-400 bg-purple-500/10',
    steps: [
      {
        step: 1,
        title: 'Tap "Store Visit"',
        description: 'On your dashboard, tap the purple "Store Visit" button. Or tap the green "+" button at the bottom of the screen.',
        icon: Store,
      },
      {
        step: 2,
        title: 'Select Company',
        description: 'Choose which company this visit is for from the dropdown. You\'ll only see companies assigned to you by your manager.',
        icon: FileText,
      },
      {
        step: 3,
        title: 'Find or Register the Store',
        description: 'Search for the store name. If the store isn\'t listed, you can register it as a new store by filling in the name, address, and contact details.',
        icon: MapPin,
      },
      {
        step: 4,
        title: 'Allow GPS Location',
        description: 'When prompted, tap "Allow" for location access. Stand close to the store entrance. Your location is recorded to verify the visit.',
        icon: Navigation,
        important: true,
      },
      {
        step: 5,
        title: 'Fill in Visit Details',
        description: 'Complete the visit form — add notes about your visit, answer any survey questions that appear, and record relevant information.',
        icon: FileText,
      },
      {
        step: 6,
        title: 'Take Photos',
        description: 'If photo evidence is required, take clear photos of shelf displays, product placements, or board installations. Hold your phone steady.',
        icon: Camera,
      },
      {
        step: 7,
        title: 'Submit the Visit',
        description: 'Review your information, then tap "Submit Visit". The visit will sync to the server and appear in your visit history.',
        icon: CheckCircle,
      },
    ],
  },
  {
    id: 'individual-visit',
    title: 'How to Do an Individual Visit',
    icon: User,
    color: 'text-cyan-400 bg-cyan-500/10',
    steps: [
      {
        step: 1,
        title: 'Tap "Individual Visit"',
        description: 'On your dashboard, tap the blue "Individual Visit" button. This is for visiting people (customers, prospects, etc.).',
        icon: User,
      },
      {
        step: 2,
        title: 'Select Company',
        description: 'Choose which company this visit is for from the dropdown list.',
        icon: FileText,
      },
      {
        step: 3,
        title: 'Find or Register the Person',
        description: 'Search by name or phone number. If they\'re not in the system, register them with their name, phone, and ID number.',
        icon: MapPin,
      },
      {
        step: 4,
        title: 'Allow GPS Location',
        description: 'Tap "Allow" for location access. Your GPS position is recorded when you check in.',
        icon: Navigation,
        important: true,
      },
      {
        step: 5,
        title: 'Complete the Form',
        description: 'Fill in the visit details, answer survey questions, and add any notes about the interaction.',
        icon: FileText,
      },
      {
        step: 6,
        title: 'Take Photos if Needed',
        description: 'Some visits require photo proof. Follow the on-screen prompts for what photos are needed.',
        icon: Camera,
      },
      {
        step: 7,
        title: 'Submit',
        description: 'Tap "Submit Visit" to complete. The visit syncs automatically and counts towards your daily targets.',
        icon: CheckCircle,
      },
    ],
  },
  {
    id: 'common-issues',
    title: 'Common Issues & Solutions',
    icon: AlertTriangle,
    color: 'text-amber-400 bg-amber-500/10',
    steps: [
      {
        step: 1,
        title: 'GPS Not Working',
        description: 'Go to your phone Settings > Location and make sure it\'s ON. Open Google Maps first to get a GPS fix, then try again in FieldVibe.',
        icon: Navigation,
        important: true,
      },
      {
        step: 2,
        title: '"Too Far From Location" Error',
        description: 'You need to be physically close to the store/person. Walk closer and try again. If the store address is wrong, report it to your team lead.',
        icon: MapPin,
      },
      {
        step: 3,
        title: 'Visit Won\'t Submit',
        description: 'Check your internet connection. Make sure all required fields (marked with *) are filled in. Try moving to an area with better signal.',
        icon: Wifi,
      },
      {
        step: 4,
        title: 'Camera Not Working',
        description: 'Make sure you\'ve allowed camera access when prompted. Go to phone Settings > Apps > FieldVibe > Permissions > Camera > Allow.',
        icon: Camera,
      },
      {
        step: 5,
        title: 'Forgot PIN',
        description: 'Contact your manager or team lead. They can reset your PIN from the admin panel. Default PIN is 12345.',
        icon: Shield,
      },
      {
        step: 6,
        title: 'App Shows "Offline"',
        description: 'Check your mobile data or Wi-Fi connection. Try turning airplane mode on and off. Restart the app if needed.',
        icon: Wifi,
      },
    ],
  },
  {
    id: 'best-practices',
    title: 'Best Practices',
    icon: Target,
    color: 'text-emerald-400 bg-emerald-500/10',
    steps: [
      {
        step: 1,
        title: 'Start Early',
        description: 'Log in first thing in the morning and review your targets. Plan your route to visit stores efficiently.',
        icon: Clock,
      },
      {
        step: 2,
        title: 'Complete Visits Immediately',
        description: 'Submit each visit as you complete it. Don\'t wait until the end of the day — this ensures accurate time stamps and GPS data.',
        icon: CheckCircle,
        important: true,
      },
      {
        step: 3,
        title: 'Take Quality Photos',
        description: 'Clear, well-lit photos help verify your work. Take photos before and after any changes (shelf displays, boards, etc.).',
        icon: Camera,
      },
      {
        step: 4,
        title: 'Add Detailed Notes',
        description: 'Write brief but useful notes for each visit — what was discussed, any issues, follow-up needed.',
        icon: FileText,
      },
      {
        step: 5,
        title: 'Monitor Your Progress',
        description: 'Check the Stats tab regularly to see your daily and monthly performance against targets.',
        icon: Target,
      },
      {
        step: 6,
        title: 'Stay Secure',
        description: 'Change your default PIN, don\'t share it with anyone, and always log out when done for the day.',
        icon: Shield,
      },
    ],
  },
]

export default function AgentTrainingGuide() {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState<string | null>('before')

  const toggleSection = (id: string) => {
    setExpanded(expanded === id ? null : id)
  }

  return (
    <div className="min-h-screen bg-[#06090F] pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#0A1628] to-[#0F2140] px-5 pt-5 pb-6">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#00E87B]" />
            Training Guide
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">How to complete visits in FieldVibe</p>
        </div>

        {/* Quick action */}
        <button
          onClick={() => navigate('/agent/onboarding')}
          className="w-full py-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2 active:bg-white/10 transition-colors"
        >
          <Play className="w-4 h-4 text-[#00E87B]" />
          <span className="text-sm text-white font-medium">View Step-by-Step Onboarding</span>
        </button>
      </div>

      {/* Sections */}
      <div className="px-5 pt-4 space-y-3">
        {SECTIONS.map((section) => {
          const isOpen = expanded === section.id
          const SectionIcon = section.icon
          return (
            <div key={section.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full px-4 py-4 flex items-center gap-3 active:bg-white/5 transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${section.color}`}>
                  <SectionIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-white">{section.title}</p>
                  <p className="text-xs text-gray-500">{section.steps.length} steps</p>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-3">
                  <div className="h-px bg-white/5" />
                  {section.steps.map((stepItem) => {
                    const StepIcon = stepItem.icon
                    return (
                      <div key={stepItem.step} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            stepItem.important ? 'bg-amber-500/20' : 'bg-white/5'
                          }`}>
                            <span className={`text-xs font-bold ${
                              stepItem.important ? 'text-amber-400' : 'text-gray-400'
                            }`}>{stepItem.step}</span>
                          </div>
                          {stepItem.step < section.steps.length && (
                            <div className="w-px flex-1 bg-white/5 mt-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-3">
                          <div className="flex items-center gap-2 mb-1">
                            <StepIcon className={`w-3.5 h-3.5 ${
                              stepItem.important ? 'text-amber-400' : 'text-gray-400'
                            }`} />
                            <p className={`text-sm font-medium ${
                              stepItem.important ? 'text-amber-300' : 'text-white'
                            }`}>
                              {stepItem.title}
                              {stepItem.important && (
                                <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">Important</span>
                              )}
                            </p>
                          </div>
                          <p className="text-xs text-gray-400 leading-relaxed">{stepItem.description}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom CTA */}
      <div className="px-5 pt-6">
        <button
          onClick={() => navigate('/agent/visits/create')}
          className="w-full py-3.5 bg-gradient-to-r from-[#00E87B] to-[#00D06E] text-[#0A1628] font-bold rounded-2xl shadow-lg shadow-[#00E87B]/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <Play className="w-4 h-4" />
          Start Your First Visit
        </button>
      </div>
    </div>
  )
}
