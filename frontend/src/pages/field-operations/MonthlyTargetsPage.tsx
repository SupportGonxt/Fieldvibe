import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fieldOperationsService } from '../../services/field-operations.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { Target, Plus, Trash2, Save, RefreshCw, Calendar, Users, Building2, TrendingUp, Award } from 'lucide-react'
import { toast } from 'react-hot-toast'
import SearchableSelect from '../../components/ui/SearchableSelect'

export default function MonthlyTargetsPage() {
  const queryClient = useQueryClient()
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [showCreate, setShowCreate] = useState(false)
  const [newTarget, setNewTarget] = useState({
    agent_id: '',
    company_id: '',
    target_month: currentMonth,
    target_visits: 400,
    target_conversions: 100,
    target_registrations: 200,
    working_days: 22,
  })

  const { data: targets, isLoading, isError } = useQuery({
    queryKey: ['monthly-targets', selectedMonth],
    queryFn: () => fieldOperationsService.getMonthlyTargets({ target_month: selectedMonth }),
  })

  const { data: agents } = useQuery({
    queryKey: ['field-agents-list'],
    queryFn: () => fieldOperationsService.getFieldAgents({ status: 'active' }),
  })

  const { data: companiesResp } = useQuery({
    queryKey: ['field-companies'],
    queryFn: () => fieldOperationsService.getCompanies(),
  })

  const { data: effectiveWD } = useQuery({
    queryKey: ['effective-working-days', selectedMonth],
    queryFn: () => fieldOperationsService.getEffectiveWorkingDays({ month: selectedMonth }),
  })

  const companies = companiesResp?.data || companiesResp || []
  const agentList = Array.isArray(agents) ? agents : agents?.data || []
  const targetList = targets?.data || targets || []
  const defaultWorkingDays = effectiveWD?.data?.working_days_count || effectiveWD?.working_days_count || 22

  const createMutation = useMutation({
    mutationFn: (data: typeof newTarget) => fieldOperationsService.createMonthlyTarget(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-targets'] })
      toast.success('Monthly target created')
      setShowCreate(false)
      setNewTarget({ ...newTarget, agent_id: '', company_id: '' })
    },
    onError: () => toast.error('Failed to create target'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fieldOperationsService.deleteMonthlyTarget(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-targets'] })
      toast.success('Target deleted')
    },
    onError: () => toast.error('Failed to delete target'),
  })

  const recalcMutation = useMutation({
    mutationFn: (id: string) => fieldOperationsService.recalculateMonthlyTarget(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-targets'] })
      toast.success('Actuals recalculated')
    },
    onError: () => toast.error('Failed to recalculate'),
  })

  function achievementPct(actual: number, target: number) {
    if (!target) return 0
    return Math.round((actual / target) * 100)
  }

  function achievementColor(pct: number) {
    if (pct >= 100) return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-300'
    if (pct >= 75) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300'
    return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-300'
  }

  // Summary stats
  const totalTargetVisits = Array.isArray(targetList) ? targetList.reduce((s: number, t: any) => s + (t.target_visits || 0), 0) : 0
  const totalActualVisits = Array.isArray(targetList) ? targetList.reduce((s: number, t: any) => s + (t.actual_visits || 0), 0) : 0
  const totalCommission = Array.isArray(targetList) ? targetList.reduce((s: number, t: any) => s + (t.commission_amount || 0), 0) : 0

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Monthly Targets</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Set monthly targets per agent. Only working days are counted ({defaultWorkingDays} working days this month).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input text-sm"
            />
          </div>
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>Add Target</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30"><Target className="w-5 h-5 text-blue-600" /></div>
          <div>
            <p className="text-sm text-gray-500">Target Individual Visits</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{totalTargetVisits}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30"><TrendingUp className="w-5 h-5 text-green-600" /></div>
          <div>
            <p className="text-sm text-gray-500">Actual Individual Visits</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{totalActualVisits}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30"><Award className="w-5 h-5 text-purple-600" /></div>
          <div>
            <p className="text-sm text-gray-500">Overall Achievement</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{achievementPct(totalActualVisits, totalTargetVisits)}%</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30"><Calendar className="w-5 h-5 text-yellow-600" /></div>
          <div>
            <p className="text-sm text-gray-500">Total Commission</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">R {totalCommission.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="card p-6 border-2 border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">New Monthly Target</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agent *</label>
              <SearchableSelect
                options={agentList.map((a: any) => ({ value: a.id, label: `${a.first_name} ${a.last_name}` }))}
                value={newTarget.agent_id || null}
                onChange={(val) => setNewTarget({ ...newTarget, agent_id: val || '' })}
                placeholder="Select Agent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company</label>
              <SearchableSelect
                options={[
                  { value: '', label: 'All Companies' },
                  ...companies.map((c: any) => ({ value: c.id, label: c.name }))
                ]}
                value={newTarget.company_id || null}
                onChange={(val) => setNewTarget({ ...newTarget, company_id: val || '' })}
                placeholder="All Companies"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Month</label>
              <input
                type="month"
                value={newTarget.target_month}
                onChange={(e) => setNewTarget({ ...newTarget, target_month: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Working Days</label>
              <input
                type="number"
                value={newTarget.working_days}
                onChange={(e) => setNewTarget({ ...newTarget, working_days: parseInt(e.target.value) || 0 })}
                className="input w-full"
                min="0" max="31"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Individual Visits</label>
              <input
                type="number"
                value={newTarget.target_visits}
                onChange={(e) => setNewTarget({ ...newTarget, target_visits: parseInt(e.target.value) || 0 })}
                className="input w-full" min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Store Visits</label>
              <input
                type="number"
                value={newTarget.target_registrations}
                onChange={(e) => setNewTarget({ ...newTarget, target_registrations: parseInt(e.target.value) || 0 })}
                className="input w-full" min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Conversions</label>
              <input
                type="number"
                value={newTarget.target_conversions}
                onChange={(e) => setNewTarget({ ...newTarget, target_conversions: parseInt(e.target.value) || 0 })}
                className="input w-full" min="0"
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
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Working Days</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Individual Visits (Target/Actual)</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Store Visits (Target/Actual)</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Conv (Target/Actual)</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Achievement</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Commission</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {Array.isArray(targetList) && targetList.map((t: any) => {
                const visitPct = achievementPct(t.actual_visits || 0, t.target_visits || 0)
                return (
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
                    <td className="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300">{t.working_days || 22}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{t.actual_visits || 0}</span>
                      <span className="text-gray-400"> / {t.target_visits || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{t.actual_registrations || 0}</span>
                      <span className="text-gray-400"> / {t.target_registrations || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{t.actual_conversions || 0}</span>
                      <span className="text-gray-400"> / {t.target_conversions || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-sm font-bold ${achievementColor(visitPct)}`}>
                        {visitPct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">
                      R {(t.commission_amount || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => recalcMutation.mutate(t.id)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Recalculate actuals"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(t.id)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Delete target"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {(!Array.isArray(targetList) || targetList.length === 0) && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-lg font-medium">No monthly targets for {selectedMonth}</p>
                    <p className="text-gray-400 text-sm">Click "Add Target" to set monthly targets for agents</p>
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
