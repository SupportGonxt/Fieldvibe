import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, FileText, CheckCircle } from 'lucide-react'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function SurveyResponseDetail() {
  const { surveyId, responseId } = useParams<{ surveyId: string; responseId: string }>()
  const navigate = useNavigate()

  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['survey-response', surveyId, responseId],
    queryFn: async () => {
      const response = await fetch(`${apiClient.defaults.baseURL}/survey-responses/${responseId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const oldResponse = {
      id: responseId,
      survey_id: surveyId,
      question_text: 'How satisfied are you with our product quality?',
      question_type: 'rating',
      answer: '5',
      answer_text: 'Very satisfied',
      respondent_name: 'Store Manager',
      answered_at: '2024-01-20T10:05:00Z',
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


  if (!response) {
    return <div className="p-6">Response not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/field-operations/surveys/${surveyId}/responses`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Responses
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Survey Response Detail</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <FileText className="h-6 w-6 text-blue-600 mt-1" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{response.question_text}</h2>
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
              {response.question_type}
            </span>
          </div>
        </div>

        <div className="mt-6 p-4 bg-surface-secondary rounded-lg">
          <p className="text-sm font-medium text-gray-500 mb-2">Answer</p>
          {response.question_type === 'rating' && (
            <div className="flex items-center gap-2">
              {[...Array(5)].map((_, i) => (
                <span key={i} className={`text-3xl ${
                  i < parseInt(response.answer) ? 'text-yellow-400' : 'text-gray-300'
                }`}>
                  ★
                </span>
              ))}
              <span className="ml-2 text-lg font-semibold text-gray-900">{response.answer_text}</span>
            </div>
          )}
          {response.question_type === 'text' && (
            <p className="text-gray-900">{response.answer}</p>
          )}
          {response.question_type === 'multiple_choice' && (
            <p className="text-gray-900 font-medium">{response.answer}</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Response Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Respondent</dt>
            <dd className="mt-1 text-sm text-gray-900">{response.respondent_name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Answered At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(response.answered_at).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
