import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fieldOperationsService } from '../../services/field-operations.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { UserPlus, Search, CheckCircle, XCircle, Phone, Mail, Hash, Building2, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'react-hot-toast'
import SearchableSelect from '../../components/ui/SearchableSelect'

export default function IndividualRegistrationPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterConverted, setFilterConverted] = useState<string>('')
  const [filterCompany, setFilterCompany] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [playerIdInput, setPlayerIdInput] = useState('')
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    id_number: '',
    phone: '',
    email: '',
    product_app_player_id: '',
    company_id: '',
    notes: '',
    converted: false
  })

  const { data: individualsResp, isLoading, isError } = useQuery({
    queryKey: ['individuals', search, filterConverted, filterCompany],
    queryFn: () => fieldOperationsService.getIndividuals({ search, converted: filterConverted, company_id: filterCompany }),
  })

  const { data: companiesResp } = useQuery({
    queryKey: ['field-companies'],
    queryFn: () => fieldOperationsService.getCompanies(),
  })

  const companies = companiesResp?.data || companiesResp || []
  const individuals = individualsResp?.data || individualsResp || []
  const total = individualsResp?.total || individuals.length

  const registerMutation = useMutation({
    mutationFn: (data: typeof form) => fieldOperationsService.registerIndividual(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['individuals'] })
      queryClient.invalidateQueries({ queryKey: ['field-ops-performance'] })
      queryClient.invalidateQueries({ queryKey: ['field-ops-kpis'] })
      queryClient.invalidateQueries({ queryKey: ['field-ops-drill-down'] })
      queryClient.invalidateQueries({ queryKey: ['field-ops-agent-perf'] })
      queryClient.invalidateQueries({ queryKey: ['field-ops-conversions'] })
      toast.success('Individual registered successfully')
      setShowRegister(false)
      setForm({ first_name: '', last_name: '', id_number: '', phone: '', email: '', product_app_player_id: '', company_id: '', notes: '', converted: false })
    },
    onError: () => toast.error('Failed to register individual'),
  })

  const convertMutation = useMutation({
    mutationFn: ({ id, playerId }: { id: string; playerId?: string }) => fieldOperationsService.convertIndividual(id, playerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['individuals'] })
      queryClient.invalidateQueries({ queryKey: ['field-ops-performance'] })
      queryClient.invalidateQueries({ queryKey: ['field-ops-kpis'] })
      queryClient.invalidateQueries({ queryKey: ['field-ops-drill-down'] })
      queryClient.invalidateQueries({ queryKey: ['field-ops-agent-perf'] })
      queryClient.invalidateQueries({ queryKey: ['field-ops-conversions'] })
      toast.success('Individual marked as converted')
      setConvertingId(null)
      setPlayerIdInput('')
    },
    onError: () => toast.error('Failed to convert individual'),
  })

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Individual Visits</h1>
          <p className="text-gray-600 dark:text-gray-400">Register and track individual conversions ({total} total)</p>
        </div>
        <button onClick={() => setShowRegister(!showRegister)} className="btn-primary flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          <span>Register Individual</span>
        </button>
      </div>

      {/* Individual Visit Form */}
      {showRegister && (
        <div className="card p-6 border-2 border-green-200 dark:border-green-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Register New Individual</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name *</label>
              <input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="input w-full" placeholder="First name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name *</label>
              <input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="input w-full" placeholder="Last name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ID Number</label>
              <input type="text" value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} className="input w-full" placeholder="e.g. 9001015009087" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input w-full" placeholder="e.g. 0821234567" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input w-full" placeholder="email@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product App Player ID</label>
              <input type="text" value={form.product_app_player_id} onChange={(e) => setForm({ ...form, product_app_player_id: e.target.value })} className="input w-full" placeholder="e.g. GR-12345" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company</label>
              <SearchableSelect
                options={[
                  { value: '', label: 'Select Company' },
                  ...(Array.isArray(companies) ? companies : []).map((c: any) => ({ value: c.id, label: c.name }))
                ]}
                value={form.company_id || null}
              onChange={(val) => setForm(prev => ({...prev, company_id: val}))}
                placeholder="Select Company"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input w-full" placeholder="Additional notes" />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.converted} onChange={(e) => setForm({ ...form, converted: e.target.checked })} className="rounded" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Already converted</span>
            </label>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => { if (form.first_name && form.last_name) registerMutation.mutate(form) }}
              disabled={!form.first_name || !form.last_name || registerMutation.isPending}
              className="btn-primary"
            >
              {registerMutation.isPending ? 'Registering...' : 'Register'}
            </button>
            <button onClick={() => setShowRegister(false)} className="btn-outline">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or ID..."
            className="input w-full pl-10"
          />
        </div>
        <SearchableSelect
          options={[
            { value: '', label: 'All Status' },
            { value: '1', label: 'Converted' },
            { value: '0', label: 'Not Converted' },
          ]}
          value={filterConverted || null}
          onChange={(val) => setFilterConverted(val || '')}
          placeholder="All Status"
        />
        <SearchableSelect
          options={[
            { value: '', label: 'All Companies' },
            ...(Array.isArray(companies) ? companies : []).map((c: any) => ({ value: c.id, label: c.name }))
          ]}
          value={filterCompany || null}
          onChange={(val) => setFilterCompany(val || '')}
          placeholder="All Companies"
        />
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Player ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {individuals.map((ind: any) => (
                <tr key={ind.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{ind.first_name} {ind.last_name}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-mono text-sm">{ind.id_number || '-'}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{ind.phone || '-'}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{ind.company_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-mono text-sm">{ind.product_app_player_id || '-'}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{ind.agent_name || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    {ind.converted ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded text-xs font-medium">
                        <CheckCircle className="w-3 h-3" /> Converted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 rounded text-xs font-medium">
                        <XCircle className="w-3 h-3" /> Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!ind.converted && (
                      <>
                        {convertingId === ind.id ? (
                          <div className="flex items-center gap-2 justify-end">
                            <input
                              type="text"
                              value={playerIdInput}
                              onChange={(e) => setPlayerIdInput(e.target.value)}
                              placeholder="Player ID"
                              className="input text-sm w-28"
                            />
                            <button
                              onClick={() => convertMutation.mutate({ id: ind.id, playerId: playerIdInput || undefined })}
                              className="text-green-600 hover:text-green-800 text-sm font-medium"
                            >
                              Confirm
                            </button>
                            <button onClick={() => { setConvertingId(null); setPlayerIdInput('') }} className="text-gray-400 text-sm">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConvertingId(ind.id)}
                            className="text-green-600 hover:text-green-800 text-sm font-medium"
                          >
                            Convert
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {individuals.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <UserPlus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-lg font-medium">No individuals registered yet</p>
                    <p className="text-gray-400 text-sm">Click "Register Individual" to add a new person</p>
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
