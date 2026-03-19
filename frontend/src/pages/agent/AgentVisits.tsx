import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Clock, CheckCircle, Filter, Search, ChevronRight, Calendar, XCircle } from 'lucide-react'

interface Visit {
  id: string
  visit_date: string
  visit_type: string
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
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchVisits()
  }, [])

  const fetchVisits = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) { navigate('/auth/mobile-login'); return }
      const apiUrl = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${apiUrl}/api/field-operations/visits?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const json = await res.json()
      if (json.success) {
        const data = json.data
        setVisits(Array.isArray(data) ? data : data?.results || data?.visits || [])
      }
    } catch (err) {
      console.error('Fetch visits error:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = visits.filter(v => {
    if (filter !== 'all' && v.status !== filter) return false
    if (search) {
      const s = search.toLowerCase()
      return (v.customer_name || '').toLowerCase().includes(s) ||
        (v.individual_name || '').toLowerCase().includes(s) ||
        (v.visit_type || '').toLowerCase().includes(s)
    }
    return true
  })

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

  return (
    <div className="min-h-screen bg-[#06090F] pb-24">
      {/* Header */}
      <div className="bg-[#0A1628] px-5 pt-5 pb-4 border-b border-white/5">
        <h1 className="text-xl font-bold text-white mb-3">My Visits</h1>
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
        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all', 'completed', 'in_progress', 'pending'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f ? 'bg-[#00E87B] text-[#0A1628]' : 'bg-white/5 text-gray-400 border border-white/10'
              }`}
            >
              {f === 'all' ? 'All' : f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}
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
            <MapPin className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No visits found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((visit) => (
              <button
                key={visit.id}
                onClick={() => navigate(`/field-operations/visits/${visit.id}`)}
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
                    <span className="text-xs text-gray-500">{visit.visit_type}</span>
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
