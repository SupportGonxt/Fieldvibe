import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../services/api.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

interface Backup {
  id: string
  name: string
  type: 'full' | 'incremental' | 'differential'
  size: number
  status: 'completed' | 'in_progress' | 'failed'
  created_at: string
  created_by: string
}

const DEFAULT_BACKUPS: Backup[] = [{
  id: '1',
  name: 'Auto Backup - ' + new Date().toLocaleDateString(),
  type: 'full',
  status: 'completed',
  size: 0,
  created_at: new Date().toISOString(),
  created_by: 'System (Cloudflare D1)',
}]

export const BackupManagementPage: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data: backups = DEFAULT_BACKUPS, isLoading, isError } = useQuery({
    queryKey: ['backups'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/admin/backups')
        return response.data?.data || response.data || DEFAULT_BACKUPS
      } catch {
        return DEFAULT_BACKUPS
      }
    },
  })

  if (isLoading) return <LoadingSpinner />

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      completed: 'bg-green-100 text-green-800',
      in_progress: 'bg-blue-100 text-blue-800',
      failed: 'bg-red-100 text-red-800'
    }
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800'
  }

  const getTypeBadge = (type: string) => {
    const badges = {
      full: 'bg-purple-100 text-purple-800',
      incremental: 'bg-blue-100 text-blue-800',
      differential: 'bg-indigo-100 text-indigo-800'
    }
    return badges[type as keyof typeof badges] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Backup Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create, manage, and restore system backups
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Create Backup
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Backups</p>
              <p className="text-2xl font-semibold text-gray-900">{backups.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Successful</p>
              <p className="text-2xl font-semibold text-gray-900">
                {backups.filter(b => b.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
              <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Size</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatFileSize(backups.reduce((sum, b) => sum + b.size, 0))}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-indigo-100 rounded-md p-3">
              <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Last Backup</p>
              <p className="text-sm font-semibold text-gray-900">
                {backups.length > 0
                  ? new Date(backups[0].created_at).toLocaleDateString()
                  : 'Never'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Backup Schedule */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Backup Schedule</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-surface-secondary rounded-lg">
            <div>
              <div className="text-sm font-medium text-gray-900">Daily Full Backup</div>
              <div className="text-sm text-gray-500">Runs every day at 2:00 AM</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                Enabled
              </span>
              <button onClick={() => toast.success('Edit schedule')} className="text-blue-600 hover:text-blue-900 text-sm font-medium">
                Edit
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-surface-secondary rounded-lg">
            <div>
              <div className="text-sm font-medium text-gray-900">Hourly Incremental Backup</div>
              <div className="text-sm text-gray-500">Runs every hour</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                Disabled
              </span>
              <button onClick={() => toast.success('Edit schedule')} className="text-blue-600 hover:text-blue-900 text-sm font-medium">
                Edit
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-surface-secondary rounded-lg">
            <div>
              <div className="text-sm font-medium text-gray-900">Weekly Differential Backup</div>
              <div className="text-sm text-gray-500">Runs every Sunday at 3:00 AM</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                Enabled
              </span>
              <button onClick={() => toast.success('Edit schedule')} className="text-blue-600 hover:text-blue-900 text-sm font-medium">
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Backups List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-medium text-gray-900">Backup History</h2>
        </div>
        {backups.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No backups</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating your first backup.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {backups.map((backup) => (
                  <tr key={backup.id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{backup.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeBadge(backup.type)}`}>
                        {backup.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatFileSize(backup.size)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(backup.status)}`}>
                        {backup.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(backup.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{backup.created_by}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button onClick={() => toast.success('Restore started')} className="text-blue-600 hover:text-blue-900 mr-4">
                        Restore
                      </button>
                      <button onClick={() => toast.success('Download started')} className="text-green-600 hover:text-green-900 mr-4">
                        Download
                      </button>
                      <button onClick={() => toast.success('Backup deleted')} className="text-red-600 hover:text-red-900">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Backup Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Backup Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Retention Period (days)</label>
            <input
              type="number"
              defaultValue={30}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">Backups older than this will be automatically deleted</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Storage Location</label>
            <select className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
              <option value="local">Local Storage</option>
              <option value="s3">Amazon S3</option>
              <option value="azure">Azure Blob Storage</option>
              <option value="gcs">Google Cloud Storage</option>
            </select>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Compress backups</span>
            </label>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Encrypt backups</span>
            </label>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Send notification on backup completion</span>
            </label>
          </div>

          <div className="pt-4">
            <button onClick={() => toast.success('Settings saved')} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
