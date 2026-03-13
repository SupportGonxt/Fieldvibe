import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { HelpCircle, X, ChevronRight, BookOpen, Lightbulb, CheckCircle, Play } from 'lucide-react'
import { getHelpContent, HelpContent, TrainingStep } from '../../config/helpContent'

interface HelpPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function HelpPanel({ isOpen, onClose }: HelpPanelProps) {
  const location = useLocation()
  const [activeTab, setActiveTab] = useState<'help' | 'training'>('help')
  const [completedSteps, setCompletedSteps] = useState<number[]>([])

  const helpContent = getHelpContent(location.pathname)

  if (!isOpen) return null

  const toggleStepComplete = (step: number) => {
    setCompletedSteps(prev => 
      prev.includes(step) 
        ? prev.filter(s => s !== step)
        : [...prev, step]
    )
  }

  const renderHelpTab = (content: HelpContent) => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{content.title}</h3>
        <p className="text-sm text-gray-600">{content.description}</p>
      </div>

      <div>
        <h4 className="flex items-center text-sm font-medium text-gray-900 mb-2">
          <Play className="h-4 w-4 mr-2 text-blue-500" />
          Quick Start
        </h4>
        <ul className="space-y-1">
          {content.quickStart.map((item, index) => (
            <li key={index} className="flex items-start text-sm text-gray-600">
              <ChevronRight className="h-4 w-4 mr-1 mt-0.5 text-gray-400 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="flex items-center text-sm font-medium text-gray-900 mb-2">
          <BookOpen className="h-4 w-4 mr-2 text-green-500" />
          Key Features
        </h4>
        <ul className="space-y-1">
          {content.keyFeatures.map((item, index) => (
            <li key={index} className="flex items-start text-sm text-gray-600">
              <CheckCircle className="h-4 w-4 mr-1 mt-0.5 text-green-400 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="flex items-center text-sm font-medium text-gray-900 mb-2">
          <Lightbulb className="h-4 w-4 mr-2 text-yellow-500" />
          Tips
        </h4>
        <ul className="space-y-1">
          {content.tips.map((item, index) => (
            <li key={index} className="flex items-start text-sm text-gray-600">
              <span className="text-yellow-500 mr-1">*</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )

  const renderTrainingTab = (steps: TrainingStep[]) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Training Steps</h3>
        <span className="text-sm text-gray-500">
          {completedSteps.length} / {steps.length} completed
        </span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${(completedSteps.length / steps.length) * 100}%` }}
        />
      </div>

      <div className="space-y-3">
        {steps.map((step) => (
          <div 
            key={step.step}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              completedSteps.includes(step.step)
                ? 'bg-green-50 border-green-200'
                : 'bg-white border-gray-100 hover:border-blue-300'
            }`}
            onClick={() => toggleStepComplete(step.step)}
          >
            <div className="flex items-start">
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
                completedSteps.includes(step.step)
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-100 text-blue-600'
              }`}>
                {completedSteps.includes(step.step) ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-medium">{step.step}</span>
                )}
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900">{step.title}</h4>
                <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                {step.action && (
                  <p className="text-xs text-blue-600 mt-1 font-medium">
                    Action: {step.action}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {completedSteps.length === steps.length && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
          <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-green-800">Training Complete!</p>
          <p className="text-xs text-green-600">You've completed all training steps for this module.</p>
        </div>
      )}
    </div>
  )

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="flex items-center text-white">
          <HelpCircle className="h-5 w-5 mr-2" />
          <span className="font-semibold">Help & Training</span>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:bg-white/20 rounded p-1 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {helpContent ? (
        <>
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setActiveTab('help')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'help'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Help Guide
            </button>
            <button
              onClick={() => setActiveTab('training')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'training'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Training
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'help' && renderHelpTab(helpContent)}
            {activeTab === 'training' && helpContent.trainingSteps && renderTrainingTab(helpContent.trainingSteps)}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <HelpCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              No help content available for this page.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Navigate to a module to see help and training content.
            </p>
          </div>
        </div>
      )}

      <div className="p-4 border-t border-gray-100 bg-surface-secondary">
        <p className="text-xs text-gray-500 text-center">
          Need more help? Contact support at support@fieldvibe.com
        </p>
      </div>
    </div>
  )
}
