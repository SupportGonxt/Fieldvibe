import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fieldOperationsService } from '../../services/field-operations.service'
import { apiClient } from '../../services/api.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { Users, ChevronDown, ChevronRight, UserPlus, Shield, Crown, User, Link2, Unlink, X, ArrowRightLeft, Building2, Plus, Pencil, Check, Mail, Phone, KeyRound } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import SearchableSelect from '../../components/ui/SearchableSelect'

type CreateRole = 'manager' | 'team_lead' | 'agent'

type AgentType = 'field_ops' | 'marketing' | 'both'

interface CreateForm {
  firstName: string
  lastName: string
  email: string
  phone: string
  pin: string
  role: CreateRole
  agentType: AgentType
  managerId: string
  teamLeadId: string
  companyIds: string[]
}

const EMPTY_FORM: CreateForm = { firstName: '', lastName: '', email: '', phone: '', pin: '', role: 'agent', agentType: 'field_ops', managerId: '', teamLeadId: '', companyIds: [] }

export default function AgentHierarchyPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
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

  // Manager-company assignment state
  const [assigningCompanyToManager, setAssigningCompanyToManager] = useState<string | null>(null)
  const [selectedCompany, setSelectedCompany] = useState('')

  // Quick-edit state
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editFields, setEditFields] = useState<{ email: string; phone: string; pin: string }>({ email: '', phone: '', pin: '' })

  const { data: hierarchy, isLoading, error } = useQuery({
    queryKey: ['field-ops-hierarchy'],
    queryFn: () => fieldOperationsService.getHierarchy(),
  })

  const assignMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: { manager_id?: string | null; team_lead_id?: string | null } }) =>
      fieldOperationsService.assignHierarchy(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-ops-hierarchy'] })
      toast.success('Hierarchy updated')
      setAssigningUser(null)
      setAssignTarget('')
      setReassigningUser(null)
      setReassignTarget('')
    },
    onError: () => toast.error('Failed to update hierarchy'),
  })

  const assignCompanyMutation = useMutation({
    mutationFn: ({ managerId, companyId }: { managerId: string; companyId: string }) =>
      fieldOperationsService.assignManagerToCompany(managerId, companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-ops-hierarchy'] })
      toast.success('Company assigned to manager')
      setAssigningCompanyToManager(null)
      setSelectedCompany('')
    },
    onError: () => toast.error('Failed to assign company'),
  })

  const unassignCompanyMutation = useMutation({
    mutationFn: (linkId: string) => fieldOperationsService.unassignManagerFromCompany(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-ops-hierarchy'] })
      toast.success('Company unassigned from manager')
    },
    onError: () => toast.error('Failed to unassign company'),
  })

  const quickEditMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: { email?: string; phone?: string; pin?: string } }) =>
      apiClient.patch(`/users/${userId}/quick-edit`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-ops-hierarchy'] })
      toast.success('Details updated successfully')
      setEditingUser(null)
    },
    onError: (err: unknown) => {
      const message = (err && typeof err === 'object' && 'message' in err) ? (err as { message: string }).message : 'Failed to update details'
      toast.error(message)
    },
  })

  function startQuickEdit(user: { id: string; email?: string; phone?: string }) {
    setEditingUser(user.id)
    setEditFields({
      email: user.email && !user.email.includes('@placeholder.local') ? user.email : '',
      phone: user.phone || '',
      pin: '',
    })
  }

  function saveQuickEdit(userId: string) {
    const data: { email?: string; phone?: string; pin?: string } = {}
    if (editFields.email) data.email = editFields.email
    if (editFields.phone) data.phone = editFields.phone
    if (editFields.pin) data.pin = editFields.pin
    if (Object.keys(data).length === 0) {
      toast.error('No changes to save')
      return
    }
    quickEditMutation.mutate({ userId, data })
  }

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
        agent_type: createForm.agentType,
      }
      if (createForm.email) {
        payload.email = createForm.email
      }
      if (createForm.pin) {
        payload.pin = createForm.pin
      }
      if (createForm.role === 'team_lead' && createForm.managerId) {
        payload.managerId = createForm.managerId
      }
      if (createForm.role === 'agent' && createForm.teamLeadId) {
        payload.teamLeadId = createForm.teamLeadId
      }
      const res = await apiClient.post('/users', payload)
      const data = res.data?.data || res.data || {}
      const userId = data.id || data.user_id
      // Assign companies after user creation
      if (userId && createForm.companyIds.length > 0) {
        for (const companyId of createForm.companyIds) {
          try {
            await fieldOperationsService.assignManagerToCompany(userId, companyId)
          } catch {
            // Continue with other company assignments even if one fails
          }
        }
      }
      setGeneratedPassword(data.password || '')
      queryClient.invalidateQueries({ queryKey: ['field-ops-hierarchy'] })
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
          Failed to load hierarchy data.
        </div>
      </div>
    )
  }

  const managers = hierarchy?.hierarchy || []
  const unassignedTeamLeads = hierarchy?.unassigned_team_leads || []
  const unassignedAgents = hierarchy?.unassigned_agents || []
  const allCompanies: { id: string; name: string; code: string }[] = hierarchy?.all_companies || []

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agent Hierarchy</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage the Agent &rarr; Team Lead &rarr; Manager hierarchy
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#00E87B] hover:bg-[#00D06E] text-[#06090F] font-semibold rounded-lg transition-colors"
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
          <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30"><User className="w-5 h-5 text-green-600" /></div>
          <div>
            <p className="text-sm text-gray-500">Agents</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{hierarchy?.total_agents || 0}</p>
          </div>
        </div>
      </div>

      {/* Hierarchy Tree */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Organization Tree</h3>
        
        {managers.length === 0 && unassignedTeamLeads.length === 0 && unassignedAgents.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-lg font-medium">No hierarchy configured</p>
            <p className="text-gray-400 text-sm">Click &ldquo;Add Person&rdquo; above to create managers, team leads, and agents</p>
          </div>
        )}

        {/* Managers */}
        {managers.map((manager: any) => {
          const managerCompanies: { id: string; name: string; code: string; link_id: string }[] = manager.companies || []
          const assignedCompanyIds = new Set(managerCompanies.map((c: { id: string }) => c.id))
          const availableCompanies = allCompanies.filter(c => !assignedCompanyIds.has(c.id))

          return (
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
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                {/* Quick Edit */}
                {editingUser !== manager.id ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); startQuickEdit(manager) }}
                    className="text-gray-400 hover:text-purple-600 p-1 rounded"
                    title="Quick edit email, phone, PIN"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                      <input type="email" value={editFields.email} onChange={(e) => setEditFields(f => ({ ...f, email: e.target.value }))} placeholder="Email" className="w-36 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#0F1420] text-gray-900 dark:text-white" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                      <input type="tel" value={editFields.phone} onChange={(e) => setEditFields(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" className="w-28 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#0F1420] text-gray-900 dark:text-white" />
                    </div>
                    <div className="flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-gray-400" />
                      <input type="text" value={editFields.pin} onChange={(e) => setEditFields(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))} placeholder="New PIN" className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#0F1420] text-gray-900 dark:text-white" />
                    </div>
                    <button onClick={() => saveQuickEdit(manager.id)} disabled={quickEditMutation.isPending} className="text-green-600 hover:text-green-700 p-1" title="Save">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-red-500 p-1" title="Cancel">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {/* Company badges */}
                {managerCompanies.map((company: { id: string; name: string; code: string; link_id: string }) => (
                  <span
                    key={company.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                  >
                    <Building2 className="w-3 h-3" />
                    {company.name}
                    <button
                      onClick={(e) => { e.stopPropagation(); unassignCompanyMutation.mutate(company.link_id) }}
                      className="ml-0.5 text-indigo-400 hover:text-red-500 transition-colors"
                      title={`Remove ${company.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {/* Add company button */}
                {assigningCompanyToManager === manager.id ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <SearchableSelect
                      options={availableCompanies.map(c => ({ value: c.id, label: c.name }))}
                      value={selectedCompany || null}
                      onChange={(val) => setSelectedCompany(val || '')}
                      placeholder="Select company"
                    />
                    <button
                      onClick={() => { if (selectedCompany) assignCompanyMutation.mutate({ managerId: manager.id, companyId: selectedCompany }) }}
                      disabled={!selectedCompany || assignCompanyMutation.isPending}
                      className="text-green-600 text-xs font-medium px-2 py-1 disabled:opacity-50"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setAssigningCompanyToManager(null); setSelectedCompany('') }}
                      className="text-gray-400 text-xs px-1"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  availableCompanies.length > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setAssigningCompanyToManager(manager.id); setSelectedCompany('') }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors border border-dashed border-indigo-300 dark:border-indigo-700"
                      title="Assign company to manager"
                    >
                      <Plus className="w-3 h-3" />
                      Company
                    </button>
                  )
                )}
                <span className="text-sm text-gray-500 ml-2">{manager.team_leads?.length || 0} team leads</span>
              </div>
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
                      {/* Quick Edit for Team Lead */}
                      {editingUser === tl.id ? (
                        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                            <input type="email" value={editFields.email} onChange={(e) => setEditFields(f => ({ ...f, email: e.target.value }))} placeholder="Email" className="w-36 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#0F1420] text-gray-900 dark:text-white" />
                          </div>
                          <div className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                            <input type="tel" value={editFields.phone} onChange={(e) => setEditFields(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" className="w-28 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#0F1420] text-gray-900 dark:text-white" />
                          </div>
                          <div className="flex items-center gap-1">
                            <KeyRound className="w-3.5 h-3.5 text-gray-400" />
                            <input type="text" value={editFields.pin} onChange={(e) => setEditFields(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))} placeholder="New PIN" className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#0F1420] text-gray-900 dark:text-white" />
                          </div>
                          <button onClick={() => saveQuickEdit(tl.id)} disabled={quickEditMutation.isPending} className="text-green-600 hover:text-green-700 p-1" title="Save"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-red-500 p-1" title="Cancel"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); startQuickEdit(tl) }}
                          className="text-gray-400 hover:text-blue-600 p-1 rounded flex-shrink-0"
                          title="Quick edit email, phone, PIN"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
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
                          <div key={agent.id} className="flex items-center gap-3 p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                            <User className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <span className="text-gray-900 dark:text-white truncate">{agent.first_name} {agent.last_name}</span>
                            {editingUser === agent.id ? (
                              <div className="ml-auto flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-gray-400" />
                                  <input type="email" value={editFields.email} onChange={(e) => setEditFields(f => ({ ...f, email: e.target.value }))} placeholder="Email" className="w-32 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#0F1420] text-gray-900 dark:text-white" />
                                </div>
                                <div className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-gray-400" />
                                  <input type="tel" value={editFields.phone} onChange={(e) => setEditFields(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" className="w-24 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#0F1420] text-gray-900 dark:text-white" />
                                </div>
                                <div className="flex items-center gap-1">
                                  <KeyRound className="w-3 h-3 text-gray-400" />
                                  <input type="text" value={editFields.pin} onChange={(e) => setEditFields(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))} placeholder="PIN" className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#0F1420] text-gray-900 dark:text-white" />
                                </div>
                                <button onClick={() => saveQuickEdit(agent.id)} disabled={quickEditMutation.isPending} className="text-green-600 hover:text-green-700 p-1" title="Save"><Check className="w-3.5 h-3.5" /></button>
                                <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-red-500 p-1" title="Cancel"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            ) : (
                            <div className="ml-auto flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={(e) => { e.stopPropagation(); startQuickEdit(agent) }}
                                className="text-gray-400 hover:text-green-600 p-1 rounded"
                                title="Quick edit email, phone, PIN"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setReassigningUser({ id: agent.id, type: 'agent', name: `${agent.first_name} ${agent.last_name}` })}
                                className="text-gray-400 hover:text-green-600 p-1 rounded"
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
                            )}
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
          )
        })}

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
            <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">Unassigned Agents</h4>
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

      {/* ═══ Reassign Modal ═══ */}
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
                Select a new {reassigningUser.type === 'agent' ? 'team lead' : 'manager'} to assign <strong>{reassigningUser.name}</strong> to:
              </p>
              <SearchableSelect
                options={reassigningUser.type === 'agent' ? allTeamLeads : allManagers}
                value={reassignTarget || null}
                onChange={(val) => setReassignTarget(val || '')}
                placeholder={`Select ${reassigningUser.type === 'agent' ? 'Team Lead' : 'Manager'}`}
                label={reassigningUser.type === 'agent' ? 'Team Lead' : 'Manager'}
              />
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-200 dark:border-white/10">
              <button onClick={() => { setReassigningUser(null); setReassignTarget('') }} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!reassignTarget) return
                  const data = reassigningUser.type === 'agent'
                    ? { team_lead_id: reassignTarget }
                    : { manager_id: reassignTarget }
                  assignMutation.mutate({ userId: reassigningUser.id, data })
                }}
                disabled={!reassignTarget || assignMutation.isPending}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {assignMutation.isPending ? 'Saving...' : 'Reassign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Create Person Modal ═══ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1A1F2E] rounded-xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-white/10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {generatedPassword ? 'Person Created' : 'Add New Person'}
              </h3>
              <button onClick={closeCreateModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {generatedPassword ? (
              <div className="p-5 space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <p className="text-green-800 dark:text-green-300 font-medium mb-2">Successfully created!</p>
                  <p className="text-sm text-green-700 dark:text-green-400">Please save the temporary password below. The user will need it for their first login.</p>
                  {(createForm.role === 'agent') && (
                    <p className="text-sm text-green-700 dark:text-green-400 mt-1">Default agent PIN: <strong>12345</strong></p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <p className="text-gray-900 dark:text-white">{createForm.firstName} {createForm.lastName}</p>
                </div>
                {createForm.email && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <p className="text-gray-900 dark:text-white">{createForm.email}</p>
                </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temporary Password</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-[#0F1420] rounded-lg text-lg font-mono text-gray-900 dark:text-white tracking-wider">{generatedPassword}</code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(generatedPassword); toast.success('Copied!') }}
                      className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button onClick={closeCreateModal} className="px-4 py-2 bg-[#00E87B] text-[#06090F] font-semibold rounded-lg hover:bg-[#00D06E]">
                    Done
                  </button>
                </div>
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
                      { value: 'agent' as const, label: 'Agent', icon: User, activeBorder: 'border-green-500', activeBg: 'bg-green-50 dark:bg-green-900/20', iconColor: 'text-green-600' },
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

                {/* Agent Type / Department */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setCreateForm(f => ({ ...f, agentType: 'field_ops' }))}
                      className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                        createForm.agentType === 'field_ops'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      Field Ops
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateForm(f => ({ ...f, agentType: 'marketing' }))}
                      className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                        createForm.agentType === 'marketing'
                          ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      Marketing
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateForm(f => ({ ...f, agentType: 'both' }))}
                      className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                        createForm.agentType === 'both'
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      Both
                    </button>
                  </div>
                </div>

                {/* Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={createForm.firstName}
                      onChange={(e) => setCreateForm(f => ({ ...f, firstName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0F1420] text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={createForm.lastName}
                      onChange={(e) => setCreateForm(f => ({ ...f, lastName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0F1420] text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email {createForm.role !== 'agent' && <span className="text-red-500">*</span>}</label>
                  <input
                    type="email"
                    required={createForm.role !== 'agent'}
                    value={createForm.email}
                    onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))}
                    placeholder={createForm.role === 'agent' ? 'Optional for agents' : ''}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0F1420] text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+27..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0F1420] text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Mobile PIN */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mobile PIN</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={createForm.pin}
                    onChange={(e) => setCreateForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                    placeholder="4-6 digits (default: 12345)"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0F1420] text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-400 mt-1">Leave blank to use default PIN: 12345</p>
                </div>

                {/* Assignment (conditional) */}
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

                {/* Assign to Companies (multi-select, managers only) */}
                {createForm.role === 'manager' && allCompanies.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Assign to Companies
                    </label>
                    <div className="space-y-2">
                      {/* Selected companies */}
                      {createForm.companyIds.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {createForm.companyIds.map(cId => {
                            const company = allCompanies.find(c => c.id === cId)
                            return company ? (
                              <span key={cId} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                                <Building2 className="w-3 h-3" />
                                {company.name}
                                <button
                                  type="button"
                                  onClick={() => setCreateForm(f => ({ ...f, companyIds: f.companyIds.filter(id => id !== cId) }))}
                                  className="ml-0.5 text-indigo-400 hover:text-red-500"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ) : null
                          })}
                        </div>
                      )}
                      {/* Company selector */}
                      <SearchableSelect
                        options={allCompanies
                          .filter(c => !createForm.companyIds.includes(c.id))
                          .map(c => ({ value: c.id, label: c.name }))}
                        value={null}
                        onChange={(val) => {
                          if (val && !createForm.companyIds.includes(val)) {
                            setCreateForm(f => ({ ...f, companyIds: [...f.companyIds, val] }))
                          }
                        }}
                        placeholder="Select companies to assign..."
                      />
                      <p className="text-xs text-gray-400">Select one or more Field Ops companies</p>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Default password: <strong>12345</strong> &middot; {createForm.pin ? <>PIN: <strong>{createForm.pin}</strong></> : <>Default PIN: <strong>12345</strong></>}
                </p>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={closeCreateModal} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 text-sm bg-[#00E87B] text-[#06090F] font-semibold rounded-lg hover:bg-[#00D06E] disabled:opacity-50 transition-colors"
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
