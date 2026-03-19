import React, { useState, useRef, useEffect } from 'react'
import { Pencil, Check, X } from 'lucide-react'

interface InlineEditProps {
  value: string
  onSave: (newValue: string) => Promise<void> | void
  type?: 'text' | 'number' | 'email' | 'tel' | 'textarea'
  placeholder?: string
  className?: string
  displayClassName?: string
  inputClassName?: string
  disabled?: boolean
  required?: boolean
  validate?: (value: string) => string | null
}

export const InlineEdit: React.FC<InlineEditProps> = ({
  value,
  onSave,
  type = 'text',
  placeholder = 'Click to edit',
  className = '',
  displayClassName = '',
  inputClassName = '',
  disabled = false,
  required = false,
  validate,
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    setEditValue(value)
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select()
      }
    }
  }, [isEditing])

  const handleSave = async () => {
    if (required && !editValue.trim()) {
      setError('This field is required')
      return
    }
    if (validate) {
      const validationError = validate(editValue)
      if (validationError) {
        setError(validationError)
        return
      }
    }
    if (editValue === value) {
      setIsEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(editValue)
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditValue(value)
    setError(null)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (isEditing) {
    const InputComponent = type === 'textarea' ? 'textarea' : 'input'
    return (
      <div className={`flex items-start gap-2 ${className}`}>
        <InputComponent
          ref={inputRef as any}
          type={type === 'textarea' ? undefined : type}
          value={editValue}
          onChange={e => { setEditValue(e.target.value); setError(null) }}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (!saving) setTimeout(handleCancel, 200) }}
          disabled={saving}
          rows={type === 'textarea' ? 3 : undefined}
          className={`flex-1 px-2 py-1 text-sm border border-blue-500 rounded-md bg-white dark:bg-night-50 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-500' : ''} ${inputClassName}`}
        />
        <div className="flex items-center gap-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-night-100 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    )
  }

  return (
    <div
      className={`group flex items-center gap-1 cursor-pointer rounded px-1 -mx-1 hover:bg-gray-100 dark:hover:bg-night-100 transition-colors ${disabled ? 'cursor-default' : ''} ${className}`}
      onClick={() => !disabled && setIsEditing(true)}
    >
      <span className={`${!value ? 'text-gray-400 italic' : 'text-gray-900 dark:text-gray-100'} ${displayClassName}`}>
        {value || placeholder}
      </span>
      {!disabled && (
        <Pencil className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  )
}
