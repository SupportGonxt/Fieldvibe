import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fieldOperationsService } from '../../services/field-operations.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { Users, ChevronDown, ChevronRight, UserPlus, Shield, Crown, User, Link2, Unlink } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import SearchableSelect from '../../components/ui/SearchableSelect'

export default function AgentHierarchyPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set())
  const [expandedTeamLeads, setExpandedTeamLeads] = useState<Set<string>>(new Set())
  const [assigningUser, setAssigningUser] = useState<string | null>(null)
  const [assignType, setAssignType] = useState<'manager' | 'team_lead'>('team_lead')
  const [assignTarget, setAssignTarget] = useState('')

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
    },
    onError: () => toast.error('Failed to update hierarchy'),
  })

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

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agent Hierarchy</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage the Agent &rarr; Team Lead &rarr; Manager hierarchy
        </p>
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
            <p className="text-gray-400 text-sm">Assign roles (manager, team_lead, agent) to users to build the hierarchy</p>
          </div>
        )}

        {/* Managers */}
        {managers.map((manager: any) => (
          <div key={manager.id} className="mb-4">
            <button
              onClick={() => toggleManager(manager.id)}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition"
            >
              {expandedManagers.has(manager.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <Crown className="w-5 h-5 text-purple-600" />
              <span className="font-semibold text-gray-900 dark:text-white">{manager.first_name} {manager.last_name}</span>
              <span className="text-sm text-gray-500 ml-auto">{manager.team_leads?.length || 0} team leads</span>
            </button>

            {expandedManagers.has(manager.id) && (
              <div className="ml-8 mt-2 space-y-2">
                {(manager.team_leads || []).map((tl: any) => (
                  <div key={tl.id}>
                    <button
                      onClick={() => toggleTeamLead(tl.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
                    >
                      {expandedTeamLeads.has(tl.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <Shield className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-gray-900 dark:text-white">{tl.first_name} {tl.last_name}</span>
                      <span className="text-sm text-gray-500 ml-auto">{tl.agents?.length || 0} agents</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/field-operations/drill-down/${tl.id}`) }}
                        className="text-blue-600 hover:text-blue-800 text-xs ml-2"
                      >
                        View Performance
                      </button>
                    </button>

                    {expandedTeamLeads.has(tl.id) && (
                      <div className="ml-8 mt-1 space-y-1">
                        {(tl.agents || []).map((agent: any) => (
                          <div key={agent.id} className="flex items-center gap-3 p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                            <User className="w-4 h-4 text-green-600" />
                            <span className="text-gray-900 dark:text-white">{agent.first_name} {agent.last_name}</span>
                            <button
                              onClick={() => navigate(`/field-operations/drill-down/${agent.id}`)}
                              className="text-green-600 hover:text-green-800 text-xs ml-auto"
                            >
                              View Details
                            </button>
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
                  <Shield className="w-5 h-5 text-yellow-600" />
                  <span className="text-gray-900 dark:text-white">{tl.first_name} {tl.last_name}</span>
                  {assigningUser === tl.id ? (
                    <div className="ml-auto flex items-center gap-2">
                      <SearchableSelect
                        options={[
                          { value: '', label: 'Select Manager' },
                          { value: 'm.id', label: '{m.first_name} {m.last_name}' },
                        ]}
                        value={assignTarget || null}
                        placeholder="Select Manager"
                      />
                      <button
                        onClick={() => { if (assignTarget) assignMutation.mutate({ userId: tl.id, data: { manager_id: assignTarget } }) }}
                        disabled={!assignTarget}
                        className="text-green-600 text-sm font-medium"
                      >
                        Assign
                      </button>
                      <button onClick={() => setAssigningUser(null)} className="text-gray-400 text-sm">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setAssigningUser(tl.id)} className="ml-auto text-blue-600 text-sm flex items-center gap-1">
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
                  <User className="w-5 h-5 text-orange-600" />
                  <span className="text-gray-900 dark:text-white">{agent.first_name} {agent.last_name}</span>
                  {assigningUser === agent.id ? (
                    <div className="ml-auto flex items-center gap-2">
                      <SearchableSelect
                        options={[
                          { value: '', label: 'Select Team Lead' },
                          { value: 'tl.id', label: '{tl.first_name} {tl.last_name}' },
                        ]}
                        value={assignTarget || null}
                        placeholder="Select Team Lead"
                      />
                      <button
                        onClick={() => { if (assignTarget) assignMutation.mutate({ userId: agent.id, data: { team_lead_id: assignTarget } }) }}
                        disabled={!assignTarget}
                        className="text-green-600 text-sm font-medium"
                      >
                        Assign
                      </button>
                      <button onClick={() => setAssigningUser(null)} className="text-gray-400 text-sm">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setAssigningUser(agent.id)} className="ml-auto text-blue-600 text-sm flex items-center gap-1">
                      <Link2 className="w-3 h-3" /> Assign to Team Lead
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
