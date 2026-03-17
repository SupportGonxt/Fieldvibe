import React from 'react'
import { cn } from '../../utils/cn'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'secondary' | 'outline'
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
          {
            'bg-gray-100 dark:bg-night-100 text-gray-800 dark:text-gray-200': variant === 'default',
            'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400': variant === 'success',
            'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400': variant === 'warning',
            'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400': variant === 'danger',
            'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400': variant === 'info',
            'bg-gray-200 dark:bg-night-100 text-gray-700 dark:text-gray-300': variant === 'secondary',
            'border border-gray-300 dark:border-night-50 bg-white dark:bg-night-50 text-gray-700 dark:text-gray-300': variant === 'outline',
          },
          className
        )}
        {...props}
      />
    )
  }
)

Badge.displayName = 'Badge'
