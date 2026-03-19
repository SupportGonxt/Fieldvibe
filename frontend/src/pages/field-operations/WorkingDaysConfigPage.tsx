import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fieldOperationsService } from '../../services/field-operations.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { Calendar, Plus, Trash2, Save, Building2, Users, Globe, Edit2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import SearchableSelect from '../../components/ui/SearchableSelect'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

interface WorkingDaysForm {
  company_id: string
  agent_id: string
  monday: number
  tuesday: number
  wednesday: number
  thursday: number
  friday: number
  saturday: number
  sunday: number
  public_holidays: string
}

const defaultForm: WorkingDaysForm = {
  company_id: '',
  agent_id: '',
  monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1,
  saturday: 0, sunday: 0,
  public_holidays: '[]'
}

export default function WorkingDaysConfigPage() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<WorkingDaysForm>({ ...defaultForm })

  const { data: configs, isLoading, isError } = useQuery({
    queryKey: ['working-days-configs'],
    queryFn: () => fieldOperationsService.getWorkingDaysConfigs(),
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
  const agentList = Array.isArray(agents) ? agents : agents?.data || []
  const configList = configs?.data || configs || []

  const createMutation = useMutation({
    mutationFn: (data: WorkingDaysForm) => fieldOperationsService.createWorkingDaysConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['working-days-configs'] })
      toast.success('Working days config created')
      setShowCreate(false)
      setForm({ ...defaultForm })
    },
    onError: () => toast.error('Failed to create config'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      fieldOperationsService.updateWorkingDaysConfig(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['working-days-configs'] })
      toast.success('Working days config updated')
      setEditingId(null)
      setForm({ ...defaultForm })
    },
    onError: () => toast.error('Failed to update config'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fieldOperationsService.deleteWorkingDaysConfig(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['working-days-configs'] })
      toast.success('Config deleted')
    },
    onError: () => toast.error('Failed to delete config'),
  })

  function getConfigLabel(config: any) {
    if (config.agent_id && config.agent_name) return `Agent: ${config.agent_name}`
    if (config.company_id && config.company_name) return `Company: ${config.company_name}`
    return 'Global Default'
  }

  function getConfigIcon(config: any) {
    if (config.agent_id) return <Users className="w-4 h-4 text-green-600" />
    if (config.company_id) return <Building2 className="w-4 h-4 text-blue-600" />
    return <Globe className="w-4 h-4 text-purple-600" />
  }

  function countWorkingDays(config: any) {
    return DAYS.filter(d => config[d]).length
  }

  function startEdit(config: any) {
    setEditingId(config.id)
    setForm({
      company_id: config.company_id || '',
      agent_id: config.agent_id || '',
      monday: config.monday,
      tuesday: config.tuesday,
      wednesday: config.wednesday,
      thursday: config.thursday,
      friday: config.friday,
      saturday: config.saturday,
      sunday: config.sunday,
      public_holidays: config.public_holidays || '[]'
    })
  }

  function handleSave() {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form })
    } else {
      createMutation.mutate(form)
    }
  }

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Working Days Configuration</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure working days at global, company, or agent level. Agent overrides company, company overrides global.
          </p>
        </div>
        <button onClick={() => { setShowCreate(!showCreate); setEditingId(null); setForm({ ...defaultForm }) }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>Add Config</span>
        </button>
      </div>

      {/* Resolution Order Info */}
      <div className="card p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>Resolution Order:</strong> Agent Override → Company Config → Global Default.
          Working days determine how daily targets are summed into monthly totals.
        </p>
      </div>

      {/* Create/Edit Form */}
      {(showCreate || editingId) && (
        <div className="card p-6 border-2 border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingId ? 'Edit Working Days Config' : 'New Working Days Config'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scope: Company (optional)</label>
              <SearchableSelect
                options={[
                  { value: '', label: 'Global (No Company)' },
                  ...companies.map((c: any) => ({ value: c.id, label: c.name }))
                ]}
                value={form.company_id || null}
                onChange={(val) => setForm({ ...form, company_id: val || '' })}
                placeholder="Global (No Company)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scope: Agent Override (optional)</label>
              <SearchableSelect
                options={[
                  { value: '', label: 'No Agent Override' },
                  ...agentList.map((a: any) => ({ value: a.id, label: `${a.first_name} ${a.last_name}` }))
                ]}
                value={form.agent_id || null}
                onChange={(val) => setForm({ ...form, agent_id: val || '' })}
                placeholder="No Agent Override"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Working Days</label>
            <div className="flex flex-wrap gap-3">
              {DAYS.map(day => (
                <label key={day} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form[day] === 1}
                    onChange={(e) => setForm({ ...form, [day]: e.target.checked ? 1 : 0 })}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{day}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Public Holidays (JSON array of dates, e.g. ["2026-03-21","2026-04-27"])
            </label>
            <input
              type="text"
              value={form.public_holidays}
              onChange={(e) => setForm({ ...form, public_holidays: e.target.value })}
              className="input w-full"
              placeholder='["2026-03-21","2026-04-27"]'
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Config'}
            </button>
            <button onClick={() => { setShowCreate(false); setEditingId(null); setForm({ ...defaultForm }) }} className="btn-outline">Cancel</button>
          </div>
        </div>
      )}

      {/* Configs Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scope</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mon</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tue</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Wed</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Thu</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Fri</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sat</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sun</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Days/Week</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {Array.isArray(configList) && configList.map((config: any) => (
                <tr key={config.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getConfigIcon(config)}
                      <span className="font-medium text-gray-900 dark:text-white">{getConfigLabel(config)}</span>
                    </div>
                  </td>
                  {DAYS.map(day => (
                    <td key={day} className="px-4 py-3 text-center">
                      <span className={`inline-block w-6 h-6 rounded-full text-xs leading-6 font-medium ${
                        config[day] ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                      }`}>
                        {config[day] ? '✓' : '—'}
                      </span>
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded text-sm font-bold">
                      {countWorkingDays(config)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => startEdit(config)} className="text-blue-600 hover:text-blue-800 p-1" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteMutation.mutate(config.id)} className="text-red-600 hover:text-red-800 p-1" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!Array.isArray(configList) || configList.length === 0) && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-lg font-medium">No working days configs</p>
                    <p className="text-gray-400 text-sm">Click "Add Config" to set working days for global, company, or agent level</p>
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
