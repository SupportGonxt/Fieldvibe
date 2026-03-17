import React, { useState, useEffect } from 'react'
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  XCircle,
  Filter,
  Download,
  Eye
} from 'lucide-react'
import { fieldMarketingService, Commission, CommissionSummary } from '../../services/field-marketing.service'
import { ConfirmDialog } from '../ui/ConfirmDialog'

export default function CommissionDashboard() {
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [summary, setSummary] = useState<CommissionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [approveConfirmId, setApproveConfirmId] = useState<string | null>(null)
  const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    loadCommissions()
  }, [filterStatus, filterType])

  const loadCommissions = async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (filterStatus !== 'all') params.status = filterStatus
      if (filterType !== 'all') params.activity_type = filterType
      
      const response = await fieldMarketingService.getCommissions(params)
      setCommissions(response.data)
      
      // Calculate summary
      const pending = response.data.filter(c => c.status === 'pending')
      const approved = response.data.filter(c => c.status === 'approved')
      const paid = response.data.filter(c => c.status === 'paid')
      const rejected = response.data.filter(c => c.status === 'rejected')
      
      setSummary({
        total_pending: pending.reduce((sum, c) => sum + c.total_amount, 0),
        total_approved: approved.reduce((sum, c) => sum + c.total_amount, 0),
        total_paid: paid.reduce((sum, c) => sum + c.total_amount, 0),
        total_rejected: rejected.reduce((sum, c) => sum + c.total_amount, 0),
        pending_commissions: pending,
        approved_commissions: approved,
        monthly_breakdown: []
      })
    } catch (error) {
      console.error('Error loading commissions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = (id: string) => {
    setApproveConfirmId(id)
  }

  const confirmApprove = async () => {
    if (!approveConfirmId) return
    try {
      await fieldMarketingService.approveCommission(approveConfirmId)
      loadCommissions()
    } catch (error) {
      console.error('Error approving commission:', error)
    }
    setApproveConfirmId(null)
  }

  const handleReject = (id: string) => {
    setRejectConfirmId(id)
  }

  const confirmReject = async (reason?: string) => {
    if (!rejectConfirmId || !reason) return
    try {
      await fieldMarketingService.rejectCommission(rejectConfirmId, { rejection_reason: reason })
      loadCommissions()
    } catch (error) {
      console.error('Error rejecting commission:', error)
    }
    setRejectConfirmId(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'paid': return 'bg-blue-100 text-blue-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'info_requested': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getActivityTypeLabel = (type: string) => {
    switch (type) {
      case 'board_installation': return 'Board Installation'
      case 'product_distribution': return 'Product Distribution'
      default: return type
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Commission Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage and approve field agent commissions</p>
        </div>
        <button
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Download className="w-5 h-5" />
          Export Report
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">
                  ${summary.total_pending.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {summary.pending_commissions.length} commissions
                </p>
              </div>
              <Clock className="w-10 h-10 text-yellow-500" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-green-600">
                  ${summary.total_approved.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {summary.approved_commissions.length} commissions
                </p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Paid</p>
                <p className="text-2xl font-bold text-blue-600">
                  ${summary.total_paid.toFixed(2)}
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${(summary.total_pending + summary.total_approved + summary.total_paid).toFixed(2)}
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-purple-500" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="info_requested">Info Requested</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="paid">Paid</option>
        </select>
        
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          <option value="board_installation">Board Installation</option>
          <option value="product_distribution">Product Distribution</option>
        </select>
      </div>

      {/* Commissions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Agent
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Activity Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  Loading commissions...
                </td>
              </tr>
            ) : commissions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  No commissions found
                </td>
              </tr>
            ) : (
              commissions.map((commission) => (
                <tr key={commission.id} className="hover:bg-surface-secondary">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">
                      {commission.agent_name || 'Unknown Agent'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {getActivityTypeLabel(commission.activity_type)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(commission.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        ${commission.total_amount.toFixed(2)}
                      </div>
                      {commission.bonus_amount > 0 && (
                        <div className="text-xs text-green-600">
                          +${commission.bonus_amount.toFixed(2)} bonus
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      getStatusColor(commission.status)
                    }`}>
                      {commission.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedCommission(commission)
                          setShowDetails(true)
                        }}
                        className="text-blue-600 hover:text-blue-900"
                        title="View Details"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      {commission.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(commission.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Approve"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleReject(commission.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Reject"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Details Modal */}
      {showDetails && selectedCommission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Commission Details</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Agent</p>
                  <p className="font-medium">{selectedCommission.agent_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Activity Type</p>
                  <p className="font-medium">{getActivityTypeLabel(selectedCommission.activity_type)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Base Amount</p>
                  <p className="font-medium">${selectedCommission.base_amount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Bonus Amount</p>
                  <p className="font-medium text-green-600">${selectedCommission.bonus_amount.toFixed(2)}</p>
                </div>
              </div>

              {selectedCommission.penalty_amount > 0 && (
                <div>
                  <p className="text-sm text-gray-600">Penalty Amount</p>
                  <p className="font-medium text-red-600">-${selectedCommission.penalty_amount.toFixed(2)}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-gray-900">${selectedCommission.total_amount.toFixed(2)}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Status</p>
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                  getStatusColor(selectedCommission.status)
                }`}>
                  {selectedCommission.status}
                </span>
              </div>

              {selectedCommission.calculation_details && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Calculation Details</p>
                  <pre className="bg-surface-secondary p-4 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedCommission.calculation_details, null, 2)}
                  </pre>
                </div>
              )}

              {selectedCommission.notes && (
                <div>
                  <p className="text-sm text-gray-600">Notes</p>
                  <p className="text-sm">{selectedCommission.notes}</p>
                </div>
              )}

              {selectedCommission.rejection_reason && (
                <div>
                  <p className="text-sm text-gray-600">Rejection Reason</p>
                  <p className="text-sm text-red-600">{selectedCommission.rejection_reason}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
                <div>
                  <p>Created: {new Date(selectedCommission.created_at).toLocaleString()}</p>
                </div>
                {selectedCommission.approved_at && (
                  <div>
                    <p>Approved: {new Date(selectedCommission.approved_at).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              {selectedCommission.status === 'pending' && (
                <>
                  <button
                    onClick={() => {
                      handleReject(selectedCommission.id)
                      setShowDetails(false)
                    }}
                    className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => {
                      handleApprove(selectedCommission.id)
                      setShowDetails(false)
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Approve
                  </button>
                </>
              )}
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-surface-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={approveConfirmId !== null}
        onClose={() => setApproveConfirmId(null)}
        onConfirm={confirmApprove}
        title="Approve Commission"
        message="Are you sure you want to approve this commission?"
        confirmLabel="Approve"
        variant="info"
      />

      <ConfirmDialog
        isOpen={rejectConfirmId !== null}
        onClose={() => setRejectConfirmId(null)}
        onConfirm={confirmReject}
        title="Reject Commission"
        message="Please enter a reason for rejecting this commission."
        confirmLabel="Reject"
        variant="danger"
        showReasonInput
        reasonPlaceholder="Enter rejection reason..."
        reasonRequired
      />
    </div>
  )
}
