import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, User, Calendar, MapPin } from 'lucide-react'
import { surveysService } from '../../services/surveys.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function SurveyResponses() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: survey } = useQuery({
    queryKey: ['survey', id],
    queryFn: async () => {
      return { id, title: 'Customer Satisfaction Survey' }
    },
  })

  const { data: responses, isLoading, isError } = useQuery({
    queryKey: ['survey-responses', id],
    queryFn: async () => {
      const result = await surveysService.getSurveyResponses(id!)
      return result.data || []
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
        <h1 className="text-2xl font-bold text-gray-900">Survey Responses</h1>
        <p className="text-gray-600">{survey?.title}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total Responses</p>
            <p className="text-3xl font-bold text-gray-900">{responses?.length || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Average Score</p>
            <p className="text-3xl font-bold text-gray-900">
              {responses?.length ? (responses.reduce((sum, r) => sum + r.score, 0) / responses.length).toFixed(1) : 0}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {responses?.map((response) => (
          <div key={response.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="font-semibold text-gray-900">{response.respondent}</p>
                  <p className="text-sm text-gray-600">{response.customer}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(response.completed_at).toLocaleString()}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="h-4 w-4" />
                  {response.location}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <span className="text-2xl font-bold text-primary-600">{response.score}</span>
              <span className="text-gray-600"> / 5.0</span>
            </div>

            <div className="space-y-3">
              {response.answers.map((answer, idx) => (
                <div key={idx} className="border-t pt-3">
                  <p className="text-sm font-medium text-gray-700 mb-1">{answer.question}</p>
                  <p className="text-sm text-gray-900">{answer.answer}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
