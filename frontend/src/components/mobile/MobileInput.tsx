import { InputHTMLAttributes, forwardRef } from 'react'

interface MobileInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  icon?: React.ReactNode
}

const MobileInput = forwardRef<HTMLInputElement, MobileInputProps>(
  ({ label, error, helperText, icon, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full px-4 py-3 text-base border rounded-lg
              focus:outline-none focus:ring-2 focus:ring-info-500 focus:border-transparent
              disabled:bg-gray-100 disabled:cursor-not-allowed
              touch-manipulation
              ${icon ? 'pl-10' : ''}
              ${error ? 'border-red-500' : 'border-gray-300'}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    )
  }
)

MobileInput.displayName = 'MobileInput'

export default MobileInput
