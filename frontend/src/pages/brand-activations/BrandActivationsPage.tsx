import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { Calendar, Filter, MapPin, Plus, Target, User, Users } from 'lucide-react'
import { apiClient } from '../../services/api.service'
import { formatDate } from '../../utils/format'

interface Activation {
  id: string
  name: string
  campaign_id: string
  campaign_name?: string | null
  customer_id?: string | null
  customer_name?: string | null
  agent_id?: string | null
  agent_name?: string | null
  location_description?: string | null
  scheduled_start?: string | null
  scheduled_end?: string | null
  actual_start?: string | null
  actual_end?: string | null
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | string
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function BrandActivationsPage() {
  const navigate = useNavigate()
  const [activations, setActivations] = useState<Activation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const params: Record<string, string> = {}
        if (statusFilter) params.status = statusFilter
        const res = await apiClient.get('/activations', { params })
        const list = res.data?.data || res.data || []
        if (!cancelled) setActivations(Array.isArray(list) ? list : [])
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.message || err?.message || 'Failed to load activations')
          setActivations([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [statusFilter])

  const summary = useMemo(() => {
    const counts: Record<string, number> = { scheduled: 0, in_progress: 0, completed: 0, cancelled: 0 }
    for (const a of activations) {
      if (counts[a.status] != null) counts[a.status] += 1
    }
    return counts
  }, [activations])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Brand Activations</h1>
          <p className="text-gray-500 mt-1">In-store demos, sampling and customer engagement events</p>
        </div>
        <Button onClick={() => navigate('/marketing/activations/create')} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Schedule Activation
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Scheduled" value={summary.scheduled} tone="bg-blue-50 text-blue-700" />
        <SummaryCard label="In progress" value={summary.in_progress} tone="bg-amber-50 text-amber-700" />
        <SummaryCard label="Completed" value={summary.completed} tone="bg-green-50 text-green-700" />
        <SummaryCard label="Cancelled" value={summary.cancelled} tone="bg-red-50 text-red-700" />
      </div>

      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <label className="text-sm font-medium text-gray-700">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 flex justify-center"><LoadingSpinner size="md" /></div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">{error}</div>
          ) : activations.length === 0 ? (
            <EmptyState onCreate={() => navigate('/marketing/activations/create')} />
          ) : (
            <ActivationsTable rows={activations} onOpen={(id) => navigate(`/marketing/activations/${id}`)} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-lg p-4 ${tone}`}>
      <div className="text-sm font-medium opacity-80">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="p-12 text-center text-gray-500">
      <Target className="w-12 h-12 mx-auto mb-4 text-gray-400" />
      <p className="mb-4">No activations match the current filter.</p>
      <Button onClick={onCreate} variant="outline" className="inline-flex items-center gap-2">
        <Plus className="w-4 h-4" />
        Schedule the first activation
      </Button>
    </div>
  )
}

function ActivationsTable({ rows, onOpen }: { rows: Activation[]; onOpen: (id: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <Th>Name</Th>
            <Th>Campaign</Th>
            <Th>Location</Th>
            <Th>Customer</Th>
            <Th>Agent</Th>
            <Th>Scheduled</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {rows.map((a) => (
            <tr key={a.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onOpen(a.id)}>
              <Td className="font-medium text-primary-600">{a.name}</Td>
              <Td>{a.campaign_name || '—'}</Td>
              <Td>
                <span className="inline-flex items-center gap-1 text-gray-700">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  {a.location_description || '—'}
                </span>
              </Td>
              <Td>
                <span className="inline-flex items-center gap-1 text-gray-700">
                  <Users className="w-3.5 h-3.5 text-gray-400" />
                  {a.customer_name || '—'}
                </span>
              </Td>
              <Td>
                <span className="inline-flex items-center gap-1 text-gray-700">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  {a.agent_name || '—'}
                </span>
              </Td>
              <Td>
                <span className="inline-flex items-center gap-1 text-gray-700">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  {a.scheduled_start ? formatDate(a.scheduled_start) : '—'}
                </span>
              </Td>
              <Td>
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[a.status] || 'bg-gray-100 text-gray-800'}`}>
                  {a.status?.replace('_', ' ') || 'unknown'}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm text-gray-700 ${className}`}>{children}</td>
}
