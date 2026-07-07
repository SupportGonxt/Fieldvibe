import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../services/api.service'
import { fieldOperationsService } from '../../services/field-operations.service'
import SearchableSelect from '../../components/ui/SearchableSelect'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import {
  Mail, Copy, Trash2, Plus, Eye, EyeOff, ChevronUp, ChevronDown, Save, Loader2, Users, LayoutGrid,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface PortalUser {
  id: string
  tenant_id: string
  company_id: string
  email: string
  status: string
  invite_expires_at: string | null
  created_by: string | null
  created_at: string
}

interface Widget {
  type: string
  title: string
  source: string
  options: Record<string, any>
}

const fmt = (d: string | null) => d ? new Date(d).toLocaleString() : '—'

export default function PortalSetup() {
  // ── Company selector (mirrors StoreInsights) ──
  const { data: companiesResp } = useQuery({
    queryKey: ['field-companies'],
    queryFn: () => fieldOperationsService.getCompanies(),
  })
  const companies = companiesResp?.data || companiesResp || []
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  useEffect(() => {
    if (Array.isArray(companies) && companies.length > 0 && !selectedCompany) {
      const goldrush = companies.find((c: any) => c.name?.toLowerCase().includes('goldrush'))
      if (goldrush) setSelectedCompany(goldrush.id)
      else if (companies.length === 1) setSelectedCompany(companies[0].id)
    }
  }, [companies, selectedCompany])

  // ── Portal users ──
  const [users, setUsers] = useState<PortalUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null)

  const loadUsers = async () => {
    if (!selectedCompany) return
    setUsersLoading(true)
    try {
      const res = await apiClient.get('/field-ops/portal/users', { params: { company_id: selectedCompany } })
      setUsers(res.data?.data || [])
    } catch {
      toast.error('Failed to load portal users')
    } finally {
      setUsersLoading(false)
    }
  }
  useEffect(() => { loadUsers(); setLastInviteUrl(null) }, [selectedCompany])

  const handleInvite = async () => {
    const email = inviteEmail.trim()
    if (!email || !selectedCompany) return
    setInviting(true)
    try {
      const res = await apiClient.post('/field-ops/portal/users', { email, company_id: selectedCompany })
      const invite = res.data?.data
      setLastInviteUrl(invite?.invite_url || null)
      setInviteEmail('')
      toast.success('Invite created')
      await loadUsers()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create invite')
    } finally {
      setInviting(false)
    }
  }

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Copied')
    } catch {
      toast.error('Failed to copy')
    }
  }

  const handleDisable = async (user: PortalUser) => {
    if (!window.confirm(`Disable portal access for ${user.email}?`)) return
    try {
      await apiClient.delete(`/field-ops/portal/users/${user.id}`)
      toast.success('Portal user disabled')
      await loadUsers()
    } catch {
      toast.error('Failed to disable portal user')
    }
  }

  // ── Dashboard widgets ──
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [widgetsLoading, setWidgetsLoading] = useState(false)
  const [savingWidgets, setSavingWidgets] = useState(false)

  const loadWidgets = async () => {
    if (!selectedCompany) return
    setWidgetsLoading(true)
    try {
      const res = await apiClient.get('/field-ops/portal/dashboard-config', { params: { company_id: selectedCompany } })
      setWidgets(res.data?.data?.widgets || [])
    } catch {
      toast.error('Failed to load dashboard config')
    } finally {
      setWidgetsLoading(false)
    }
  }
  useEffect(() => { loadWidgets() }, [selectedCompany])

  const updateWidget = (index: number, patch: Partial<Widget>) => {
    setWidgets(prev => prev.map((w, i) => i === index ? { ...w, ...patch } : w))
  }
  const toggleHidden = (index: number) => {
    setWidgets(prev => prev.map((w, i) => i === index ? { ...w, options: { ...w.options, hidden: !w.options?.hidden } } : w))
  }
  const moveWidget = (index: number, dir: -1 | 1) => {
    setWidgets(prev => {
      const target = index + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const handleSaveWidgets = async () => {
    if (!selectedCompany) return
    setSavingWidgets(true)
    try {
      const res = await apiClient.put('/field-ops/portal/dashboard-config', { company_id: selectedCompany, widgets })
      setWidgets(res.data?.data?.widgets || widgets)
      toast.success('Dashboard config saved')
    } catch {
      toast.error('Failed to save dashboard config')
    } finally {
      setSavingWidgets(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Portal Setup</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Invite customer portal users and curate their dashboard widgets.</p>
        </div>
        {Array.isArray(companies) && companies.length > 1 && (
          <SearchableSelect
            options={companies.map((c: any) => ({ value: c.id, label: c.name }))}
            value={selectedCompany || null}
            onChange={(val) => setSelectedCompany(val || '')}
            placeholder="Select company"
          />
        )}
      </div>

      {!selectedCompany ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">Select a company to manage its portal.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Portal users panel */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Portal Users</h2>
            </div>

            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleInvite() }}
                placeholder="customer@example.com"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400"
              />
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1"
              >
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Invite
              </button>
            </div>

            {lastInviteUrl && (
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2">
                <Mail className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <input readOnly value={lastInviteUrl} className="flex-1 min-w-0 bg-transparent text-xs text-blue-800 dark:text-blue-300 truncate outline-none" />
                <button onClick={() => handleCopy(lastInviteUrl)} className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-800/40" title="Copy invite link">
                  <Copy className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                </button>
              </div>
            )}

            {usersLoading ? (
              <div className="py-8 flex justify-center"><LoadingSpinner /></div>
            ) : users.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No portal users invited yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Email</th>
                      <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                      <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Invite Expires</th>
                      <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Created</th>
                      <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => {
                      const disabled = u.status === 'disabled'
                      return (
                        <tr key={u.id} className={`border-b border-gray-100 dark:border-gray-700/50 ${disabled ? 'opacity-50' : ''}`}>
                          <td className="py-2 px-2 text-gray-900 dark:text-white whitespace-nowrap">{u.email}</td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              disabled ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                              : u.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            }`}>{u.status}</span>
                          </td>
                          <td className="py-2 px-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">{fmt(u.invite_expires_at)}</td>
                          <td className="py-2 px-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">{fmt(u.created_at)}</td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            {!disabled && (
                              <button onClick={() => handleDisable(u)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20" title="Disable">
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Dashboard widgets panel */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-purple-500" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Dashboard Widgets</h2>
              </div>
              <button
                onClick={handleSaveWidgets}
                disabled={savingWidgets || widgetsLoading}
                className="px-3 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 inline-flex items-center gap-1"
              >
                {savingWidgets ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </button>
            </div>

            {widgetsLoading ? (
              <div className="py-8 flex justify-center"><LoadingSpinner /></div>
            ) : widgets.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No widgets configured.</div>
            ) : (
              <ul className="space-y-2">
                {widgets.map((w, i) => {
                  const hidden = !!w.options?.hidden
                  return (
                    <li key={i} className={`flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-lg p-2 ${hidden ? 'opacity-50' : ''}`}>
                      <div className="flex flex-col">
                        <button onClick={() => moveWidget(i, -1)} disabled={i === 0} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30">
                          <ChevronUp className="w-4 h-4 text-gray-500" />
                        </button>
                        <button onClick={() => moveWidget(i, 1)} disabled={i === widgets.length - 1} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30">
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                      <input
                        value={w.title}
                        onChange={e => updateWidget(i, { title: e.target.value })}
                        className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      />
                      <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:inline">{w.type}</span>
                      <button onClick={() => toggleHidden(i)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title={hidden ? 'Show widget' : 'Hide widget'}>
                        {hidden ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-600 dark:text-gray-300" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
