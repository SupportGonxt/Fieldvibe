import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function SurveyComparison() {
  const { surveyId } = useParams<{ surveyId: string }>()
  const navigate = useNavigate()

  const { data: comparison, isLoading, isError } = useQuery({
    queryKey: ['survey-comparison', surveyId],
    queryFn: async () => {
      const response = await fetch(`/api/surveys/${surveyId}/comparison`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const oldComparison = {
      current_survey: {
        id: surveyId,
        title: 'Customer Satisfaction Survey - Q1 2024',
        responses: 10,
        satisfaction: 4.5,
        nps: 80,
      },
      previous_survey: {
        id: 'survey-prev',
        title: 'Customer Satisfaction Survey - Q4 2023',
        responses: 8,
        satisfaction: 4.2,
        nps: 70,
      },
      changes: {
        responses: { value: 2, percentage: 25, trend: 'up' },
        satisfaction: { value: 0.3, percentage: 7.1, trend: 'up' },
        nps: { value: 10, percentage: 14.3, trend: 'up' },
      },
      question_comparison: [
        {
          question: 'Product Quality',
          current: 4.5,
          previous: 4.2,
          change: 0.3,
          trend: 'up',
        },
        {
          question: 'Customer Service',
          current: 4.3,
          previous: 4.4,
          change: -0.1,
          trend: 'down',
        },
        {
          question: 'Value for Money',
          current: 4.6,
          previous: 4.1,
          change: 0.5,
          trend: 'up',
        },
      ],
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


  if (!comparison) {
    return <div className="p-6">Comparison not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/field-operations/surveys/${surveyId}/analysis`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Analysis
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Survey Comparison</h1>
        <p className="text-gray-600">Compare with previous survey results</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Responses</h3>
          <div className="flex items-end gap-2 mb-2">
            <p className="text-3xl font-bold text-gray-900">{comparison.current_survey.responses}</p>
            <p className="text-sm text-gray-500 mb-1">vs {comparison.previous_survey.responses}</p>
          </div>
          <div className={`flex items-center gap-1 text-sm ${
            comparison.changes.responses.trend === 'up' ? 'text-green-600' : 'text-red-600'
          }`}>
            {comparison.changes.responses.trend === 'up' ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>+{comparison.changes.responses.value} ({comparison.changes.responses.percentage}%)</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Satisfaction</h3>
          <div className="flex items-end gap-2 mb-2">
            <p className="text-3xl font-bold text-gray-900">{comparison.current_survey.satisfaction.toFixed(1)}</p>
            <p className="text-sm text-gray-500 mb-1">vs {comparison.previous_survey.satisfaction.toFixed(1)}</p>
          </div>
          <div className={`flex items-center gap-1 text-sm ${
            comparison.changes.satisfaction.trend === 'up' ? 'text-green-600' : 'text-red-600'
          }`}>
            {comparison.changes.satisfaction.trend === 'up' ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>+{comparison.changes.satisfaction.value.toFixed(1)} ({comparison.changes.satisfaction.percentage.toFixed(1)}%)</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">NPS Score</h3>
          <div className="flex items-end gap-2 mb-2">
            <p className="text-3xl font-bold text-gray-900">{comparison.current_survey.nps}</p>
            <p className="text-sm text-gray-500 mb-1">vs {comparison.previous_survey.nps}</p>
          </div>
          <div className={`flex items-center gap-1 text-sm ${
            comparison.changes.nps.trend === 'up' ? 'text-green-600' : 'text-red-600'
          }`}>
            {comparison.changes.nps.trend === 'up' ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>+{comparison.changes.nps.value} ({comparison.changes.nps.percentage.toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Question-by-Question Comparison</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-surface-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Question</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Current</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Previous</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Change</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Trend</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {comparison.question_comparison.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {item.question}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">
                    {item.current.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 text-right">
                    {item.previous.toFixed(1)}
                  </td>
                  <td className={`px-6 py-4 text-sm text-right font-medium ${
                    item.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {item.change > 0 ? '+' : ''}{item.change.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {item.trend === 'up' ? (
                      <TrendingUp className="h-5 w-5 text-green-600 mx-auto" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-600 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
