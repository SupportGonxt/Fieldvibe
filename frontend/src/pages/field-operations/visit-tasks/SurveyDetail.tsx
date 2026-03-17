import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, FileText, CheckCircle, Clock } from 'lucide-react'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function SurveyDetail() {
  const { visitId, surveyId } = useParams<{ visitId: string; surveyId: string }>()
  const navigate = useNavigate()

  const { data: survey, isLoading, isError } = useQuery({
    queryKey: ['survey', visitId, surveyId],
    queryFn: async () => {
      const response = await fetch(`/api/surveys/${surveyId}`, {
        headers: {
          'X-Tenant-Code': localStorage.getItem('tenantCode') || 'DEMO',
        },
      })
      if (!response.ok) return null
      const result = await response.json()
      return result.data
    },
  })

  const oldSurvey = {
      id: surveyId,
      visit_id: visitId,
      survey_title: 'Customer Satisfaction Survey',
      survey_type: 'customer_feedback',
      brand_name: 'Coca-Cola',
      total_questions: 10,
      questions_answered: 10,
      completion_percentage: 100,
      started_at: '2024-01-20T10:00:00Z',
      completed_at: '2024-01-20T10:10:00Z',
      duration_minutes: 10,
      respondent_name: 'Store Manager',
      respondent_role: 'Manager',
      status: 'completed',
    }

  if (isLoading) {
    return <div className="p-6">Loading survey details...</div>
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


  if (!survey) {
    return <div className="p-6">Survey not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/field-operations/visits/${visitId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Visit
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Survey Detail</h1>
        <p className="text-gray-600">{survey.survey_title}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Questions</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{survey.total_questions}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Answered</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">{survey.questions_answered}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Completion</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{survey.completion_percentage}%</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-gray-900">Duration</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{survey.duration_minutes}</p>
          <p className="text-sm text-gray-600 mt-1">minutes</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Survey Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Survey Title</dt>
            <dd className="mt-1 text-sm text-gray-900">{survey.survey_title}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Survey Type</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">
              {survey.survey_type.replace('_', ' ')}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Brand</dt>
            <dd className="mt-1 text-sm text-gray-900">{survey.brand_name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1">
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                survey.status === 'completed' ? 'bg-green-100 text-green-800' :
                survey.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {survey.status}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Respondent Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Respondent Name</dt>
            <dd className="mt-1 text-sm text-gray-900">{survey.respondent_name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Role</dt>
            <dd className="mt-1 text-sm text-gray-900">{survey.respondent_role}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Timing</h2>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Started At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(survey.started_at).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Completed At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {survey.completed_at 
                ? new Date(survey.completed_at).toLocaleString()
                : 'In progress'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Duration</dt>
            <dd className="mt-1 text-sm text-gray-900">{survey.duration_minutes} minutes</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate(`/field-operations/surveys/${surveyId}/responses`)}
          className="btn-primary"
        >
          View Responses
        </button>
        <button
          onClick={() => navigate(`/field-operations/surveys/${surveyId}/analysis`)}
          className="btn-secondary"
        >
          View Analysis
        </button>
      </div>
    </div>
  )
}
