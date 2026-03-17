import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, TrendingUp, Users, Star, BarChart3 } from 'lucide-react'
import { surveysService } from '../../services/surveys.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function SurveyAnalytics() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: survey } = useQuery({
    queryKey: ['survey', id],
    queryFn: async () => {
      return { id, title: 'Customer Satisfaction Survey' }
    },
  })

  const { data: analytics, isLoading, isError } = useQuery({
    queryKey: ['survey-analytics', id],
    queryFn: () => surveysService.getSurveyAnalytics(id!),
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


  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/surveys/${id}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Survey
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Survey Analytics</h1>
        <p className="text-gray-600">{survey?.title}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Total Responses</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{analytics?.total_responses}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Completion Rate</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{analytics?.completion_rate}%</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Star className="h-5 w-5 text-yellow-600" />
            <h3 className="font-semibold text-gray-900">Average Score</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{analytics?.average_score}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Score Distribution</h2>
          </div>
          <div className="space-y-3">
            {analytics?.score_distribution.map((item) => (
              <div key={item.score} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 w-12">{item.score} stars</span>
                <div className="flex-1 bg-gray-200 rounded-full h-6">
                  <div
                    className="bg-primary-600 h-6 rounded-full flex items-center justify-end px-2"
                    style={{ width: `${item.percentage}%` }}
                  >
                    <span className="text-xs text-white font-medium">{item.count}</span>
                  </div>
                </div>
                <span className="text-sm text-gray-600 w-12">{item.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Locations</h2>
          <div className="space-y-3">
            {analytics?.top_locations.map((item, idx) => (
              <div key={item.location} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-400">#{idx + 1}</span>
                  <span className="text-sm font-medium text-gray-900">{item.location}</span>
                </div>
                <span className="text-sm font-bold text-primary-600">{item.count} responses</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Response Trend</h2>
          <div className="flex items-end gap-2 h-48">
            {analytics?.response_trend.map((item) => (
              <div key={item.date} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-primary-600 rounded-t" style={{ height: `${(item.count / 12) * 100}%` }}></div>
                <span className="text-xs text-gray-600">{new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                <span className="text-xs font-bold text-gray-900">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
