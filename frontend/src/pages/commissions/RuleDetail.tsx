import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Edit, Percent, Target } from 'lucide-react'
import ErrorState from '../../components/ui/ErrorState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function RuleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: rule, isLoading, isError } = useQuery({
    queryKey: ['commission-rule', id],
    queryFn: async () => {
      return {
        id,
        name: 'Standard Sales Commission',
        description: 'Base commission for all sales agents',
        base_rate: 5,
        bonus_threshold: 50000,
        bonus_rate: 2,
        applies_to: 'All Sales Agents',
        status: 'active',
        effective_from: '2024-01-01',
        created_at: '2023-12-15'
      }
    },
  })

  if (isLoading) {
    return <div className="p-6">Loading rule details...</div>
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


  if (!rule) {
    return <div className="p-6">Rule not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/commissions/rules')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Rules
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{rule.name}</h1>
            <p className="text-gray-600">{rule.description}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/commissions/rules/${id}/edit`)}
              className="btn-secondary flex items-center gap-2"
            >
              <Edit className="h-5 w-5" />
              Edit
            </button>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              rule.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {rule.status}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Percent className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Base Commission Rate</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{rule.base_rate}%</p>
          <p className="text-sm text-gray-600 mt-1">Applied to all sales</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Target className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Bonus Rate</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{rule.bonus_rate}%</p>
          <p className="text-sm text-gray-600 mt-1">When sales exceed ${rule.bonus_threshold.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Rule Details</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Applies To</dt>
            <dd className="mt-1 text-sm text-gray-900">{rule.applies_to}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Effective From</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(rule.effective_from).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Created</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(rule.created_at).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1 text-sm text-gray-900">{rule.status}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
