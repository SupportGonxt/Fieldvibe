import { useState, useEffect } from 'react'
import { 
  Brain, 
  AlertTriangle, 
  TrendingUp, 
  Shield, 
  Lightbulb,
  RefreshCw,
  Eye,
  X
} from 'lucide-react'
import { AIInsight, FraudDetection } from '../../types/ai.types'
import { aiService } from '../../services/ai.service'

interface AIInsightsPanelProps {
  module: string
  entityId?: string
  className?: string
}

export default function AIInsightsPanel({ module, entityId, className = '' }: AIInsightsPanelProps) {
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [fraudAlerts, setFraudAlerts] = useState<FraudDetection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedInsight, setSelectedInsight] = useState<AIInsight | null>(null)

  useEffect(() => {
    loadAIInsights()
  }, [module, entityId])

  const loadAIInsights = async () => {
    setIsLoading(true)
    try {
      let moduleInsights: AIInsight[] = []
      let moduleFraudAlerts: FraudDetection[] = []

      switch (module) {
        case 'field_agents':
          moduleInsights = await aiService.analyzeFieldAgentPerformance(entityId || 'all', '7d')
          if (entityId) {
            moduleFraudAlerts = await aiService.detectFieldAgentFraud([{ id: entityId }])
          }
          break
        case 'customers':
          if (entityId) {
            moduleInsights = await aiService.analyzeCustomerBehavior(entityId)
            moduleFraudAlerts = await aiService.detectCustomerFraud(entityId)
          }
          break
        case 'orders':
          moduleInsights = await aiService.analyzeOrderPatterns('7d')
          if (entityId) {
            moduleFraudAlerts = await aiService.detectOrderFraud(entityId)
          }
          break
        case 'products':
          if (entityId) {
            moduleInsights = await aiService.analyzeProductPerformance(entityId)
          }
          break
      }

      setInsights(moduleInsights)
      setFraudAlerts(moduleFraudAlerts)
    } catch (error) {
      console.error('Failed to load AI insights:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'trend':
        return <TrendingUp className="h-4 w-4" />
      case 'anomaly':
        return <AlertTriangle className="h-4 w-4" />
      case 'prediction':
        return <Brain className="h-4 w-4" />
      case 'recommendation':
        return <Lightbulb className="h-4 w-4" />
      case 'fraud_alert':
        return <Shield className="h-4 w-4" />
      default:
        return <Brain className="h-4 w-4" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-100'
    }
  }

  const getRiskScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-600'
    if (score >= 60) return 'text-orange-600'
    if (score >= 40) return 'text-yellow-600'
    return 'text-green-600'
  }

  if (isLoading) {
    return (
      <div className={`card ${className}`}>
        <div className="card-header">
          <div className="flex items-center">
            <Brain className="h-5 w-5 text-info-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">AI Insights</h3>
          </div>
        </div>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-info-600" />
          <span className="ml-2 text-gray-600">Analyzing data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`card ${className}`}>
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Brain className="h-5 w-5 text-info-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">AI Insights</h3>
          </div>
          <button
            onClick={loadAIInsights}
            className="text-gray-400 hover:text-gray-600"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Fraud Alerts */}
      {fraudAlerts.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-red-600 mb-3 flex items-center">
            <Shield className="h-4 w-4 mr-1" />
            Fraud Alerts ({fraudAlerts.length})
          </h4>
          <div className="space-y-2">
            {fraudAlerts.map((alert) => (
              <div key={alert.id} className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">{alert.description}</p>
                    <p className="text-xs text-red-600 mt-1">
                      Risk Score: <span className={getRiskScoreColor(alert.risk_score)}>
                        {alert.risk_score.toFixed(0)}%
                      </span>
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    alert.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    alert.status === 'investigating' ? 'bg-blue-100 text-blue-800' :
                    alert.status === 'resolved' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {alert.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights */}
      <div className="space-y-3">
        {insights.length === 0 ? (
          <div className="text-center py-6">
            <Brain className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No AI insights available</p>
            <p className="text-sm text-gray-400">Check back later for analysis</p>
          </div>
        ) : (
          insights.map((insight) => (
            <div
              key={insight.id}
              className={`border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow ${getSeverityColor(insight.severity)}`}
              onClick={() => setSelectedInsight(insight)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {getInsightIcon(insight.type)}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium">{insight.title}</h4>
                    <p className="text-sm mt-1 opacity-90">{insight.description}</p>
                    <div className="flex items-center mt-2 space-x-4">
                      <span className="text-xs opacity-75">
                        Confidence: {(insight.confidence * 100).toFixed(0)}%
                      </span>
                      <span className="text-xs opacity-75">
                        {new Date(insight.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <Eye className="h-4 w-4 opacity-50" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Insight Detail Modal */}
      {selectedInsight && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  {getInsightIcon(selectedInsight.type)}
                  <h3 className="text-lg font-medium text-gray-900">
                    {selectedInsight.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedInsight(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                  <p className="text-sm text-gray-600">{selectedInsight.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Confidence</h4>
                    <div className="flex items-center">
                      <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className="bg-info-600 h-2 rounded-full"
                          style={{ width: `${selectedInsight.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600">
                        {(selectedInsight.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Severity</h4>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(selectedInsight.severity)}`}>
                      {selectedInsight.severity}
                    </span>
                  </div>
                </div>

                {selectedInsight.data && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Additional Data</h4>
                    <pre className="text-xs bg-gray-100 p-3 rounded-lg overflow-x-auto">
                      {JSON.stringify(selectedInsight.data, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="text-xs text-gray-500">
                  Generated: {new Date(selectedInsight.created_at).toLocaleString()}
                  {selectedInsight.expires_at && (
                    <span className="ml-4">
                      Expires: {new Date(selectedInsight.expires_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}