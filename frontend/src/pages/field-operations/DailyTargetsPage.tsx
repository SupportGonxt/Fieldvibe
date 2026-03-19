import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fieldOperationsService } from '../../services/field-operations.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { Target, Plus, Trash2, Calendar, Users, Building2, Save } from 'lucide-react'
import { toast } from 'react-hot-toast'
import SearchableSelect from '../../components/ui/SearchableSelect'

export default function DailyTargetsPage() {
  const queryClient = useQueryClient()
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const [showCreate, setShowCreate] = useState(false)
  const [newTarget, setNewTarget] = useState({
    agent_id: '',
    company_id: '',
    target_visits: 20,
    target_conversions: 5,
    target_registrations: 10,
    target_date: today
  })

  const { data: targets, isLoading, isError } = useQuery({
    queryKey: ['daily-targets', selectedDate],
    queryFn: () => fieldOperationsService.getDailyTargets({ date: selectedDate }),
  })

  const { data: agents } = useQuery({
    queryKey: ['field-agents-list'],
    queryFn: () => fieldOperationsService.getFieldAgents({ status: 'active' }),
  })

  const { data: companiesResp } = useQuery({
    queryKey: ['field-companies'],
    queryFn: () => fieldOperationsService.getCompanies(),
  })

  const companies = companiesResp?.data || companiesResp || []

  const createMutation = useMutation({
    mutationFn: (data: typeof newTarget) => fieldOperationsService.createDailyTarget(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-targets'] })
      toast.success('Daily target created')
      setShowCreate(false)
      setNewTarget({ agent_id: '', company_id: '', target_visits: 20, target_conversions: 5, target_registrations: 10, target_date: today })
    },
    onError: () => toast.error('Failed to create target'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fieldOperationsService.deleteDailyTarget(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-targets'] })
      toast.success('Target deleted')
    },
    onError: () => toast.error('Failed to delete target'),
  })

  const targetList = targets?.data || targets || []
  const agentList = Array.isArray(agents) ? agents : agents?.data || []

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 text-lg font-medium">Failed to load data</p>
          <p className="text-gray-500 mt-2">Please try refreshing the page</p>
        </div>
      </div>
    )
  }


  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Daily Targets</h1>
          <p className="text-gray-600 dark:text-gray-400">Set and manage daily targets per agent per company</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input text-sm"
            />
          </div>
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>Add Target</span>
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="card p-6 border-2 border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">New Daily Target</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agent *</label>
              <SearchableSelect
                options={[
                  { value: '', label: 'Select Agent' },
                  { value: 'a.id', label: '{a.first_name} {a.last_name}' },
                ]}
                value={newTarget.agent_id || null}
                placeholder="Select Agent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company</label>
              <SearchableSelect
                options={[
                  { value: '', label: 'All Companies' },
                  { value: 'c.id', label: '{c.name}' },
                ]}
                value={newTarget.company_id || null}
                placeholder="All Companies"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <input
                type="date"
                value={newTarget.target_date}
                onChange={(e) => setNewTarget({ ...newTarget, target_date: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Visits</label>
              <input
                type="number"
                value={newTarget.target_visits}
                onChange={(e) => setNewTarget({ ...newTarget, target_visits: parseInt(e.target.value) || 0 })}
                className="input w-full"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Registrations</label>
              <input
                type="number"
                value={newTarget.target_registrations}
                onChange={(e) => setNewTarget({ ...newTarget, target_registrations: parseInt(e.target.value) || 0 })}
                className="input w-full"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Conversions</label>
              <input
                type="number"
                value={newTarget.target_conversions}
                onChange={(e) => setNewTarget({ ...newTarget, target_conversions: parseInt(e.target.value) || 0 })}
                className="input w-full"
                min="0"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => { if (newTarget.agent_id) createMutation.mutate(newTarget) }}
              disabled={!newTarget.agent_id || createMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {createMutation.isPending ? 'Creating...' : 'Create Target'}
            </button>
            <button onClick={() => setShowCreate(false)} className="btn-outline">Cancel</button>
          </div>
        </div>
      )}

      {/* Targets Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Visits Target</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Registrations Target</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Conversions Target</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {targetList.map((t: any) => (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-white">{t.agent_name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-700 dark:text-gray-300">{t.company_name || 'All'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded text-sm font-medium">
                      {t.target_visits}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded text-sm font-medium">
                      {t.target_registrations}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 rounded text-sm font-medium">
                      {t.target_conversions}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{t.target_date}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteMutation.mutate(t.id)}
                      className="text-red-600 hover:text-red-800 p-1"
                      title="Delete target"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {targetList.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-lg font-medium">No targets set for {selectedDate}</p>
                    <p className="text-gray-400 text-sm">Click "Add Target" to set daily targets for agents</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
