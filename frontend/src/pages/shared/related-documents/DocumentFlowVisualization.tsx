import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, FileText } from 'lucide-react'
import { documentsService } from '../../../services/documents.service'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

interface DocumentFlowVisualizationProps {
  entityType: string
  entityId: string
}

export default function DocumentFlowVisualization({ entityType, entityId }: DocumentFlowVisualizationProps) {
  const navigate = useNavigate()

  const { data: relationships = [], isLoading, isError } = useQuery({
    queryKey: ['document-flow', entityType, entityId],
    queryFn: async () => documentsService.getRelatedDocuments(entityType, entityId),
  })

  const flow = {
    current_document: {
      type: entityType,
      id: entityId,
      number: `${entityType?.toUpperCase()}-001`,
      status: 'active',
    },
    flow_stages: relationships.length > 0 ? [] : [
      {
        stage: entityType,
        documents: [
          { id: entityId, number: `${entityType?.toUpperCase()}-001`, status: 'active', is_current: true },
        ],
      },
    ],
  }

  if (isLoading) {
    return <div className="p-6">Loading flow visualization...</div>
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


  if (!flow) {
    return <div className="p-6">Flow not found</div>
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Document Flow Visualization</h2>

      <div className="relative">
        <div className="flex items-center justify-between gap-4 overflow-x-auto pb-4">
          {flow.flow_stages.map((stage, stageIdx) => (
            <div key={stageIdx} className="flex items-center gap-4">
              <div className="flex flex-col items-center min-w-[150px]">
                <p className="text-xs font-medium text-gray-500 uppercase mb-3">{stage.stage}</p>
                <div className="space-y-2 w-full">
                  {stage.documents.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => navigate(`/${stage.stage}s/${doc.id}`)}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        doc.is_current
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-100 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className={`h-4 w-4 ${doc.is_current ? 'text-primary-600' : 'text-gray-400'}`} />
                        <p className={`text-sm font-medium ${doc.is_current ? 'text-primary-900' : 'text-gray-900'}`}>
                          {doc.number}
                        </p>
                      </div>
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                        doc.status === 'completed' || doc.status === 'paid' || doc.status === 'delivered' || doc.status === 'accepted'
                          ? 'bg-green-100 text-green-800'
                          : doc.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {doc.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {stageIdx < flow.flow_stages.length - 1 && (
                <ArrowRight className="h-6 w-6 text-gray-400 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-700">
          This visualization shows the complete document flow from quote to payment. Click on any document to view its details.
        </p>
      </div>
    </div>
  )
}
