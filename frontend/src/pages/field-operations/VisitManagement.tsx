import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { 
  Calendar, MapPin, Users, Clock, Plus, Search, Filter, 
  Edit2, Trash2, Eye, CheckCircle, XCircle, AlertCircle,
  Download, ChevronDown, MoreVertical 
} from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { apiClient } from '../../services/api.service'
import { useToast } from '../../components/ui/Toast'

interface Visit {
  id: string
  agent_id: string
  agent_name: string
  customer_id: string
  customer_name: string
  customer_phone: string
  visit_date: string
  visit_type: string
  purpose: string
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled'
  check_in_time: string | null
  check_out_time: string | null
  latitude: number | null
  longitude: number | null
  notes: string
  route_name: string
  area_name: string
}

interface VisitStats {
  total_visits: number
  today_visits: number
  completed_visits: number
  avg_duration_minutes: number
}

interface Agent {
  id: string
  user_id: string
  first_name: string
  last_name: string
  phone: string
  status: string
}

interface Customer {
  id: string
  name: string
  phone: string
  business_name: string
  address: string
}

const VisitManagement: React.FC = () => {
  const { toast } = useToast()
  const { user } = useAuthStore()
  const [visits, setVisits] = useState<Visit[]>([])
  const [stats, setStats] = useState<VisitStats | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterAgent, setFilterAgent] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  
  // Form state
  const [formData, setFormData] = useState({
    agent_id: '',
    customer_id: '',
    visit_date: '',
    visit_type: 'routine',
    purpose: '',
    status: 'planned'
  })

  useEffect(() => {
    fetchVisits()
    fetchAgents()
    fetchCustomers()
  }, [filterStatus, filterAgent, filterType, dateFrom, dateTo])

  const fetchVisits = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterStatus !== 'all') params.append('status', filterStatus)
      if (filterAgent !== 'all') params.append('agent_id', filterAgent)
      if (filterType !== 'all') params.append('visit_type', filterType)
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)
      
      const response = await apiClient.get(`/visits?${params.toString()}`)
      setVisits(response.data.data.visits || [])
      setStats(response.data.data.stats || null)
    } catch (error) {
      console.error('Error fetching visits:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAgents = async () => {
    try {
      const response = await apiClient.get('/agents')
      setAgents(response.data.data || [])
    } catch (error) {
      console.error('Error fetching agents:', error)
    }
  }

  const fetchCustomers = async () => {
    try {
      const response = await apiClient.get('/customers')
      setCustomers(response.data.data || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
    }
  }

  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await apiClient.post('/visits', formData)
      setShowCreateModal(false)
      resetForm()
      fetchVisits()
      toast.success('Visit created successfully!')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error creating visit')
    }
  }

  const handleUpdateVisit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedVisit) return
    
    try {
      await apiClient.put(`/visits/${selectedVisit.id}`, formData)
      setShowEditModal(false)
      setSelectedVisit(null)
      resetForm()
      fetchVisits()
      toast.success('Visit updated successfully!')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error updating visit')
    }
  }

  const handleDeleteVisit = async (visitId: string) => {
    if (!confirm('Are you sure you want to delete this visit?')) return
    
    try {
      await apiClient.delete(`/visits/${visitId}`)
      fetchVisits()
      toast.success('Visit deleted successfully!')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error deleting visit')
    }
  }

  const openEditModal = (visit: Visit) => {
    setSelectedVisit(visit)
    setFormData({
      agent_id: visit.agent_id,
      customer_id: visit.customer_id,
      visit_date: visit.visit_date.split('T')[0],
      visit_type: visit.visit_type,
      purpose: visit.purpose,
      status: visit.status
    })
    setShowEditModal(true)
  }

  const resetForm = () => {
    setFormData({
      agent_id: '',
      customer_id: '',
      visit_date: '',
      visit_type: 'routine',
      purpose: '',
      status: 'planned'
    })
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      planned: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    return badges[status as keyof typeof badges] || badges.planned
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'cancelled': return <XCircle className="w-4 h-4" />
      case 'in_progress': return <AlertCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const filteredVisits = visits.filter(visit =>
    visit.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    visit.agent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    visit.purpose?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visit Management</h1>
          <p className="text-sm text-gray-500 mt-1">Schedule and manage field agent visits</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Schedule Visit
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Visits (7 Days)</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_visits}</p>
              </div>
              <Calendar className="w-10 h-10 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today's Visits</p>
                <p className="text-2xl font-bold text-gray-900">{stats.today_visits}</p>
              </div>
              <MapPin className="w-10 h-10 text-green-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completed_visits}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-purple-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg. Duration</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.round(stats.avg_duration_minutes || 0)}m
                </p>
              </div>
              <Clock className="w-10 h-10 text-orange-500" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search visits..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="planned">Planned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Agent Filter */}
          <div>
            <select
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Agents</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.first_name} {agent.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="routine">Routine</option>
              <option value="follow_up">Follow Up</option>
              <option value="new_customer">New Customer</option>
              <option value="delivery">Delivery</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="flex gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="From"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="To"
            />
          </div>
        </div>
      </div>

      {/* Visit List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-surface-secondary">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Visit Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Purpose
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    Loading visits...
                  </td>
                </tr>
              ) : filteredVisits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No visits found
                  </td>
                </tr>
              ) : (
                filteredVisits.map((visit) => (
                  <tr key={visit.id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{visit.customer_name}</div>
                        <div className="text-sm text-gray-500">{visit.customer_phone}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {visit.agent_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(visit.visit_date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                      {visit.visit_type?.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(visit.status)}`}>
                        {getStatusIcon(visit.status)}
                        {visit.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {visit.purpose || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(visit)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteVisit(visit.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Visit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Schedule New Visit</h2>
              <form onSubmit={handleCreateVisit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Agent Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Agent *
                    </label>
                    <select
                      required
                      value={formData.agent_id}
                      onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Agent</option>
                      {agents.map(agent => (
                        <option key={agent.id} value={agent.id}>
                          {agent.first_name} {agent.last_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Customer Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer *
                    </label>
                    <select
                      required
                      value={formData.customer_id}
                      onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Customer</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} {customer.business_name ? `(${customer.business_name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Visit Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Visit Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.visit_date}
                      onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Visit Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Visit Type *
                    </label>
                    <select
                      required
                      value={formData.visit_type}
                      onChange={(e) => setFormData({ ...formData, visit_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="routine">Routine</option>
                      <option value="follow_up">Follow Up</option>
                      <option value="new_customer">New Customer</option>
                      <option value="delivery">Delivery</option>
                      <option value="collection">Collection</option>
                      <option value="survey">Survey</option>
                    </select>
                  </div>
                </div>

                {/* Purpose */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Purpose/Objective
                  </label>
                  <textarea
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Describe the purpose of this visit..."
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => { setShowCreateModal(false); resetForm(); }}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-surface-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Schedule Visit
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Visit Modal */}
      {showEditModal && selectedVisit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Visit</h2>
              <form onSubmit={handleUpdateVisit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Same fields as create modal */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Agent *</label>
                    <select
                      required
                      value={formData.agent_id}
                      onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Agent</option>
                      {agents.map(agent => (
                        <option key={agent.id} value={agent.id}>
                          {agent.first_name} {agent.last_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                    <select
                      required
                      value={formData.customer_id}
                      onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Customer</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} {customer.business_name ? `(${customer.business_name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Visit Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.visit_date}
                      onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Visit Type *</label>
                    <select
                      required
                      value={formData.visit_type}
                      onChange={(e) => setFormData({ ...formData, visit_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="routine">Routine</option>
                      <option value="follow_up">Follow Up</option>
                      <option value="new_customer">New Customer</option>
                      <option value="delivery">Delivery</option>
                      <option value="collection">Collection</option>
                      <option value="survey">Survey</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                    <select
                      required
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="planned">Planned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purpose/Objective</label>
                  <textarea
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => { setShowEditModal(false); setSelectedVisit(null); resetForm(); }}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-surface-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Update Visit
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VisitManagement
