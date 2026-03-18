import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, TrendingUp, Users, BarChart } from 'lucide-react'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function SurveyAnalysis() {
  const { surveyId } = useParams<{ surveyId: string }>()
  const navigate = useNavigate()

  const { data: analysis, isLoading, isError } = useQuery({
    queryKey: ['survey-analysis', surveyId],
    queryFn: async () => {
      const response = await fetch(`/api/surveys/${surveyId}/analysis`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const oldAnalysis = {
      survey_id: surveyId,
      survey_title: 'Customer Satisfaction Survey',
      total_responses: 10,
      completion_rate: 100,
      average_completion_time: 10,
      questions_analysis: [
        {
          question_id: '1',
          question_text: 'How satisfied are you with our product quality?',
          question_type: 'rating',
          average_rating: 4.5,
          total_responses: 10,
        },
        {
          question_id: '2',
          question_text: 'Would you recommend our products to others?',
          question_type: 'yes_no',
          yes_percentage: 90,
          total_responses: 10,
        },
        {
          question_id: '3',
          question_text: 'What improvements would you suggest?',
          question_type: 'text',
          total_responses: 8,
        },
      ],
      overall_satisfaction: 4.5,
      nps_score: 80,
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


  if (!analysis) {
    return <div className="p-6">Analysis not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/field-operations/surveys/${surveyId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Survey
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Survey Analysis</h1>
        <p className="text-gray-600">{analysis.survey_title}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Responses</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{analysis.total_responses}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <BarChart className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Completion</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">{analysis.completion_rate}%</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Satisfaction</h3>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-3xl font-bold text-gray-900">{analysis.overall_satisfaction.toFixed(1)}</p>
            <span className="text-yellow-400 text-2xl">★</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-gray-900">NPS Score</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{analysis.nps_score}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Questions Analysis</h2>
        <div className="space-y-4">
          {analysis.questions_analysis.map((question) => (
            <div
              key={question.question_id}
              onClick={() => navigate(`/field-operations/surveys/${surveyId}/questions/${question.question_id}/answers`)}
              className="p-4 border rounded-lg hover:bg-surface-secondary cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-medium text-gray-900">{question.question_text}</p>
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                  {question.question_type.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>{question.total_responses} responses</span>
                {question.question_type === 'rating' && (
                  <span className="flex items-center gap-1">
                    Avg: {question.average_rating.toFixed(1)}
                    <span className="text-yellow-400">★</span>
                  </span>
                )}
                {question.question_type === 'yes_no' && (
                  <span>{question.yes_percentage}% Yes</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">Key Insights</h2>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Overall satisfaction is {analysis.overall_satisfaction >= 4 ? 'high' : 'moderate'} at {analysis.overall_satisfaction.toFixed(1)}/5.0</li>
          <li>• NPS score of {analysis.nps_score} indicates {analysis.nps_score >= 70 ? 'excellent' : 'good'} customer loyalty</li>
          <li>• Average completion time is {analysis.average_completion_time} minutes</li>
        </ul>
      </div>
    </div>
  )
}
