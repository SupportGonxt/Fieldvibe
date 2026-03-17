import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  FileText, 
  Download, 
  Calendar, 
  Filter,
  BarChart3,
  PieChart,
  TrendingUp,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Printer
} from 'lucide-react'
import {
  LineChart,
  AreaChart,
  BarChart,
  PieChart as RechartsPieChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  Bar,
  Line,
  Cell,
  Pie
} from 'recharts'
import { kycService } from '../../services/kyc.service'
import { formatDate, formatNumber } from '../../utils/format'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

interface ReportFilter {
  start_date: string
  end_date: string
  agent_id?: string
  status?: string
  risk_level?: string
  report_type: 'summary' | 'detailed' | 'compliance' | 'performance'
}

export default function KYCReports() {
  const [filter, setFilter] = useState<ReportFilter>({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    report_type: 'summary'
  })

  const [selectedReport, setSelectedReport] = useState<string>('summary')

  const { data: reportData, isLoading, isError, refetch } = useQuery({
    queryKey: ['kyc-reports', filter],
    queryFn: () => kycService.getKYCReports(filter),
    staleTime: 1000 * 60 * 5,
  })

  const { data: agents } = useQuery({
    queryKey: ['kyc-agents'],
    queryFn: () => kycService.getKYCAgents(),
    staleTime: 1000 * 60 * 10,
  })

  const handleExport = (format: 'pdf' | 'excel') => {
    kycService.exportKYCReport(format, filter)
    toast.success(`${format.toUpperCase()} report export started`)
  }

  const handlePrint = () => {
    window.print()
  }

  const reportTypes = [
    { id: 'summary', name: 'Summary Report', icon: BarChart3, description: 'Overview of KYC metrics and trends' },
    { id: 'detailed', name: 'Detailed Report', icon: FileText, description: 'Comprehensive submission details' },
    { id: 'compliance', name: 'Compliance Report', icon: CheckCircle, description: 'Regulatory compliance analysis' },
    { id: 'performance', name: 'Performance Report', icon: TrendingUp, description: 'Agent and process performance' }
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KYC Reports</h1>
          <p className="text-gray-600">Comprehensive KYC compliance and performance reporting</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handlePrint}
            className="btn-outline flex items-center space-x-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
          <div className="flex space-x-1">
            <button
              onClick={() => handleExport('pdf')}
              className="btn-outline flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>PDF</span>
            </button>
            <button
              onClick={() => handleExport('excel')}
              className="btn-outline flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Excel</span>
            </button>
            <button
              onClick={() => handleExport('excel')}
              className="btn-outline flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Report Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {reportTypes.map((type) => {
          const Icon = type.icon
          return (
            <button
              key={type.id}
              onClick={() => {
                setSelectedReport(type.id)
                setFilter({ ...filter, report_type: type.id as any })
              }}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedReport === type.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-100 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center mb-2">
                <Icon className={`w-5 h-5 mr-2 ${
                  selectedReport === type.id ? 'text-blue-600' : 'text-gray-400'
                }`} />
                <h3 className={`font-medium ${
                  selectedReport === type.id ? 'text-blue-900' : 'text-gray-900'
                }`}>
                  {type.name}
                </h3>
              </div>
              <p className="text-sm text-gray-600">{type.description}</p>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filter.start_date}
              onChange={(e) => setFilter({ ...filter, start_date: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={filter.end_date}
              onChange={(e) => setFilter({ ...filter, end_date: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Agent
            </label>
            <select
              value={filter.agent_id || ''}
              onChange={(e) => setFilter({ ...filter, agent_id: e.target.value || undefined })}
              className="input"
            >
              <option value="">All Agents</option>
              {(agents || []).map((agent: any) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filter.status || ''}
              onChange={(e) => setFilter({ ...filter, status: e.target.value || undefined })}
              className="input"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="requires_update">Requires Update</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Risk Level
            </label>
            <select
              value={filter.risk_level || ''}
              onChange={(e) => setFilter({ ...filter, risk_level: e.target.value || undefined })}
              className="input"
            >
              <option value="">All Risk Levels</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
            </select>
          </div>
        </div>
      </div>

      {/* Report Content */}
      {selectedReport === 'summary' && (
        <div className="space-y-6">
          {/* Summary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="p-3 rounded-lg bg-blue-100">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Submissions</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatNumber(reportData?.summary?.total_submissions || 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="p-3 rounded-lg bg-green-100">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Approved</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatNumber(reportData?.summary?.approved_submissions || 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="p-3 rounded-lg bg-yellow-100">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Avg. Processing Time</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {reportData?.summary?.avg_processing_time || 0} days
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="p-3 rounded-lg bg-purple-100">
                    <TrendingUp className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Approval Rate</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {reportData?.summary?.approval_rate || 0}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Submission Trends</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={reportData?.charts?.submission_trends || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(value) => formatDate(value, 'MMM dd')} />
                    <YAxis />
                    <Tooltip labelFormatter={(value) => formatDate(value)} />
                    <Area type="monotone" dataKey="submissions" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Distribution</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={reportData?.charts?.status_distribution || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {(reportData?.charts?.status_distribution || []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedReport === 'detailed' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Submissions</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Agent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Risk Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Processing Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(reportData?.detailed?.submissions || []).map((submission: any) => (
                  <tr key={submission.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{submission.customer_name}</div>
                        <div className="text-sm text-gray-500">{submission.customer_code}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {submission.agent_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        submission.status === 'approved' ? 'bg-green-100 text-green-800' :
                        submission.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        submission.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {submission.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        submission.risk_level === 'low' ? 'bg-green-100 text-green-800' :
                        submission.risk_level === 'high' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {submission.risk_level?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {submission.overall_score}/100
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(submission.submission_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {submission.processing_time || 0} days
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedReport === 'compliance' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {reportData?.compliance?.compliance_rate || 0}%
                </div>
                <div className="text-sm text-gray-500">Overall Compliance Rate</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">
                  {reportData?.compliance?.violations || 0}
                </div>
                <div className="text-sm text-gray-500">Policy Violations</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {reportData?.compliance?.pending_reviews || 0}
                </div>
                <div className="text-sm text-gray-500">Pending Reviews</div>
              </div>
            </div>
          </div>

          {reportData?.compliance?.violations_by_type && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Violations by Type</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.compliance.violations_by_type}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#EF4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedReport === 'performance' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Agent Performance</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-surface-secondary">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Agent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Submissions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Approval Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg. Processing Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quality Score
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(reportData?.performance?.agents || []).map((agent: any) => (
                    <tr key={agent.agent_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {agent.agent_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {agent.total_submissions}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {agent.approval_rate}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {agent.avg_processing_time} days
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {agent.quality_score}/100
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}