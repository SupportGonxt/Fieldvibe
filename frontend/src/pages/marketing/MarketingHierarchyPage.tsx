import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fieldOperationsService } from '../../services/field-operations.service'
import { apiClient } from '../../services/api.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { Users, ChevronDown, ChevronRight, UserPlus, Shield, Crown, User, Link2, Unlink, X, ArrowRightLeft } from 'lucide-react'
import { toast } from 'react-hot-toast'
import SearchableSelect from '../../components/ui/SearchableSelect'

type CreateRole = 'manager' | 'team_lead' | 'agent'

interface CreateForm {
  firstName: string
  lastName: string
  email: string
  phone: string
  role: CreateRole
  managerId: string
  teamLeadId: string
}

const EMPTY_FORM: CreateForm = { firstName: '', lastName: '', email: '', phone: '', role: 'agent', managerId: '', teamLeadId: '' }

export default function MarketingHierarchyPage() {
  const queryClient = useQueryClient()
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set())
  const [expandedTeamLeads, setExpandedTeamLeads] = useState<Set<string>>(new Set())
  const [assigningUser, setAssigningUser] = useState<string | null>(null)
  const [assignTarget, setAssignTarget] = useState('')
  const [reassigningUser, setReassigningUser] = useState<{ id: string; type: 'agent' | 'team_lead'; name: string } | null>(null)
  const [reassignTarget, setReassignTarget] = useState('')

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState('')

  const { data: hierarchy, isLoading, error } = useQuery({
    queryKey: ['marketing-hierarchy'],
    queryFn: () => fieldOperationsService.getMarketingHierarchy(),
  })

  const assignMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: { manager_id?: string | null; team_lead_id?: string | null } }) =>
      fieldOperationsService.assignMarketingHierarchy(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-hierarchy'] })
      toast.success('Hierarchy updated')
      setAssigningUser(null)
      setAssignTarget('')
      setReassigningUser(null)
      setReassignTarget('')
    },
    onError: () => toast.error('Failed to update hierarchy'),
  })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.firstName || !createForm.lastName) {
      toast.error('First name and last name are required')
      return
    }
    setCreating(true)
    try {
      const payload: Record<string, string | null> = {
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        phone: createForm.phone || null,
        role: createForm.role,
        agent_type: 'marketing',
      }
      if (createForm.email) {
        payload.email = createForm.email
      }
      if (createForm.role === 'team_lead' && createForm.managerId) {
        payload.managerId = createForm.managerId
      }
      if (createForm.role === 'agent' && createForm.teamLeadId) {
        payload.teamLeadId = createForm.teamLeadId
      }
      const res = await apiClient.post('/users', payload)
      const data = res.data?.data || res.data || {}
      setGeneratedPassword(data.password || '')
      queryClient.invalidateQueries({ queryKey: ['marketing-hierarchy'] })
      toast.success(`${createForm.role === 'team_lead' ? 'Team Lead' : createForm.role === 'manager' ? 'Manager' : 'Agent'} created`)
      if (!data.password) {
        closeCreateModal()
      }
    } catch (err: unknown) {
      const message = (err && typeof err === 'object' && 'message' in err) ? (err as { message: string }).message : 'Failed to create user'
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  function closeCreateModal() {
    setShowCreateModal(false)
    setCreateForm(EMPTY_FORM)
    setGeneratedPassword('')
  }

  function toggleManager(id: string) {
    const next = new Set(expandedManagers)
    next.has(id) ? next.delete(id) : next.add(id)
    setExpandedManagers(next)
  }

  function toggleTeamLead(id: string) {
    const next = new Set(expandedTeamLeads)
    next.has(id) ? next.delete(id) : next.add(id)
    setExpandedTeamLeads(next)
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Failed to load marketing hierarchy data.
        </div>
      </div>
    )
  }

  const managers = hierarchy?.hierarchy || []
  const unassignedTeamLeads = hierarchy?.unassigned_team_leads || []
  const unassignedAgents = hierarchy?.unassigned_agents || []

  // Build lists for assignment dropdowns
  const allTeamLeads = [
    ...managers.flatMap((m: any) => (m.team_leads || []).map((tl: any) => ({ value: tl.id, label: `${tl.first_name} ${tl.last_name}` }))),
    ...unassignedTeamLeads.map((tl: any) => ({ value: tl.id, label: `${tl.first_name} ${tl.last_name}` }))
  ]
  const allManagers = managers.map((m: any) => ({ value: m.id, label: `${m.first_name} ${m.last_name}` }))

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Marketing Hierarchy</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage the Marketing Agent &rarr; Team Lead &rarr; Manager hierarchy
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-semibold rounded-lg transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add Person
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30"><Crown className="w-5 h-5 text-purple-600" /></div>
          <div>
            <p className="text-sm text-gray-500">Managers</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{hierarchy?.total_managers || 0}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30"><Shield className="w-5 h-5 text-blue-600" /></div>
          <div>
            <p className="text-sm text-gray-500">Team Leads</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{hierarchy?.total_team_leads || 0}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-900/30"><User className="w-5 h-5 text-pink-600" /></div>
          <div>
            <p className="text-sm text-gray-500">Marketing Agents</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{hierarchy?.total_agents || 0}</p>
          </div>
        </div>
      </div>

      {/* Hierarchy Tree */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Marketing Organization Tree</h3>
        
        {managers.length === 0 && unassignedTeamLeads.length === 0 && unassignedAgents.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-lg font-medium">No marketing hierarchy configured</p>
            <p className="text-gray-400 text-sm">Click &ldquo;Add Person&rdquo; above to create marketing managers, team leads, and agents</p>
          </div>
        )}

        {/* Managers */}
        {managers.map((manager: any) => (
          <div key={manager.id} className="mb-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition">
              <button
                onClick={() => toggleManager(manager.id)}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                {expandedManagers.has(manager.id) ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                <Crown className="w-5 h-5 text-purple-600 flex-shrink-0" />
                <span className="font-semibold text-gray-900 dark:text-white truncate">{manager.first_name} {manager.last_name}</span>
              </button>
              <span className="text-sm text-gray-500 flex-shrink-0">{manager.team_leads?.length || 0} team leads</span>
            </div>

            {expandedManagers.has(manager.id) && (
              <div className="ml-8 mt-2 space-y-2">
                {(manager.team_leads || []).map((tl: any) => (
                  <div key={tl.id}>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition">
                      <button onClick={() => toggleTeamLead(tl.id)} className="flex items-center gap-3 flex-1 min-w-0">
                        {expandedTeamLeads.has(tl.id) ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                        <Shield className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <span className="font-medium text-gray-900 dark:text-white truncate">{tl.first_name} {tl.last_name}</span>
                        <span className="text-sm text-gray-500 ml-auto flex-shrink-0">{tl.agents?.length || 0} agents</span>
                      </button>
                      <button
                        onClick={() => setReassigningUser({ id: tl.id, type: 'team_lead', name: `${tl.first_name} ${tl.last_name}` })}
                        className="text-gray-400 hover:text-blue-600 p-1 rounded flex-shrink-0"
                        title="Reassign to another manager"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => assignMutation.mutate({ userId: tl.id, data: { manager_id: null } })}
                        className="text-gray-400 hover:text-red-500 p-1 rounded flex-shrink-0"
                        title="Unassign from manager"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {expandedTeamLeads.has(tl.id) && (
                      <div className="ml-8 mt-1 space-y-1">
                        {(tl.agents || []).map((agent: any) => (
                          <div key={agent.id} className="flex items-center gap-3 p-2 rounded-lg bg-pink-50 dark:bg-pink-900/20">
                            <User className="w-4 h-4 text-pink-600 flex-shrink-0" />
                            <span className="text-gray-900 dark:text-white truncate">{agent.first_name} {agent.last_name}</span>
                            <div className="ml-auto flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => setReassigningUser({ id: agent.id, type: 'agent', name: `${agent.first_name} ${agent.last_name}` })}
                                className="text-gray-400 hover:text-pink-600 p-1 rounded"
                                title="Reassign to another team lead"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => assignMutation.mutate({ userId: agent.id, data: { team_lead_id: null } })}
                                className="text-gray-400 hover:text-red-500 p-1 rounded"
                                title="Unassign from team lead"
                              >
                                <Unlink className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {(tl.agents || []).length === 0 && (
                          <p className="text-sm text-gray-400 pl-7 py-1">No agents assigned</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {(manager.team_leads || []).length === 0 && (
                  <p className="text-sm text-gray-400 pl-7 py-1">No team leads assigned</p>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Unassigned Team Leads */}
        {unassignedTeamLeads.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">Unassigned Team Leads</h4>
            <div className="space-y-2">
              {unassignedTeamLeads.map((tl: any) => (
                <div key={tl.id} className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                  <Shield className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                  <span className="text-gray-900 dark:text-white truncate">{tl.first_name} {tl.last_name}</span>
                  {assigningUser === tl.id ? (
                    <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                      <SearchableSelect
                        options={allManagers}
                        value={assignTarget || null}
                        onChange={(val) => setAssignTarget(val || '')}
                        placeholder="Select Manager"
                      />
                      <button
                        onClick={() => { if (assignTarget) assignMutation.mutate({ userId: tl.id, data: { manager_id: assignTarget } }) }}
                        disabled={!assignTarget}
                        className="text-green-600 text-sm font-medium disabled:opacity-50"
                      >
                        Assign
                      </button>
                      <button onClick={() => { setAssigningUser(null); setAssignTarget('') }} className="text-gray-400 text-sm">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => { setAssigningUser(tl.id); setAssignTarget('') }} className="ml-auto text-blue-600 text-sm flex items-center gap-1 flex-shrink-0">
                      <Link2 className="w-3 h-3" /> Assign to Manager
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unassigned Agents */}
        {unassignedAgents.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">Unassigned Marketing Agents</h4>
            <div className="space-y-2">
              {unassignedAgents.map((agent: any) => (
                <div key={agent.id} className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                  <User className="w-5 h-5 text-orange-600 flex-shrink-0" />
                  <span className="text-gray-900 dark:text-white truncate">{agent.first_name} {agent.last_name}</span>
                  {assigningUser === agent.id ? (
                    <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                      <SearchableSelect
                        options={allTeamLeads}
                        value={assignTarget || null}
                        onChange={(val) => setAssignTarget(val || '')}
                        placeholder="Select Team Lead"
                      />
                      <button
                        onClick={() => { if (assignTarget) assignMutation.mutate({ userId: agent.id, data: { team_lead_id: assignTarget } }) }}
                        disabled={!assignTarget}
                        className="text-green-600 text-sm font-medium disabled:opacity-50"
                      >
                        Assign
                      </button>
                      <button onClick={() => { setAssigningUser(null); setAssignTarget('') }} className="text-gray-400 text-sm">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => { setAssigningUser(agent.id); setAssignTarget('') }} className="ml-auto text-blue-600 text-sm flex items-center gap-1 flex-shrink-0">
                      <Link2 className="w-3 h-3" /> Assign to Team Lead
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reassign Modal */}
      {reassigningUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1A1F2E] rounded-xl max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-white/10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Reassign {reassigningUser.name}</h3>
              <button onClick={() => { setReassigningUser(null); setReassignTarget('') }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select a new {reassigningUser.type === 'team_lead' ? 'manager' : 'team lead'} for {reassigningUser.name}:
              </p>
              <SearchableSelect
                options={reassigningUser.type === 'team_lead' ? allManagers : allTeamLeads}
                value={reassignTarget || null}
                onChange={(val) => setReassignTarget(val || '')}
                placeholder={`Select ${reassigningUser.type === 'team_lead' ? 'Manager' : 'Team Lead'}`}
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => { setReassigningUser(null); setReassignTarget('') }}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-surface-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!reassignTarget) return
                    const data = reassigningUser.type === 'team_lead'
                      ? { manager_id: reassignTarget }
                      : { team_lead_id: reassignTarget }
                    assignMutation.mutate({ userId: reassigningUser.id, data })
                  }}
                  disabled={!reassignTarget || assignMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-700 text-white font-medium disabled:opacity-50"
                >
                  Reassign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Person Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1A1F2E] rounded-xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-white/10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Marketing Person</h3>
              <button onClick={closeCreateModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {generatedPassword ? (
              <div className="p-5 space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <p className="text-green-800 dark:text-green-200 font-medium">Person created successfully!</p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">Default password:</p>
                  <code className="block mt-1 text-lg font-mono font-bold text-green-900 dark:text-green-100">{generatedPassword}</code>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2">Share this password securely. They can change it after logging in.</p>
                </div>
                <button onClick={closeCreateModal} className="w-full px-4 py-2 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 font-medium">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="p-5 space-y-4">
                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'manager' as const, label: 'Manager', icon: Crown, activeBorder: 'border-purple-500', activeBg: 'bg-purple-50 dark:bg-purple-900/20', iconColor: 'text-purple-600' },
                      { value: 'team_lead' as const, label: 'Team Lead', icon: Shield, activeBorder: 'border-blue-500', activeBg: 'bg-blue-50 dark:bg-blue-900/20', iconColor: 'text-blue-600' },
                      { value: 'agent' as const, label: 'Agent', icon: User, activeBorder: 'border-pink-500', activeBg: 'bg-pink-50 dark:bg-pink-900/20', iconColor: 'text-pink-600' },
                    ]).map(({ value, label, icon: Icon, activeBorder, activeBg, iconColor }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setCreateForm(f => ({ ...f, role: value, managerId: '', teamLeadId: '' }))}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${
                          createForm.role === value
                            ? `${activeBorder} ${activeBg}`
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${iconColor}`} />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name <span className="text-red-500">*</span></label>
                    <input
                      value={createForm.firstName}
                      onChange={e => setCreateForm(f => ({ ...f, firstName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name <span className="text-red-500">*</span></label>
                    <input
                      value={createForm.lastName}
                      onChange={e => setCreateForm(f => ({ ...f, lastName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                {/* Contact */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={createForm.phone}
                    onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Assignment */}
                {createForm.role === 'team_lead' && allManagers.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign to Manager</label>
                    <SearchableSelect
                      options={allManagers}
                      value={createForm.managerId || null}
                      onChange={(val) => setCreateForm(f => ({ ...f, managerId: val || '' }))}
                      placeholder="Select Manager (optional)"
                    />
                  </div>
                )}
                {createForm.role === 'agent' && allTeamLeads.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign to Team Lead</label>
                    <SearchableSelect
                      options={allTeamLeads}
                      value={createForm.teamLeadId || null}
                      onChange={(val) => setCreateForm(f => ({ ...f, teamLeadId: val || '' }))}
                      placeholder="Select Team Lead (optional)"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={closeCreateModal} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-surface-secondary">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-700 text-white font-medium disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
