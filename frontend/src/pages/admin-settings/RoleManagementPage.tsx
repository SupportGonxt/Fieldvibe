import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../services/api.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'
import { Shield, Users, Key, Plus, X, Check, ChevronDown, ChevronUp, Zap, Trash2, Edit3, Save } from 'lucide-react'

interface Role {
  id: string
  name: string
  description: string
  permissions: string[]
  user_count: number
  created_at: string
}

interface Permission {
  name: string
  description: string
  module: string
  action: string
}

interface PermissionGroup {
  module: string
  permissions: Permission[]
}

interface PresetRole {
  name: string
  description: string
  permissions: string[]
}

export const RoleManagementPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [showPermissionsFor, setShowPermissionsFor] = useState<string | null>(null)
  const [showPresets, setShowPresets] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [expandedModules, setExpandedModules] = useState<string[]>([])

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['rbac-roles'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/rbac/roles')
        const d = res.data?.data || res.data?.roles || res.data
        if (!Array.isArray(d)) return []
        // Normalize permissions from objects to strings (backend returns full permission objects)
        return (d as Role[]).map(r => ({
          ...r,
          permissions: (r.permissions || []).map((p: string | { name: string }) => typeof p === 'string' ? p : p.name)
        }))
      } catch { return [] }
    },
  })

  const { data: permissionGroups = [] } = useQuery({
    queryKey: ['rbac-permissions'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/rbac/permissions/all')
        const d = res.data?.data || res.data
        // Backend returns { permissions: [...], grouped: { module: [...perms] } }
        if (d?.grouped && typeof d.grouped === 'object') {
          return Object.entries(d.grouped).map(([mod, perms]) => ({ module: mod, permissions: Array.isArray(perms) ? perms : [] })) as PermissionGroup[]
        }
        if (Array.isArray(d)) return d as PermissionGroup[]
        return []
      } catch { return [] }
    },
  })

  const { data: presetRoles = {} } = useQuery({
    queryKey: ['rbac-presets'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/rbac/preset-roles')
        const arr = res.data?.data || res.data?.presets || res.data || []
        // Backend returns an array of presets with a `key` field; convert to keyed object
        if (Array.isArray(arr)) {
          const obj: Record<string, PresetRole> = {}
          for (const p of arr) obj[p.key || p.name] = p
          return obj
        }
        return (arr || {}) as Record<string, PresetRole>
      } catch { return {} }
    },
  })

  const allPermissions = permissionGroups.flatMap(g => g.permissions || [])

  const createRoleMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; permissions: string[] }) => apiClient.post('/rbac/roles', data),
    onSuccess: () => { toast.success('Role created'); queryClient.invalidateQueries({ queryKey: ['rbac-roles'] }); setShowCreateModal(false); resetForm() },
    onError: () => toast.error('Failed to create role'),
  })

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; description: string; permissions: string[] }) => apiClient.put(`/rbac/roles/${id}`, data),
    onSuccess: () => { toast.success('Role updated'); queryClient.invalidateQueries({ queryKey: ['rbac-roles'] }); setEditingRole(null); resetForm(); setShowCreateModal(false) },
    onError: () => toast.error('Failed to update role'),
  })

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/rbac/roles/${id}`),
    onSuccess: () => { toast.success('Role deleted'); queryClient.invalidateQueries({ queryKey: ['rbac-roles'] }) },
    onError: () => toast.error('Failed to delete role'),
  })

  const seedPermsMutation = useMutation({
    mutationFn: async () => apiClient.post('/rbac/seed-permissions', {}),
    onSuccess: () => { toast.success('Permissions seeded'); queryClient.invalidateQueries({ queryKey: ['rbac-permissions'] }) },
    onError: () => toast.error('Failed to seed permissions'),
  })

  const seedRolesMutation = useMutation({
    mutationFn: async () => apiClient.post('/rbac/seed-roles', {}),
    onSuccess: () => { toast.success('Preset roles seeded'); queryClient.invalidateQueries({ queryKey: ['rbac-roles'] }) },
    onError: () => toast.error('Failed to seed roles'),
  })

  const applyPresetMutation = useMutation({
    mutationFn: async ({ roleId, presetKey }: { roleId: string; presetKey: string }) => apiClient.post(`/rbac/roles/${roleId}/apply-preset`, { preset_key: presetKey }),
    onSuccess: () => { toast.success('Preset applied'); queryClient.invalidateQueries({ queryKey: ['rbac-roles'] }) },
    onError: () => toast.error('Failed to apply preset'),
  })

  const resetForm = () => { setNewRoleName(''); setNewRoleDesc(''); setSelectedPermissions([]); setExpandedModules([]) }

  const togglePermission = (p: string) => setSelectedPermissions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  const toggleModule = (m: string) => setExpandedModules(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])

  const toggleAllInModule = (moduleName: string) => {
    const names = (permissionGroups.find(g => g.module === moduleName)?.permissions || []).map(p => p.name)
    const allSel = names.every(p => selectedPermissions.includes(p))
    setSelectedPermissions(prev => allSel ? prev.filter(p => !names.includes(p)) : [...new Set([...prev, ...names])])
  }

  const startEdit = (role: Role) => { setEditingRole(role); setNewRoleName(role.name); setNewRoleDesc(role.description); setSelectedPermissions(role.permissions || []); setShowCreateModal(true) }

  const handleSave = () => {
    if (!newRoleName.trim()) { toast.error('Role name is required'); return }
    if (editingRole) updateRoleMutation.mutate({ id: editingRole.id, name: newRoleName, description: newRoleDesc, permissions: selectedPermissions })
    else createRoleMutation.mutate({ name: newRoleName, description: newRoleDesc, permissions: selectedPermissions })
  }

  const applyPresetToForm = (key: string) => {
    const preset = presetRoles[key]
    if (!preset) return
    setSelectedPermissions(preset.permissions || [])
    if (!newRoleName) setNewRoleName(preset.name)
    if (!newRoleDesc) setNewRoleDesc(preset.description)
    toast.success(`Applied "${preset.name}" preset`)
  }

  if (rolesLoading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Role Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage roles, permissions, and access control</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => seedPermsMutation.mutate()} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">Seed Permissions</button>
          <button onClick={() => seedRolesMutation.mutate()} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">Seed Preset Roles</button>
          <button onClick={() => { resetForm(); setEditingRole(null); setShowCreateModal(true) }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"><Plus className="h-4 w-4" /> Create Role</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { icon: Shield, color: 'blue', label: 'Total Roles', value: roles.length },
          { icon: Key, color: 'green', label: 'Total Permissions', value: allPermissions.length },
          { icon: Users, color: 'purple', label: 'Assigned Users', value: roles.reduce((s: number, r: Role) => s + (r.user_count || 0), 0) },
          { icon: Zap, color: 'orange', label: 'Preset Templates', value: Object.keys(presetRoles).length },
        ].map((c, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <c.icon className={`h-5 w-5 text-${c.color}-500 mb-2`} />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{c.value}</p>
            <p className="text-sm text-gray-500">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Preset Templates */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <button onClick={() => setShowPresets(!showPresets)} className="w-full flex items-center justify-between p-6 text-left">
          <div><h3 className="text-lg font-semibold text-gray-900 dark:text-white">Preset Role Templates</h3><p className="text-sm text-gray-500 dark:text-gray-400">Pre-configured templates for common use cases</p></div>
          {showPresets ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
        </button>
        {showPresets && (
          <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(presetRoles).map(([key, preset]) => (
              <div key={key} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-1">{preset.name}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{preset.description}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">{(preset.permissions || []).length} permissions</p>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {(preset.permissions || []).slice(0, 8).map((p: string) => (<span key={p} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] text-gray-600 dark:text-gray-400">{p}</span>))}
                  {(preset.permissions || []).length > 8 && <span className="px-1.5 py-0.5 text-[10px] text-gray-400">+{(preset.permissions || []).length - 8} more</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-center py-12">
            <Shield className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">No roles yet</h3>
            <p className="text-sm text-gray-500 mt-1">Create a role or seed preset roles to get started.</p>
          </div>
        ) : roles.map((role: Role) => (
          <div key={role.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1"><h3 className="text-lg font-semibold text-gray-900 dark:text-white">{role.name}</h3><p className="text-sm text-gray-500 dark:text-gray-400">{role.description}</p></div>
                <button onClick={() => deleteRoleMutation.mutate(role.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><Key className="h-4 w-4" /><span>{(role.permissions || []).length} permissions</span></div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300"><Users className="h-4 w-4" /><span>{role.user_count || 0} users</span></div>
              </div>
              <div className="flex flex-wrap gap-1 mb-4 max-h-16 overflow-hidden">
                {(role.permissions || []).slice(0, 6).map((p: string) => (<span key={p} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full text-[10px]">{p}</span>))}
                {(role.permissions || []).length > 6 && <span className="px-2 py-0.5 text-[10px] text-gray-400">+{(role.permissions || []).length - 6} more</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(role)} className="flex-1 flex items-center justify-center gap-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700"><Edit3 className="h-3 w-3" /> Edit</button>
                <button onClick={() => setShowPermissionsFor(showPermissionsFor === role.id ? null : role.id)} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600">{showPermissionsFor === role.id ? 'Hide' : 'View'} Perms</button>
              </div>
              {showPermissionsFor === role.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase">All Permissions</h4>
                  <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
                    {(role.permissions || []).map((p: string) => (<span key={p} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full text-[10px]">{p}</span>))}
                  </div>
                  <div className="mt-3">
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Apply Preset:</label>
                    <select onChange={(e) => { if (e.target.value) applyPresetMutation.mutate({ roleId: role.id, presetKey: e.target.value }); e.target.value = '' }}
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                      <option value="">Select preset...</option>
                      {Object.entries(presetRoles).map(([k, p]) => (<option key={k} value={k}>{p.name} ({(p.permissions || []).length} perms)</option>))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* All Permissions Reference */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">All Permissions by Module</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {permissionGroups.map((group: PermissionGroup) => (
            <div key={group.module} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 capitalize">{group.module}</h3>
              <ul className="space-y-1">
                {(group.permissions || []).map((perm: Permission) => (
                  <li key={perm.name} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                    <span className="truncate" title={perm.description}>{perm.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setShowCreateModal(false); setEditingRole(null); resetForm() }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{editingRole ? 'Edit Role' : 'Create New Role'}</h2>
              <button onClick={() => { setShowCreateModal(false); setEditingRole(null); resetForm() }}><X className="h-5 w-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role Name</label>
                <input type="text" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder="e.g., Regional Manager" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <input type="text" value={newRoleDesc} onChange={e => setNewRoleDesc(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder="Describe what this role can do" />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Apply Preset</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(presetRoles).map(([key, preset]) => (
                  <button key={key} onClick={() => applyPresetToForm(key)} className="px-3 py-1 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-400 rounded-full text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20">{preset.name}</button>
                ))}
              </div>
            </div>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Permissions ({selectedPermissions.length} selected)</label>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedPermissions(allPermissions.map(p => p.name))} className="text-xs text-blue-600 hover:underline">Select All</button>
                  <button onClick={() => setSelectedPermissions([])} className="text-xs text-red-600 hover:underline">Clear All</button>
                </div>
              </div>
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg max-h-60 overflow-y-auto">
                {permissionGroups.map((group: PermissionGroup) => {
                  const names = (group.permissions || []).map(p => p.name)
                  const allSel = names.length > 0 && names.every(p => selectedPermissions.includes(p))
                  const someSel = names.some(p => selectedPermissions.includes(p))
                  const isExp = expandedModules.includes(group.module)
                  return (
                    <div key={group.module} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                        <input type="checkbox" checked={allSel} onChange={() => toggleAllInModule(group.module)} ref={el => { if (el) el.indeterminate = someSel && !allSel }} className="rounded border-gray-300 text-blue-600" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white capitalize flex-1" onClick={() => toggleModule(group.module)}>{group.module} <span className="text-gray-400 font-normal">({names.length})</span></span>
                        <button onClick={() => toggleModule(group.module)}>{isExp ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}</button>
                      </div>
                      {isExp && (
                        <div className="px-3 py-2 space-y-1">
                          {(group.permissions || []).map((perm: Permission) => (
                            <label key={perm.name} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 px-2 rounded">
                              <input type="checkbox" checked={selectedPermissions.includes(perm.name)} onChange={() => togglePermission(perm.name)} className="rounded border-gray-300 text-blue-600" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">{perm.name}</span>
                              <span className="text-xs text-gray-400 ml-auto">{perm.description}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={createRoleMutation.isPending || updateRoleMutation.isPending} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"><Save className="h-4 w-4" /> {editingRole ? 'Update Role' : 'Create Role'}</button>
              <button onClick={() => { setShowCreateModal(false); setEditingRole(null); resetForm() }} className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
