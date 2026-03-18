import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'react-hot-toast'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

interface ResponseFormData {
  answer: string
}

export default function SurveyResponseEdit() {
  const { surveyId, responseId } = useParams<{ surveyId: string; responseId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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
    }

  const { register, handleSubmit, formState: { errors } } = useForm<ResponseFormData>({
    values: response,
  })

  const updateMutation = useMutation({
    mutationFn: async (data: ResponseFormData) => {
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-response', surveyId, responseId] })
      queryClient.invalidateQueries({ queryKey: ['survey', surveyId] })
      toast.success('Response updated successfully')
      navigate(`/field-operations/surveys/${surveyId}/responses/${responseId}`)
    },
    onError: () => {
      toast.error('Failed to update response')
    },
  })

  if (isLoading) {
    return <div className="p-6"><LoadingSpinner size="sm" /></div>
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
          onClick={() => navigate(`/field-operations/surveys/${surveyId}/responses/${responseId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Response
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Edit Survey Response</h1>
      </div>

      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div className="p-4 bg-surface-secondary rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-2">Question</p>
            <p className="text-gray-900">{response.question_text}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Answer *
            </label>
            {response.question_type === 'rating' && (
              <select
                {...register('answer', { required: 'Answer is required' })}
                className="input"
              >
                <option value="1">1 - Very Dissatisfied</option>
                <option value="2">2 - Dissatisfied</option>
                <option value="3">3 - Neutral</option>
                <option value="4">4 - Satisfied</option>
                <option value="5">5 - Very Satisfied</option>
              </select>
            )}
            {response.question_type === 'text' && (
              <textarea
                {...register('answer', { required: 'Answer is required' })}
                rows={4}
                className="input"
                placeholder="Enter your answer..."
              />
            )}
            {errors.answer && (
              <p className="mt-1 text-sm text-red-600">{errors.answer.message}</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="btn-primary"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/field-operations/surveys/${surveyId}/responses/${responseId}`)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
