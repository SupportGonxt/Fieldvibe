import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Edit, DollarSign, TrendingUp, Calendar } from 'lucide-react'
import { formatCurrency } from '../../utils/currency'
import DocumentActions from '../../components/export/DocumentActions'
import ErrorState from '../../components/ui/ErrorState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import type { DocumentData } from '../../utils/pdf/document-generator'

export default function CommissionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: commission, isLoading, isError } = useQuery({
    queryKey: ['commission', id],
    queryFn: async () => {
      return {
        id,
        agent_name: 'John Doe',
        period: 'January 2024',
        base_amount: 5000,
        bonus_amount: 1500,
        total_amount: 6500,
        status: 'approved',
        sales_target: 50000,
        sales_achieved: 62000,
        achievement_rate: 124,
        payment_date: '2024-02-05',
        notes: 'Exceeded target by 24%'
      }
    },
  })

  if (isLoading) {
    return <div className="p-6">Loading commission details...</div>
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


  if (!commission) {
    return <div className="p-6">Commission not found</div>
  }

  const documentData: DocumentData = {
    type: 'commission_statement',
    number: `COM-${id}`,
    date: commission.payment_date || new Date().toISOString(),
    status: commission.status,
    company: { name: 'Fieldvibe', email: 'commissions@fieldvibe.com' },
    customer: { name: commission.agent_name || 'Agent' },
    items: [],
    subtotal: 0,
    tax_total: 0,
    total: commission.total_amount || 0,
    agent_name: commission.agent_name,
    period: commission.period,
    base_amount: commission.base_amount,
    bonus_amount: commission.bonus_amount,
    total_amount: commission.total_amount,
    sales_target: commission.sales_target,
    sales_achieved: commission.sales_achieved,
    achievement_rate: commission.achievement_rate,
    payment_date: commission.payment_date,
    notes: commission.notes,
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/commissions')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Commissions
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{commission.agent_name}</h1>
            <p className="text-gray-600">{commission.period}</p>
          </div>
          <div className="flex gap-2">
            <DocumentActions documentData={documentData} />
            <button
              onClick={() => navigate(`/commissions/${id}/edit`)}
              className="btn-secondary flex items-center gap-2"
            >
              <Edit className="h-5 w-5" />
              Edit
            </button>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              commission.status === 'approved' ? 'bg-green-100 text-green-800' : 
              commission.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
              'bg-blue-100 text-blue-800'
            }`}>
              {commission.status}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Total Commission</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(commission.total_amount)}</p>
          <p className="text-sm text-gray-600 mt-1">
            Base: {formatCurrency(commission.base_amount)} + Bonus: {formatCurrency(commission.bonus_amount)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Achievement Rate</h3>
          </div>
          <p className="text-3xl font-bold text-gray-900">{commission.achievement_rate}%</p>
          <p className="text-sm text-gray-600 mt-1">
            {formatCurrency(commission.sales_achieved)} / {formatCurrency(commission.sales_target)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Payment Date</h3>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {new Date(commission.payment_date).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Commission Details</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Agent</dt>
            <dd className="mt-1 text-sm text-gray-900">{commission.agent_name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Period</dt>
            <dd className="mt-1 text-sm text-gray-900">{commission.period}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Sales Target</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatCurrency(commission.sales_target)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Sales Achieved</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatCurrency(commission.sales_achieved)}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-sm font-medium text-gray-500">Notes</dt>
            <dd className="mt-1 text-sm text-gray-900">{commission.notes || '-'}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
