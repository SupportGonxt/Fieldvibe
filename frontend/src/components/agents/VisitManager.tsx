import { useState, useEffect } from 'react'
import {
  MapPin,
  Clock,
  User,
  Camera,
  FileText,
  ShoppingCart,
  Package,
  CreditCard,
  Star,
  CheckCircle,
  AlertCircle,
  Plus,
  Eye,
  Edit,
  Trash2,
  Navigation,
  Activity
} from 'lucide-react'
import { Visit, VisitActivity, Agent, AGENT_ROLES } from '../../types/agent.types'
import AIInsightsPanel from '../ai/AIInsightsPanel'
import { apiClient } from '../../services/api.service'

interface VisitManagerProps {
  agent: Agent
  onVisitUpdate?: (visit: Visit) => void
}

export default function VisitManager({ agent, onVisitUpdate }: VisitManagerProps) {
  const [visits, setVisits] = useState<Visit[]>([])
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null)
  const [showNewVisitForm, setShowNewVisitForm] = useState(false)
  const [activeTab, setActiveTab] = useState<'today' | 'planned' | 'completed' | 'all'>('today')

  useEffect(() => {
    const fetchVisits = async () => {
      try {
        const response = await apiClient.get(`/field-operations/visits`, { params: { agent_id: agent.id } })
        const data = response.data?.data || response.data?.visits || response.data || []
        const visitList = Array.isArray(data) ? data : []
        setVisits(visitList.map((v: any) => ({
          id: String(v.id),
          agent_id: v.agent_id || agent.id,
          customer_id: v.customer_id || v.store_id || '',
          customer_name: v.customer_name || v.store_name || 'Unknown',
          customer_address: v.customer_address || v.store_address || '',
          visit_type: v.visit_type || 'scheduled',
          purpose: Array.isArray(v.purpose) ? v.purpose : (v.purpose ? [v.purpose] : ['general']),
          status: v.status || 'planned',
          scheduled_time: v.scheduled_time || v.scheduled_date || v.created_at || new Date().toISOString(),
          actual_start_time: v.actual_start_time || v.check_in_time,
          actual_end_time: v.actual_end_time || v.check_out_time,
          location: v.location || { latitude: 0, longitude: 0, address: v.customer_address || '', accuracy: 0 },
          activities: Array.isArray(v.activities) ? v.activities : [],
          notes: v.notes || '',
          outcome: v.outcome || '',
          next_action: v.next_action || '',
          created_at: v.created_at || new Date().toISOString(),
          updated_at: v.updated_at || new Date().toISOString(),
        })))
      } catch {
        setVisits([])
      }
    }
    fetchVisits()
  }, [agent.id])

  const getVisitsByTab = () => {
    const today = new Date().toDateString()
    
    switch (activeTab) {
      case 'today':
        return visits.filter(visit => 
          new Date(visit.scheduled_time).toDateString() === today
        )
      case 'planned':
        return visits.filter(visit => visit.status === 'planned')
      case 'completed':
        return visits.filter(visit => visit.status === 'completed')
      default:
        return visits
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned':
        return 'bg-blue-100 text-blue-800'
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'photo':
        return <Camera className="h-4 w-4" />
      case 'survey':
        return <FileText className="h-4 w-4" />
      case 'sale':
        return <ShoppingCart className="h-4 w-4" />
      case 'delivery':
        return <Package className="h-4 w-4" />
      case 'collection':
        return <CreditCard className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Visit Management</h2>
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-sm text-gray-600">Agent:</span>
            <span className="font-medium">{agent.name}</span>
            <div className="flex space-x-1">
              {agent.roles.map(role => (
                <span
                  key={role.id}
                  className="px-2 py-1 text-xs font-medium rounded-full text-white"
                  style={{ backgroundColor: role.color }}
                >
                  {role.name}
                </span>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowNewVisitForm(true)}
          className="btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Visit
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-100">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'today', label: 'Today', count: visits.filter(v => new Date(v.scheduled_time).toDateString() === new Date().toDateString()).length },
            { key: 'planned', label: 'Planned', count: visits.filter(v => v.status === 'planned').length },
            { key: 'completed', label: 'Completed', count: visits.filter(v => v.status === 'completed').length },
            { key: 'all', label: 'All Visits', count: visits.length }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Visits Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {getVisitsByTab().map(visit => (
          <div key={visit.id} className="card hover:shadow-lg transition-shadow">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <h3 className="font-medium text-gray-900">{visit.customer_name}</h3>
                </div>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(visit.status)}`}>
                  {visit.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{visit.customer_address}</p>
            </div>

            <div className="space-y-3">
              {/* Visit Details */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center text-gray-600">
                  <Clock className="h-4 w-4 mr-1" />
                  {new Date(visit.scheduled_time).toLocaleString()}
                </div>
                <div className="flex items-center space-x-1">
                  {visit.purpose.map(purpose => (
                    <span key={purpose} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                      {purpose}
                    </span>
                  ))}
                </div>
              </div>

              {/* Activities Progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Activities</span>
                  <span className="text-xs text-gray-500">
                    {visit.activities.filter(a => a.completed).length}/{visit.activities.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {visit.activities.slice(0, 3).map(activity => (
                    <div key={activity.id} className="flex items-center space-x-2">
                      <div className={`p-1 rounded ${activity.completed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                        {getActivityIcon(activity.type)}
                      </div>
                      <span className={`text-sm ${activity.completed ? 'text-gray-900' : 'text-gray-500'}`}>
                        {activity.title}
                      </span>
                      {activity.completed && <CheckCircle className="h-4 w-4 text-green-500" />}
                    </div>
                  ))}
                  {visit.activities.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{visit.activities.length - 3} more activities
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex space-x-2">
                  <button
                    onClick={() => setSelectedVisit(visit)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button className="text-green-600 hover:text-green-800">
                    <Edit className="h-4 w-4" />
                  </button>
                  {visit.status === 'planned' && (
                    <button className="text-red-600 hover:text-red-800">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {visit.status === 'planned' && (
                  <button className="btn-sm btn-primary">
                    Start Visit
                  </button>
                )}
                {visit.status === 'in_progress' && (
                  <button className="btn-sm btn-success">
                    Complete Visit
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* AI Insights Panel */}
      <AIInsightsPanel 
        module="field_agents" 
        entityId={agent.id}
        className="lg:col-span-2"
      />
    </div>
  )
}
