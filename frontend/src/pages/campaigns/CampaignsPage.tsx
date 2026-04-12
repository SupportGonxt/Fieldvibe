import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Megaphone, Users, Eye, MousePointer, TrendingUp, Calendar } from 'lucide-react'
import { formatCurrency } from '../../utils/currency'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { apiClient } from '../../services/api.service'

interface CampaignMetrics {
  totalCampaigns: number
  activeCampaigns: number
  totalReach: number
  averageCTR: number
  totalSpend: number
  averageROI: number
}

interface Campaign {
  id: string
  name: string
  type: 'email' | 'social' | 'display' | 'search' | 'multi_channel'
  status: 'draft' | 'active' | 'paused' | 'completed' | 'scheduled'
  startDate: string
  endDate: string
  budget: number
  spent: number
  reach: number
  impressions: number
  clicks: number
  conversions: number
  ctr: number
  roi: number
  targetAudience: string
}

export default function CampaignsPage() {
  const [metrics, setMetrics] = useState<CampaignMetrics>({
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalReach: 0,
    averageCTR: 0,
    totalSpend: 0,
    averageROI: 0
  })
  
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCampaignsData()
  }, [])

  const fetchCampaignsData = async () => {
    try {
      setLoading(true)
      const [metricsRes, campaignsRes] = await Promise.all([
        apiClient.get('/campaigns/metrics').catch(() => ({ data: null })),
        apiClient.get('/campaigns'),
      ])

      if (metricsRes.data?.data) {
        const m = metricsRes.data.data
        setMetrics({
          totalCampaigns: Number(m.total_campaigns || m.totalCampaigns || 0),
          activeCampaigns: Number(m.active_campaigns || m.activeCampaigns || 0),
          totalReach: Number(m.total_reach || m.totalReach || 0),
          averageCTR: Number(m.average_ctr || m.averageCTR || 0),
          totalSpend: Number(m.total_spend || m.totalSpend || 0),
          averageROI: Number(m.average_roi || m.averageROI || 0),
        })
      }

      const data = campaignsRes.data?.data || campaignsRes.data?.campaigns || campaignsRes.data || []
      const campaignList = Array.isArray(data) ? data : []
      setCampaigns(campaignList.map((c: any) => ({
        id: String(c.id),
        name: c.name || '',
        type: c.type || 'email',
        status: c.status || 'draft',
        startDate: c.start_date || c.startDate || '',
        endDate: c.end_date || c.endDate || '',
        budget: Number(c.budget || 0),
        spent: Number(c.spent || 0),
        reach: Number(c.reach || 0),
        impressions: Number(c.impressions || 0),
        clicks: Number(c.clicks || 0),
        conversions: Number(c.conversions || 0),
        ctr: Number(c.ctr || 0),
        roi: Number(c.roi || 0),
        targetAudience: c.target_audience || c.targetAudience || '',
      })))
    } catch {
      setCampaigns([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100'
      case 'draft': return 'text-gray-600 bg-gray-100'
      case 'paused': return 'text-yellow-600 bg-yellow-100'
      case 'completed': return 'text-blue-600 bg-blue-100'
      case 'scheduled': return 'text-purple-600 bg-purple-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'email': return 'text-blue-600 bg-blue-100'
      case 'social': return 'text-pink-600 bg-pink-100'
      case 'display': return 'text-orange-600 bg-orange-100'
      case 'search': return 'text-green-600 bg-green-100'
      case 'multi_channel': return 'text-purple-600 bg-purple-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getBudgetUtilization = (spent: number, budget: number) => {
    return budget > 0 ? Math.round((spent / budget) * 100) : 0
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaign Management</h1>
          <p className="text-gray-600">Create, manage, and track marketing campaigns across all channels</p>
        </div>
        <Button>
          <Megaphone className="h-4 w-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Megaphone className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Campaigns</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.totalCampaigns}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Campaigns</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.activeCampaigns}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Reach</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.totalReach.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <MousePointer className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Average CTR</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.averageCTR}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <Eye className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Spend</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.totalSpend)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Average ROI</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.averageROI}x</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Campaign Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Budget
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Performance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ROI
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-surface-secondary">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{campaign.name}</div>
                        <div className="text-sm text-gray-500">{campaign.targetAudience}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(campaign.type)}`}>
                        {campaign.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(campaign.status)}`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatCurrency(campaign.spent)} / {formatCurrency(campaign.budget)}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div 
                          className={`h-2 rounded-full ${
                            getBudgetUtilization(campaign.spent, campaign.budget) > 80 
                              ? 'bg-red-600' 
                              : getBudgetUtilization(campaign.spent, campaign.budget) > 60 
                                ? 'bg-yellow-600' 
                                : 'bg-green-600'
                          }`}
                          style={{ width: `${getBudgetUtilization(campaign.spent, campaign.budget)}%` }}
                        ></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        Reach: {campaign.reach.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-500">
                        CTR: {campaign.ctr}% | Conv: {campaign.conversions}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${campaign.roi >= 3 ? 'text-green-600' : campaign.roi >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {campaign.roi > 0 ? `${campaign.roi}x` : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
