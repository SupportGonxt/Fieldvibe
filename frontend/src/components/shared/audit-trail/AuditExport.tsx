import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Download, FileText, Table } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { auditService } from '../../../services/audit.service'

interface ExportFormData {
  format: 'csv' | 'excel' | 'pdf' | 'json'
  date_from: string
  date_to: string
  include_metadata: boolean
  include_system_info: boolean
}

export default function AuditExport() {
  const { entityType, entityId } = useParams<{ entityType: string; entityId: string }>()
  const navigate = useNavigate()

  const { data: entity } = useQuery({
    queryKey: [entityType, entityId],
    queryFn: async () => {
      const response = await fetch(`/api/${entityType}/${entityId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ExportFormData>({
    defaultValues: {
      format: 'csv',
      include_metadata: true,
      include_system_info: false,
    },
  })

  const format = watch('format')

  const exportMutation = useMutation({
    mutationFn: async (data: ExportFormData) => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      return { download_url: '/exports/audit-trail-123.csv' }
    },
    onSuccess: (data) => {
      toast.success('Export generated successfully')
      window.open(data.download_url, '_blank')
    },
    onError: () => {
      toast.error('Failed to generate export')
    },
  })

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/${entityType}/${entityId}/audit-trail`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Audit Trail
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Export Audit Trail</h1>
        <p className="text-gray-600">{entity?.name}</p>
      </div>

      <form onSubmit={handleSubmit((data) => exportMutation.mutate(data))} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Export Format *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <label className="flex flex-col items-center gap-2 p-4 border-2 rounded-lg cursor-pointer hover:bg-surface-secondary has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50">
                <input
                  type="radio"
                  value="csv"
                  {...register('format', { required: true })}
                  className="sr-only"
                />
                <Table className="h-8 w-8 text-gray-600" />
                <span className="text-sm font-medium">CSV</span>
              </label>
              <label className="flex flex-col items-center gap-2 p-4 border-2 rounded-lg cursor-pointer hover:bg-surface-secondary has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50">
                <input
                  type="radio"
                  value="excel"
                  {...register('format', { required: true })}
                  className="sr-only"
                />
                <Table className="h-8 w-8 text-green-600" />
                <span className="text-sm font-medium">Excel</span>
              </label>
              <label className="flex flex-col items-center gap-2 p-4 border-2 rounded-lg cursor-pointer hover:bg-surface-secondary has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50">
                <input
                  type="radio"
                  value="pdf"
                  {...register('format', { required: true })}
                  className="sr-only"
                />
                <FileText className="h-8 w-8 text-red-600" />
                <span className="text-sm font-medium">PDF</span>
              </label>
              <label className="flex flex-col items-center gap-2 p-4 border-2 rounded-lg cursor-pointer hover:bg-surface-secondary has-[:checked]:border-primary-600 has-[:checked]:bg-primary-50">
                <input
                  type="radio"
                  value="json"
                  {...register('format', { required: true })}
                  className="sr-only"
                />
                <FileText className="h-8 w-8 text-blue-600" />
                <span className="text-sm font-medium">JSON</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date From *
              </label>
              <input
                type="date"
                {...register('date_from', { required: 'Start date is required' })}
                className="input"
              />
              {errors.date_from && (
                <p className="mt-1 text-sm text-red-600">{errors.date_from.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date To *
              </label>
              <input
                type="date"
                {...register('date_to', { required: 'End date is required' })}
                className="input"
              />
              {errors.date_to && (
                <p className="mt-1 text-sm text-red-600">{errors.date_to.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('include_metadata')}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Include metadata fields</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('include_system_info')}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Include system information (IP, user agent, etc.)</span>
            </label>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Note:</strong> The export will include all audit trail entries for this {entityType} 
              within the selected date range. {format === 'pdf' && 'PDF exports are limited to 1000 entries.'}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={exportMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {exportMutation.isPending ? 'Generating...' : 'Generate Export'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/${entityType}/${entityId}/audit-trail`)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
