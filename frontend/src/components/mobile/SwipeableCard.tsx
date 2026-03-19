import React, { useRef, useState, useCallback } from 'react'
import { Trash2, Edit, CheckCircle, Eye } from 'lucide-react'

export interface SwipeAction {
  id: string
  label: string
  icon: React.ReactNode
  color: string
  handler: () => void
}

interface SwipeableCardProps {
  children: React.ReactNode
  leftActions?: SwipeAction[]
  rightActions?: SwipeAction[]
  className?: string
  threshold?: number
}

export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  leftActions = [],
  rightActions = [],
  className = '',
  threshold = 80,
}) => {
  const [translateX, setTranslateX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)
  const currentXRef = useRef(0)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX
    currentXRef.current = 0
    setIsDragging(true)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return
    const deltaX = e.touches[0].clientX - startXRef.current
    currentXRef.current = deltaX

    const maxSwipe = 150
    if (deltaX > 0 && leftActions.length > 0) {
      setTranslateX(Math.min(deltaX, maxSwipe))
    } else if (deltaX < 0 && rightActions.length > 0) {
      setTranslateX(Math.max(deltaX, -maxSwipe))
    }
  }, [isDragging, leftActions.length, rightActions.length])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
    const deltaX = currentXRef.current

    if (deltaX > threshold && leftActions.length > 0) {
      leftActions[0].handler()
    } else if (deltaX < -threshold && rightActions.length > 0) {
      rightActions[0].handler()
    }
    setTranslateX(0)
  }, [threshold, leftActions, rightActions])

  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`}>
      {/* Left actions background */}
      {leftActions.length > 0 && translateX > 0 && (
        <div className="absolute inset-y-0 left-0 flex items-center px-4 gap-2" style={{ width: `${Math.abs(translateX)}px` }}>
          {leftActions.map(action => (
            <button
              key={action.id}
              onClick={action.handler}
              className={`flex flex-col items-center gap-1 text-white text-xs font-medium ${action.color} p-2 rounded-lg`}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Right actions background */}
      {rightActions.length > 0 && translateX < 0 && (
        <div className="absolute inset-y-0 right-0 flex items-center justify-end px-4 gap-2" style={{ width: `${Math.abs(translateX)}px` }}>
          {rightActions.map(action => (
            <button
              key={action.id}
              onClick={action.handler}
              className={`flex flex-col items-center gap-1 text-white text-xs font-medium ${action.color} p-2 rounded-lg`}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main content */}
      <div
        className="relative bg-white dark:bg-night-50 transition-transform"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}

export const defaultSwipeActions = {
  delete: (handler: () => void): SwipeAction => ({
    id: 'delete',
    label: 'Delete',
    icon: <Trash2 className="w-5 h-5" />,
    color: 'bg-red-500',
    handler,
  }),
  edit: (handler: () => void): SwipeAction => ({
    id: 'edit',
    label: 'Edit',
    icon: <Edit className="w-5 h-5" />,
    color: 'bg-blue-500',
    handler,
  }),
  approve: (handler: () => void): SwipeAction => ({
    id: 'approve',
    label: 'Approve',
    icon: <CheckCircle className="w-5 h-5" />,
    color: 'bg-green-500',
    handler,
  }),
  view: (handler: () => void): SwipeAction => ({
    id: 'view',
    label: 'View',
    icon: <Eye className="w-5 h-5" />,
    color: 'bg-gray-500',
    handler,
  }),
}
