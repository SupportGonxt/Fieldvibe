import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { commissionsService } from '../../services/commissions.service'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

interface PendingCommission {
  id: string
  agent_name: string
  agent_id: string
  transaction_type: string
  transaction_date: string
  amount: number
  commission_amount: number
  submitted_date: string
  notes?: string
}

export const CommissionApprovalPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [selectedCommissions, setSelectedCommissions] = useState<Set<string>>(new Set())
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)

  const { data: pendingData, isLoading, isError } = useQuery({
    queryKey: ['commission-earnings-pending'],
    queryFn: () => commissionsService.getCommissions({ status: 'pending' }),
  })

  const approveMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map(id => commissionsService.approveCommission(id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission-earnings-pending'] })
      toast.success('Commissions approved successfully')
      setSelectedCommissions(new Set())
    },
    onError: () => toast.error('Failed to approve commissions'),
  })

  const pendingCommissions: PendingCommission[] = (pendingData?.commissions || []).map((c: any) => ({
    id: String(c.id),
    agent_name: c.agent_name || c.earner_name || c.user_name || 'Unknown Agent',
    agent_id: String(c.agent_id || c.earner_id || c.user_id || ''),
    transaction_type: c.transaction_type || c.source_type || c.type || 'Sale',
    transaction_date: c.transaction_date || c.created_at || new Date().toISOString(),
    amount: Number(c.base_amount || c.amount || 0),
    commission_amount: Number(c.commission_amount || c.amount || 0),
    submitted_date: c.submitted_date || c.created_at || new Date().toISOString(),
    notes: c.notes,
  }))

  if (isLoading) return <LoadingSpinner />


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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount)
  }

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedCommissions)
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }
    setSelectedCommissions(newSelection)
  }

  const toggleSelectAll = () => {
    if (selectedCommissions.size === pendingCommissions.length) {
      setSelectedCommissions(new Set())
    } else {
      setSelectedCommissions(new Set(pendingCommissions.map(c => c.id)))
    }
  }

  const handleBulkApprove = () => {
    if (selectedCommissions.size === 0) return
    approveMutation.mutate(Array.from(selectedCommissions))
  }

  const handleBulkReject = () => {
    if (selectedCommissions.size === 0 || !rejectionReason) return
    Promise.all(Array.from(selectedCommissions).map(id =>
      commissionsService.reverseCommission(id, rejectionReason)
    )).then(() => {
      queryClient.invalidateQueries({ queryKey: ['commission-earnings-pending'] })
      toast.success('Commissions rejected')
      setSelectedCommissions(new Set())
      setRejectionReason('')
      setShowRejectModal(false)
    }).catch(() => toast.error('Failed to reject commissions'))
  }

  const selectedTotal = pendingCommissions
    .filter(c => selectedCommissions.has(c.id))
    .reduce((sum, c) => sum + c.commission_amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commission Approval</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review and approve pending commission payments
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={selectedCommissions.size === 0}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reject Selected
          </button>
          <button
            onClick={handleBulkApprove}
            disabled={selectedCommissions.size === 0}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Approve Selected
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Pending Approval</p>
              <p className="text-2xl font-semibold text-gray-900">{pendingCommissions.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Amount</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(pendingCommissions.reduce((sum, c) => sum + c.commission_amount, 0))}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
              <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Selected</p>
              <p className="text-2xl font-semibold text-gray-900">
                {selectedCommissions.size > 0 ? formatCurrency(selectedTotal) : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Commissions List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {pendingCommissions.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No pending commissions</h3>
            <p className="mt-1 text-sm text-gray-500">All commissions have been processed.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedCommissions.size === pendingCommissions.length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Agent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transaction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transaction Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Base Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Commission
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingCommissions.map((commission) => (
                  <tr key={commission.id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedCommissions.has(commission.id)}
                        onChange={() => toggleSelection(commission.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{commission.agent_name}</div>
                      <div className="text-sm text-gray-500">{commission.agent_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{commission.transaction_type}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(commission.transaction_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatCurrency(commission.amount)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCurrency(commission.commission_amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(commission.submitted_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button onClick={() => toast.success('Viewing commission details')} className="text-blue-600 hover:text-blue-900 mr-4">
                        View
                      </button>
                      <button onClick={() => toast.success('Commission approved')} className="text-green-600 hover:text-green-900 mr-4">
                        Approve
                      </button>
                      <button onClick={() => toast.success('Commission rejected')} className="text-red-600 hover:text-red-900">
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Reject Commissions</h3>
            <p className="text-sm text-gray-500 mb-4">
              You are about to reject {selectedCommissions.size} commission(s). Please provide a reason.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 mb-4"
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectionReason('')
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkReject}
                disabled={!rejectionReason}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
