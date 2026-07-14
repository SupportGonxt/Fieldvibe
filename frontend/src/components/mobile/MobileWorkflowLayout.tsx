import { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface MobileWorkflowLayoutProps {
  children: ReactNode
  title: string
  currentStep: number
  totalSteps: number
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  backLabel?: string
  nextDisabled?: boolean
  showProgress?: boolean
}

export default function MobileWorkflowLayout({
  children,
  title,
  currentStep,
  totalSteps,
  onBack,
  onNext,
  nextLabel = 'Next',
  backLabel = 'Back',
  nextDisabled = false,
  showProgress = true,
}: MobileWorkflowLayoutProps) {
  const progressPercentage = ((currentStep + 1) / totalSteps) * 100

  return (
    <div className="min-h-screen bg-surface-secondary flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        {showProgress && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Step {currentStep + 1} of {totalSteps}</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-info-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {children}
      </div>

      {/* Footer Actions */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 sticky bottom-0 z-10">
        <div className="flex gap-3">
          {onBack && currentStep > 0 && (
            <button
              onClick={onBack}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-surface-secondary active:bg-gray-100 transition-colors touch-manipulation"
            >
              <ChevronLeft className="h-5 w-5" />
              {backLabel}
            </button>
          )}
          {onNext && (
            <button
              onClick={onNext}
              disabled={nextDisabled}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-info-600 text-white rounded-lg font-medium hover:bg-info-700 active:bg-info-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              {nextLabel}
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
