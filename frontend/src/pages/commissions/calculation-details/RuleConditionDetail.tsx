import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function RuleConditionDetail() {
  const { ruleId, conditionId } = useParams<{ ruleId: string; conditionId: string }>()
  const navigate = useNavigate()

  const { data: condition, isLoading, isError } = useQuery({
    queryKey: ['commission-rule-condition', ruleId, conditionId],
    queryFn: async () => {
      const response = await apiClient.get(`/commissions/rules/${ruleId}/conditions/${conditionId}`)
      const result = response.data
      return result.data
    },
  })

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


  if (!condition) {
    return <div className="p-6">Condition not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/commissions/rules/${ruleId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Rule
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Rule Condition Detail</h1>
        <p className="text-gray-600">{condition.rule_name}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          {condition.evaluation_result ? (
            <CheckCircle className="h-8 w-8 text-green-600" />
          ) : (
            <XCircle className="h-8 w-8 text-red-600" />
          )}
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{condition.description}</h2>
            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
              condition.evaluation_result ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {condition.evaluation_result ? 'Condition Met' : 'Condition Not Met'}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Condition Details</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Condition Type</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">
              {condition.condition_type.replace('_', ' ')}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Operator</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">
              {condition.operator.replace('_', ' ')}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Threshold Value</dt>
            <dd className="mt-1 text-sm text-gray-900 font-medium">
              ${condition.threshold_value.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Actual Value</dt>
            <dd className={`mt-1 text-sm font-bold ${
              condition.evaluation_result ? 'text-green-600' : 'text-red-600'
            }`}>
              ${condition.actual_value.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                condition.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {condition.is_active ? 'Active' : 'Inactive'}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">Evaluation Logic</h2>
        <p className="text-sm text-blue-700">
          This condition evaluates to <strong>{condition.evaluation_result ? 'TRUE' : 'FALSE'}</strong> because 
          the actual value (${condition.actual_value.toFixed(2)}) is {condition.evaluation_result ? '' : 'not '}
          {condition.operator.replace('_', ' ')} the threshold value (${condition.threshold_value.toFixed(2)}).
        </p>
      </div>
    </div>
  )
}
