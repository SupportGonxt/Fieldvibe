import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export interface FABAction {
  id: string
  label: string
  icon: React.ReactNode
  href?: string
  onClick?: () => void
  color?: string
}

interface FloatingActionButtonProps {
  actions: FABAction[]
  mainIcon?: React.ReactNode
  position?: 'bottom-right' | 'bottom-center'
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  actions,
  mainIcon,
  position = 'bottom-right',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  const handleAction = (action: FABAction) => {
    if (action.href) navigate(action.href)
    if (action.onClick) action.onClick()
    setIsOpen(false)
  }

  const positionClasses = {
    'bottom-right': 'bottom-20 right-4 md:bottom-6 md:right-6',
    'bottom-center': 'bottom-20 left-1/2 -translate-x-1/2 md:bottom-6',
  }

  return (
    <div className={`fixed ${positionClasses[position]} z-30`}>
      {/* Action buttons */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 flex flex-col-reverse items-end gap-3 mb-2">
          {actions.map((action, idx) => (
            <div
              key={action.id}
              className="flex items-center gap-3 animate-in slide-in-from-bottom-2"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <span className="bg-white dark:bg-night-50 text-gray-700 dark:text-gray-300 text-sm font-medium px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                {action.label}
              </span>
              <button
                onClick={() => handleAction(action)}
                className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-110 ${action.color || 'bg-blue-500'}`}
              >
                {action.icon}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main FAB button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white transition-all duration-200 ${isOpen ? 'bg-gray-600 rotate-45' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {isOpen ? <X className="w-6 h-6" /> : (mainIcon || <Plus className="w-6 h-6" />)}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 -z-10" onClick={() => setIsOpen(false)} />
      )}
    </div>
  )
}
