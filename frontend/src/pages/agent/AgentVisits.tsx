import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Clock, CheckCircle, Search, ChevronRight, Calendar, XCircle, Store, User, Plus } from 'lucide-react'
import { apiClient } from '../../services/api.service'

interface Visit {
  id: string
  visit_date: string
  visit_type: string
  visit_target_type?: string
  status: string
  check_in_time: string
  check_out_time: string
  customer_name: string
  individual_name: string
  notes: string
}

export default function AgentVisits() {
  const navigate = useNavigate()
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'completed' | 'in_progress' | 'pending'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'store' | 'individual'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchVisits()
  }, [])

  const fetchVisits = async () => {
    setLoading(true)
    try {
      const res = await apiClient.get('/field-operations/visits?limit=100&agent_id=me')
      const json = res.data
      // Response format: {data: [...], total: N} (no success field)
      const data = json.data || json
      setVisits(Array.isArray(data) ? data : data?.results || data?.visits || [])
    } catch (err) {
      console.error('Fetch visits error:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    return visits.filter(v => {
      if (filter !== 'all' && v.status !== filter) return false
      if (typeFilter !== 'all') {
        const vType = (v.visit_target_type || v.visit_type || '').toLowerCase()
        if (vType !== typeFilter) return false
      }
      if (search) {
        const s = search.toLowerCase()
        return (v.customer_name || '').toLowerCase().includes(s) ||
          (v.individual_name || '').toLowerCase().includes(s) ||
          (v.visit_type || '').toLowerCase().includes(s)
      }
      return true
    })
  }, [visits, filter, typeFilter, search])

  // Count by type
  const storeCount = useMemo(() => visits.filter(v => (v.visit_target_type || v.visit_type || '').toLowerCase() === 'store').length, [visits])
  const individualCount = useMemo(() => visits.filter(v => (v.visit_target_type || v.visit_type || '').toLowerCase() === 'individual').length, [visits])

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'in_progress': return <Clock className="w-5 h-5 text-blue-400" />
      case 'cancelled': return <XCircle className="w-5 h-5 text-red-400" />
      default: return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/10'
      case 'in_progress': return 'bg-blue-500/10'
      case 'cancelled': return 'bg-red-500/10'
      default: return 'bg-gray-500/10'
    }
  }

  const typeIcon = (visit: Visit) => {
    const type = (visit.visit_target_type || visit.visit_type || '').toLowerCase()
    if (type === 'store') return <Store className="w-3 h-3 text-purple-400" />
    if (type === 'individual') return <User className="w-3 h-3 text-cyan-400" />
    return null
  }

  return (
    <div className="min-h-screen bg-[#06090F] pb-24">
      {/* Header */}
      <div className="bg-[#0A1628] px-5 pt-5 pb-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-white">My Visits</h1>
          <button
            onClick={() => navigate('/agent/visits/create')}
            className="bg-[#00E87B] text-[#0A1628] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> New Visit
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search visits..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#00E87B]/50"
          />
        </div>

        {/* Type filter tabs */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setTypeFilter('all')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              typeFilter === 'all' ? 'bg-[#00E87B] text-[#0A1628]' : 'bg-white/5 text-gray-400 border border-white/10'
            }`}
          >
            All ({visits.length})
          </button>
          <button
            onClick={() => setTypeFilter('store')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
              typeFilter === 'store' ? 'bg-purple-500 text-white' : 'bg-white/5 text-gray-400 border border-white/10'
            }`}
          >
            <Store className="w-3 h-3" /> Stores ({storeCount})
          </button>
          <button
            onClick={() => setTypeFilter('individual')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
              typeFilter === 'individual' ? 'bg-cyan-500 text-white' : 'bg-white/5 text-gray-400 border border-white/10'
            }`}
          >
            <User className="w-3 h-3" /> Individuals ({individualCount})
          </button>
        </div>

        {/* Status filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all', 'completed', 'in_progress', 'pending'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-400 border border-white/10'
              }`}
            >
              {f === 'all' ? 'All Status' : f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-5 pt-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#00E87B] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            {typeFilter === 'store' ? <Store className="w-10 h-10 text-gray-600 mx-auto mb-3" /> :
             typeFilter === 'individual' ? <User className="w-10 h-10 text-gray-600 mx-auto mb-3" /> :
             <MapPin className="w-10 h-10 text-gray-600 mx-auto mb-3" />}
            <p className="text-gray-500 text-sm">No {typeFilter !== 'all' ? `${typeFilter} ` : ''}visits found</p>
            <button
              onClick={() => navigate(`/agent/visits/create${typeFilter !== 'all' ? `?type=${typeFilter}` : ''}`)}
              className="mt-3 text-[#00E87B] text-sm font-medium"
            >
              + Create {typeFilter !== 'all' ? `${typeFilter} ` : ''}visit
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((visit) => (
              <button
                key={visit.id}
                onClick={() => navigate(`/agent/visits/${visit.id}`)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 flex items-center gap-3 active:bg-white/10 transition-colors text-left"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${statusColor(visit.status)}`}>
                  {statusIcon(visit.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {visit.customer_name || visit.individual_name || 'Visit'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      {typeIcon(visit)}
                      {(visit.visit_target_type || visit.visit_type || 'visit').charAt(0).toUpperCase() + (visit.visit_target_type || visit.visit_type || 'visit').slice(1)}
                    </span>
                    <span className="text-[8px] text-gray-600">&bull;</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />{visit.visit_date}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
