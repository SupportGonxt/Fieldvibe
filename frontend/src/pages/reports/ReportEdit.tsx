import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Save } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { reportsService } from '../../services/reports.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

import { apiClient } from '../../services/api.service'
interface ReportFormData {
  name: string
  description: string
  type: string
  schedule: string
  format: string
  recipients: string
}

export default function ReportEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['report', id],
    queryFn: () => reportsService.getReport(id!),
  })

  const { register, handleSubmit, formState: { errors } } = useForm<ReportFormData>({
    values: report
  })

  const updateMutation = useMutation({
    mutationFn: async (data: ReportFormData) => {
      // Mock API call - replace with actual implementation
      const response = await apiClient.put(`/reports/${id}`, data)
      return response.data?.data || response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', id] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      toast.success('Report updated successfully')
      navigate(`/reports/${id}`)
    },
    onError: () => {
      toast.error('Failed to update report')
    },
  })

  const onSubmit = (data: ReportFormData) => {
    updateMutation.mutate(data)
  }

  if (isLoading) {
    return <div className="p-6"><LoadingSpinner size="md" /></div>
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 text-lg font-medium">Failed to load data</p>
          <p className="text-gray-500 mt-2">Please try refreshing the page</p>
        </div>
      </div>
    )
  }


  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/reports/${id}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Report
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Report</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Name *
            </label>
            <input
              type="text"
              {...register('name', { required: 'Report name is required' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Report Type *
              </label>
              <select
                {...register('type', { required: 'Report type is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select type</option>
                <option value="sales">Sales</option>
                <option value="inventory">Inventory</option>
                <option value="finance">Finance</option>
                <option value="operations">Operations</option>
                <option value="custom">Custom</option>
              </select>
              {errors.type && (
                <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Schedule *
              </label>
              <select
                {...register('schedule', { required: 'Schedule is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select schedule</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="manual">Manual Only</option>
              </select>
              {errors.schedule && (
                <p className="mt-1 text-sm text-red-600">{errors.schedule.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Format *
              </label>
              <select
                {...register('format', { required: 'Format is required' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select format</option>
                <option value="pdf">PDF</option>
                <option value="excel">Excel</option>
                <option value="csv">CSV</option>
                <option value="html">HTML</option>
              </select>
              {errors.format && (
                <p className="mt-1 text-sm text-red-600">{errors.format.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recipients (comma-separated emails)
              </label>
              <input
                type="text"
                {...register('recipients')}
                placeholder="email1@example.com, email2@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(`/reports/${id}`)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="h-5 w-5" />
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
