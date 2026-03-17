import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, X, AlertCircle } from 'lucide-react'
import { Button } from '../ui/Button'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'

interface Field {
  name: string
  label: string
  type: 'text' | 'number' | 'select' | 'date' | 'textarea' | 'checkbox'
  required?: boolean
  options?: { value: string; label: string }[]
  placeholder?: string
  disabled?: boolean
  validation?: (value: any) => string | null
}

interface TransactionFormProps {
  title: string
  fields: Field[]
  initialData?: any
  onSubmit: (data: any) => Promise<void>
  onCancel?: () => void
  submitLabel?: string
  cancelLabel?: string
}

export default function TransactionForm({
  title,
  fields,
  initialData = {},
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  cancelLabel = 'Cancel'
}: TransactionFormProps) {
  const navigate = useNavigate()
  const [formData, setFormData] = useState(initialData)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const isDirty = useMemo(() => {
    return Object.keys(formData).some(key => (formData[key] ?? '') !== (initialData[key] ?? ''))
  }, [formData, initialData])
  useUnsavedChanges(isDirty)

  const handleChange = (name: string, value: any) => {
    setFormData({ ...formData, [name]: value })
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' })
    }
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}

    fields.forEach(field => {
      const value = formData[field.name]

      if (field.required && (!value || value === '')) {
        newErrors[field.name] = `${field.label} is required`
      }

      if (field.validation && value) {
        const error = field.validation(value)
        if (error) {
          newErrors[field.name] = error
        }
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (!validate()) {
      return
    }

    setLoading(true)
    try {
      await onSubmit(formData)
    } catch (error: any) {
      setSubmitError(error.message || 'Failed to save transaction')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    } else {
      navigate(-1)
    }
  }

  const renderField = (field: Field) => {
    const value = formData[field.name] || ''
    const error = errors[field.name]

    const commonProps = {
      id: field.name,
      name: field.name,
      disabled: field.disabled || loading,
      className: `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
        error ? 'border-red-500' : 'border-gray-300'
      } ${field.disabled ? 'bg-gray-100' : ''}`
    }

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            {...commonProps}
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            rows={4}
          />
        )

      case 'select':
        return (
          <select
            {...commonProps}
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
          >
            <option value="">Select {field.label}</option>
            {field.options?.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )

      case 'checkbox':
        return (
          <input
            type="checkbox"
            {...commonProps}
            checked={value}
            onChange={(e) => handleChange(field.name, e.target.checked)}
            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          />
        )

      default:
        return (
          <input
            type={field.type}
            {...commonProps}
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            placeholder={field.placeholder}
          />
        )
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{title}</h1>

        {submitError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700 mt-1">{submitError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {fields.map(field => (
              <div
                key={field.name}
                className={field.type === 'textarea' ? 'md:col-span-2' : ''}
              >
                <label
                  htmlFor={field.name}
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {renderField(field)}
                {errors[field.name] && (
                  <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
              disabled={loading}
            >
              <X className="w-4 h-4 mr-2" />
              {cancelLabel}
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Saving...' : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
