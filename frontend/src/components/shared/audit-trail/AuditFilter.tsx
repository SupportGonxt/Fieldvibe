import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Filter } from 'lucide-react'

interface FilterFormData {
  action: string
  user: string
  date_from: string
  date_to: string
  field: string
}

export default function AuditFilter() {
  const { entityType, entityId } = useParams<{ entityType: string; entityId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const { register, handleSubmit } = useForm<FilterFormData>({
    defaultValues: {
      action: searchParams.get('action') || '',
      user: searchParams.get('user') || '',
      date_from: searchParams.get('date_from') || '',
      date_to: searchParams.get('date_to') || '',
      field: searchParams.get('field') || '',
    },
  })

  const onSubmit = (data: FilterFormData) => {
    const params = new URLSearchParams()
    if (data.action) params.set('action', data.action)
    if (data.user) params.set('user', data.user)
    if (data.date_from) params.set('date_from', data.date_from)
    if (data.date_to) params.set('date_to', data.date_to)
    if (data.field) params.set('field', data.field)
    
    navigate(`/${entityType}/${entityId}/audit-trail?${params.toString()}`)
  }

  const clearFilters = () => {
    navigate(`/${entityType}/${entityId}/audit-trail`)
  }

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
        <h1 className="text-2xl font-bold text-gray-900">Filter Audit Trail</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Action Type
            </label>
            <select {...register('action')} className="input">
              <option value="">All actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="view">View</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              User
            </label>
            <input
              type="text"
              {...register('user')}
              className="input"
              placeholder="Enter user name or ID..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Field Changed
            </label>
            <input
              type="text"
              {...register('field')}
              className="input"
              placeholder="Enter field name..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date From
              </label>
              <input
                type="date"
                {...register('date_from')}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date To
              </label>
              <input
                type="date"
                {...register('date_to')}
                className="input"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" className="btn-primary flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Apply Filters
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="btn-secondary"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
