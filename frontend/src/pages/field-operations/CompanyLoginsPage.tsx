import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fieldOperationsService } from '../../services/field-operations.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { Users, Plus, Trash2, Building2, Mail, Shield, Save, X, Key } from 'lucide-react'
import { toast } from 'react-hot-toast'

export default function CompanyLoginsPage() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [filterCompany, setFilterCompany] = useState('')
  const [form, setForm] = useState({ company_id: '', email: '', password: '', name: '', role: 'viewer' })

  const { data: loginsResp, isLoading } = useQuery({
    queryKey: ['company-logins', filterCompany],
    queryFn: () => fieldOperationsService.getCompanyLogins(filterCompany || undefined),
  })

  const { data: companiesResp } = useQuery({
    queryKey: ['field-companies'],
    queryFn: () => fieldOperationsService.getCompanies(),
  })

  const companies = companiesResp?.data || companiesResp || []
  const logins = loginsResp?.data || loginsResp || []

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => fieldOperationsService.createCompanyLogin(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-logins'] })
      toast.success('Company login created')
      setShowCreate(false)
      setForm({ company_id: '', email: '', password: '', name: '', role: 'viewer' })
    },
    onError: () => toast.error('Failed to create login'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fieldOperationsService.deleteCompanyLogin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-logins'] })
      toast.success('Login deleted')
    },
    onError: () => toast.error('Failed to delete login'),
  })

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Company Logins</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage login credentials for company portal access</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          <span>Create Login</span>
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="card p-6 border-2 border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create Company Login</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company *</label>
              <select value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })} className="input w-full">
                <option value="">Select Company</option>
                {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input w-full" placeholder="Contact name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input w-full" placeholder="login@company.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password *</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input w-full" placeholder="Secure password" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input w-full">
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => { if (form.company_id && form.email && form.password && form.name) createMutation.mutate(form) }}
              disabled={!form.company_id || !form.email || !form.password || !form.name || createMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {createMutation.isPending ? 'Creating...' : 'Create Login'}
            </button>
            <button onClick={() => setShowCreate(false)} className="btn-outline flex items-center gap-2">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-3">
        <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} className="input">
          <option value="">All Companies</option>
          {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Logins Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {logins.map((login: any) => (
                <tr key={login.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{login.name}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" /> {login.email}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" /> {login.company_name || '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${login.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                      {login.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${login.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800'}`}>
                      {login.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-sm">
                    {login.last_login ? new Date(login.last_login).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteMutation.mutate(login.id)}
                      className="text-red-600 hover:text-red-800 p-1"
                      title="Delete login"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {logins.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Key className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-lg font-medium">No company logins configured</p>
                    <p className="text-gray-400 text-sm">Create logins so companies can access their portal and data</p>
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
