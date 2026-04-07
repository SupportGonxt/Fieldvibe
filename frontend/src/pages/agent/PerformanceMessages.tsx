import React, { useState, useEffect, useCallback } from 'react'
import { Bell, ChevronDown, ChevronUp, TrendingUp, Users, Store, User, Target, Clock, Zap } from 'lucide-react'
import { apiClient } from '../../services/api.service'
import { toast } from 'react-hot-toast'

interface PerformanceMessage {
  id: string
  title: string
  message: string
  type: string
  is_read: number
  created_at: string
}

interface ParsedMetrics {
  todayTotal: number
  todayIndividual: number
  todayStore: number
  mtdTotal: number
  mtdIndividual: number
  mtdStore: number
  individualTarget: number
  individualAch: number
  storeTarget: number
  storeAch: number
  topAgent: string | null
  topAgentCount: number
  teamInfo: string
}

function parseMessage(msg: string): ParsedMetrics {
  const metrics: ParsedMetrics = {
    todayTotal: 0, todayIndividual: 0, todayStore: 0,
    mtdTotal: 0, mtdIndividual: 0, mtdStore: 0,
    individualTarget: 0, individualAch: 0,
    storeTarget: 0, storeAch: 0,
    topAgent: null, topAgentCount: 0,
    teamInfo: ''
  }

  // Parse "Today: X visits (Y individual, Z store)"
  const todayMatch = msg.match(/Today:\s*(\d+)\s*visits\s*\((\d+)\s*individual,\s*(\d+)\s*store\)/)
  if (todayMatch) {
    metrics.todayTotal = parseInt(todayMatch[1])
    metrics.todayIndividual = parseInt(todayMatch[2])
    metrics.todayStore = parseInt(todayMatch[3])
  }

  // Parse "MTD: X visits (Y individual, Z store)"
  const mtdMatch = msg.match(/MTD:\s*(\d+)\s*visits\s*\((\d+)\s*individual,\s*(\d+)\s*store\)/)
  if (mtdMatch) {
    metrics.mtdTotal = parseInt(mtdMatch[1])
    metrics.mtdIndividual = parseInt(mtdMatch[2])
    metrics.mtdStore = parseInt(mtdMatch[3])
  }

  // Parse "Individual: X% of Y target"
  const indivMatch = msg.match(/Individual:\s*(\d+)%\s*of\s*(\d+)\s*target/)
  if (indivMatch) {
    metrics.individualAch = parseInt(indivMatch[1])
    metrics.individualTarget = parseInt(indivMatch[2])
  }

  // Parse "Store: X% of Y target"
  const storeMatch = msg.match(/Store:\s*(\d+)%\s*of\s*(\d+)\s*target/)
  if (storeMatch) {
    metrics.storeAch = parseInt(storeMatch[1])
    metrics.storeTarget = parseInt(storeMatch[2])
  }

  // Parse "Top today: Name (X visits)"
  const topMatch = msg.match(/Top today:\s*(.+?)\s*\((\d+)\s*visits?\)/)
  if (topMatch) {
    metrics.topAgent = topMatch[1]
    metrics.topAgentCount = parseInt(topMatch[2])
  }

  // Parse "Team: ..."
  const teamMatch = msg.match(/Team:\s*(.+)$/)
  if (teamMatch) {
    metrics.teamInfo = teamMatch[1].trim()
  }

  return metrics
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

function getAchColor(ach: number): string {
  if (ach >= 100) return 'text-[#00E87B]'
  if (ach >= 75) return 'text-amber-400'
  if (ach >= 50) return 'text-orange-400'
  return 'text-red-400'
}

function getAchBg(ach: number): string {
  if (ach >= 100) return 'bg-[#00E87B]'
  if (ach >= 75) return 'bg-amber-500'
  if (ach >= 50) return 'bg-orange-500'
  return 'bg-red-500'
}

export default function PerformanceMessages() {
  const [messages, setMessages] = useState<PerformanceMessage[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const [generating, setGenerating] = useState(false)

  const fetchMessages = useCallback(async () => {
    try {
      const res = await apiClient.get('/performance-messages')
      const data = res.data?.data || { messages: [], unread_count: 0 }
      setMessages(data.messages || [])
      setUnreadCount(data.unread_count || 0)
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMessages()
    // Poll every 5 minutes for new messages
    const interval = setInterval(fetchMessages, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  const markAsRead = async (id: string) => {
    try {
      await apiClient.put(`/notifications/${id}/read`)
      setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: 1 } : m))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch { /* silent */ }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await apiClient.post('/performance-messages/generate')
      toast.success('Performance summaries generated')
      await fetchMessages()
    } catch {
      toast.error('Failed to generate summaries')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="px-5 mb-4">
        <div className="bg-gradient-to-r from-[#0A1628] to-[#0E1D35] border border-white/10 rounded-2xl p-4">
          <div className="w-40 h-4 bg-gray-800 rounded animate-pulse mb-3" />
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="w-full h-16 bg-gray-800/50 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Get latest message for the summary card
  const latest = messages.length > 0 ? messages[0] : null
  const latestMetrics = latest ? parseMessage(latest.message) : null

  return (
    <div className="px-5 mb-4">
      <div className="bg-gradient-to-br from-indigo-900/30 via-[#0A1628] to-violet-900/20 border border-indigo-500/20 rounded-2xl overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <Bell className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                Performance Updates
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {unreadCount}
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-gray-500">Hourly team summary (8am-5pm)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); handleGenerate() }}
              disabled={generating}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded bg-indigo-500/10 disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Refresh'}
            </button>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </div>
        </button>

        {expanded && (
          <div className="px-4 pb-4">
            {/* Latest summary card */}
            {latestMetrics && latest && (
              <div 
                className={`rounded-xl p-3 mb-3 border ${!latest.is_read ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-white/5 border-white/10'}`}
                onClick={() => { if (!latest.is_read) markAsRead(latest.id) }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> {latest.title}
                  </span>
                  <span className="text-[10px] text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatTime(latest.created_at)}
                  </span>
                </div>

                {/* Today's stats */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <TrendingUp className="w-3 h-3 text-[#00E87B]" />
                    </div>
                    <p className="text-lg font-bold text-white">{latestMetrics.todayTotal}</p>
                    <p className="text-[9px] text-gray-500 uppercase">Today</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <User className="w-3 h-3 text-cyan-400" />
                    </div>
                    <p className="text-lg font-bold text-white">{latestMetrics.todayIndividual}</p>
                    <p className="text-[9px] text-gray-500 uppercase">Individual</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Store className="w-3 h-3 text-purple-400" />
                    </div>
                    <p className="text-lg font-bold text-white">{latestMetrics.todayStore}</p>
                    <p className="text-[9px] text-gray-500 uppercase">Store</p>
                  </div>
                </div>

                {/* MTD Progress */}
                <div className="space-y-2">
                  {latestMetrics.individualTarget > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <User className="w-3 h-3" /> Individual MTD
                        </span>
                        <span className={`text-[10px] font-semibold ${getAchColor(latestMetrics.individualAch)}`}>
                          {latestMetrics.mtdIndividual}/{latestMetrics.individualTarget} ({latestMetrics.individualAch}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${getAchBg(latestMetrics.individualAch)}`} style={{ width: `${Math.min(100, latestMetrics.individualAch)}%` }} />
                      </div>
                    </div>
                  )}
                  {latestMetrics.storeTarget > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Store className="w-3 h-3" /> Store MTD
                        </span>
                        <span className={`text-[10px] font-semibold ${getAchColor(latestMetrics.storeAch)}`}>
                          {latestMetrics.mtdStore}/{latestMetrics.storeTarget} ({latestMetrics.storeAch}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${getAchBg(latestMetrics.storeAch)}`} style={{ width: `${Math.min(100, latestMetrics.storeAch)}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Top agent & team info */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                  {latestMetrics.topAgent ? (
                    <span className="text-[10px] text-amber-400 flex items-center gap-1">
                      <Target className="w-3 h-3" /> Top: {latestMetrics.topAgent} ({latestMetrics.topAgentCount})
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-500">No visits yet today</span>
                  )}
                  <span className="text-[10px] text-gray-500 flex items-center gap-1">
                    <Users className="w-3 h-3" /> {latestMetrics.teamInfo}
                  </span>
                </div>
              </div>
            )}

            {/* Previous messages (collapsed list) */}
            {messages.length > 1 && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Earlier Updates</p>
                {messages.slice(1, 6).map((msg) => {
                  const metrics = parseMessage(msg.message)
                  return (
                    <div
                      key={msg.id}
                      onClick={() => { if (!msg.is_read) markAsRead(msg.id) }}
                      className={`rounded-lg p-2.5 flex items-center gap-2 cursor-pointer transition-colors ${!msg.is_read ? 'bg-indigo-500/10 border border-indigo-500/15' : 'bg-white/3 border border-white/5 hover:bg-white/5'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-white truncate">{msg.title}</span>
                          <span className="text-[9px] text-gray-500 ml-2 flex-shrink-0">{formatTime(msg.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] text-gray-400">
                            Today: {metrics.todayTotal}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            MTD: {metrics.mtdTotal}
                          </span>
                          {metrics.individualAch > 0 && (
                            <span className={`text-[10px] font-semibold ${getAchColor(metrics.individualAch)}`}>
                              {metrics.individualAch}%
                            </span>
                          )}
                        </div>
                      </div>
                      {!msg.is_read && (
                        <div className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {messages.length === 0 && (
              <div className="text-center py-4">
                <Bell className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No performance updates yet today</p>
                <p className="text-[10px] text-gray-600 mt-1">Updates arrive hourly from 8am-5pm</p>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg bg-indigo-500/10 disabled:opacity-50"
                >
                  {generating ? 'Generating...' : 'Generate Now'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
