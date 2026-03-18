import React, { useMemo } from 'react'
import SearchableSelect from './SearchableSelect'

/**
 * SelectField - Drop-in replacement for <select> that uses SearchableSelect
 * Supports the same onChange pattern as native <select> but with search functionality
 */
interface SelectFieldProps {
  name?: string
  value: string
  onChange: (e: { target: { name?: string; value: string } }) => void
  children?: React.ReactNode
  options?: Array<{ value: string; label: string }>
  label?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  error?: string
  className?: string
}

export default function SelectField({
  name,
  value,
  onChange,
  children,
  options: propOptions,
  label,
  placeholder = 'Select...',
  disabled = false,
  required = false,
  error,
  className = '',
}: SelectFieldProps) {
  // Extract options from children (React <option> elements) if options prop not provided
  const options = useMemo(() => {
    if (propOptions) return propOptions

    const extracted: Array<{ value: string; label: string }> = []
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && child.type === 'option') {
        const optionValue = String(child.props.value ?? '')
        const optionLabel = String(child.props.children ?? optionValue)
        if (optionValue) {
          extracted.push({ value: optionValue, label: optionLabel })
        }
      }
    })
    return extracted
  }, [children, propOptions])

  const handleChange = (newValue: string | null) => {
    onChange({ target: { name, value: newValue || '' } })
  }

  return (
    <SearchableSelect
      options={options}
      value={value || null}
      onChange={handleChange}
      label={label}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      error={error}
      className={className}
    />
  )
}
