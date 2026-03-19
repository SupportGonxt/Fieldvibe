import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, DollarSign, Building, Clock, FileText } from 'lucide-react'
import { formatCurrency } from '../../../utils/currency'
import ErrorState from '../../../components/ui/ErrorState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { apiClient } from '../../../services/api.service'

export default function DepositDetail() {
  const { sessionId, depositId } = useParams<{ sessionId: string; depositId: string }>()
  const navigate = useNavigate()

  const { data: session } = useQuery({
    queryKey: ['cash-session', sessionId],
    queryFn: async () => {
      const response = await apiClient.get(`/cash-sessions/${sessionId}`)
      const result = response.data
      return result.data
    },
  })

  const { data: deposit, isLoading, isError } = useQuery({
    queryKey: ['deposit', sessionId, depositId],
    queryFn: async () => {
      const response = await apiClient.get(`/cash-sessions/${sessionId}/deposits/${depositId}`)
      const result = response.data
      return result.data
    },
  })

  const fallbackDeposit = {
    id: depositId,
    session_id: sessionId,
    deposit_number: 'DEP-2024-001',
    deposit_amount: 2450.00,
    deposit_date: '2024-01-20T18:00:00Z',
    bank_name: 'First National Bank',
    account_number: '****1234',
    deposit_slip_number: 'SLIP-2024-001',
    deposited_by: 'John Van Sales',
    verified_by: 'Jane Manager',
    verified_at: '2024-01-20T18:30:00Z',
    status: 'verified',
    breakdown: {
      cash: 2000.00,
      checks: 450.00,
      cards: 0.00,
    },
    notes: 'End of day deposit',
  }

  if (isLoading) {
    return <div className="p-6">Loading deposit details...</div>
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


  if (!deposit) {
    return <div className="p-6">Deposit not found</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate(`/van-sales/cash-sessions/${sessionId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Cash Session
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Deposit Detail</h1>
        <p className="text-gray-600">{deposit.deposit_number}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Total Deposit</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">{formatCurrency(deposit.deposit_amount)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Building className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Bank</h3>
          </div>
          <p className="text-lg font-bold text-gray-900">{deposit.bank_name}</p>
          <p className="text-sm text-gray-600 mt-1">{deposit.account_number}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Status</h3>
          </div>
          <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
            deposit.status === 'verified' ? 'bg-green-100 text-green-800' :
            deposit.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {deposit.status}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Deposit Breakdown</h2>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Cash</dt>
            <dd className="mt-1 text-lg font-bold text-gray-900">
              {formatCurrency(deposit.breakdown.cash)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Checks</dt>
            <dd className="mt-1 text-lg font-bold text-gray-900">
              {formatCurrency(deposit.breakdown.checks)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Cards</dt>
            <dd className="mt-1 text-lg font-bold text-gray-900">
              {formatCurrency(deposit.breakdown.cards)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Deposit Information</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Deposit Slip Number</dt>
            <dd className="mt-1 text-sm text-gray-900">{deposit.deposit_slip_number}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Deposit Date</dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-center gap-1">
              <Clock className="h-4 w-4 text-gray-400" />
              {new Date(deposit.deposit_date).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Deposited By</dt>
            <dd className="mt-1 text-sm text-gray-900">{deposit.deposited_by}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Verified By</dt>
            <dd className="mt-1 text-sm text-gray-900">{deposit.verified_by}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Verified At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(deposit.verified_at).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>

      {deposit.notes && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-700">{deposit.notes}</p>
        </div>
      )}
    </div>
  )
}
