import { ReactNode } from 'react'

interface MobileCardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  selected?: boolean
}

export default function MobileCard({ 
  children, 
  className = '', 
  onClick,
  selected = false 
}: MobileCardProps) {
  const baseClasses = 'bg-white rounded-lg shadow-sm border p-4 transition-all touch-manipulation'
  const interactiveClasses = onClick ? 'active:scale-98 cursor-pointer' : ''
  const selectedClasses = selected ? 'border-info-600 bg-info-50' : 'border-gray-100'
  
  return (
    <div
      className={`${baseClasses} ${interactiveClasses} ${selectedClasses} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
