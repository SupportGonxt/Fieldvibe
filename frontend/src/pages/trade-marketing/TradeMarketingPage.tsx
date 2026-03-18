import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { TrendingUp, Target, DollarSign, Users, BarChart3, Calendar, Plus, Filter, Award, Zap, ShoppingCart, TrendingDown } from 'lucide-react'
import { formatCurrency } from '../../utils/currency'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { apiClient } from '../../services/api.service'

interface TradeMarketingMetrics {
  totalSpend: number
  activePromotions: number
  retailerParticipation: number
  roi: number
  marketShare: number
  competitorAnalysis: number
  channelPartners: number
  tradeSpendEfficiency: number
  volumeGrowth: number
  priceRealization: number
}

interface Promotion {
  id: string
  name: string
  type: 'discount' | 'rebate' | 'volume_incentive' | 'display_allowance' | 'trade_spend' | 'channel_program'
  status: 'active' | 'planned' | 'completed' | 'paused'
  startDate: string
  endDate: string
  budget: number
  spent: number
  participatingRetailers: number
  expectedROI: number
  actualROI?: number
  category: string
  channel: string
  performance: {
    volumeImpact: number
    revenueImpact: number
    marginImpact: number
  }
}

interface ChannelPartner {
  id: string
  name: string
  type: 'distributor' | 'retailer' | 'wholesaler'
  tier: 'platinum' | 'gold' | 'silver' | 'bronze'
  totalSpend: number
  performance: number
  programs: number
}

interface CompetitorAnalysis {
  competitor: string
  marketShare: number
  priceIndex: number
  promotionalActivity: number
  trend: 'up' | 'down' | 'stable'
}

export default function TradeMarketingPage() {
  const [metrics, setMetrics] = useState<TradeMarketingMetrics>({
    totalSpend: 0,
    activePromotions: 0,
    retailerParticipation: 0,
    roi: 0,
    marketShare: 0,
    competitorAnalysis: 0,
    channelPartners: 0,
    tradeSpendEfficiency: 0,
    volumeGrowth: 0,
    priceRealization: 0
  })
  
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [channelPartners, setChannelPartners] = useState<ChannelPartner[]>([])
  const [competitorData, setCompetitorData] = useState<CompetitorAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'promotions' | 'channels' | 'competitors'>('overview')

  useEffect(() => {
    fetchTradeMarketingData()
  }, [])

  const fetchTradeMarketingData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const tenantCode = localStorage.getItem('tenantCode') || 'DEMO'
      
      // Fetch metrics
      const metricsResponse = await fetch(`${apiClient.defaults.baseURL}/trade-marketing/metrics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Code': tenantCode
        }
      })
      const metricsData = await metricsResponse.json()
      if (metricsData.success) {
        setMetrics(metricsData.data)
      }

      // Fetch promotions
      const promotionsResponse = await fetch(`${apiClient.defaults.baseURL}/trade-marketing/promotions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Code': tenantCode
        }
      })
      const promotionsData = await promotionsResponse.json()
      if (promotionsData.success) {
        setPromotions(promotionsData.data)
      }

      // Fetch channel partners
      const partnersResponse = await fetch(`${apiClient.defaults.baseURL}/trade-marketing/channel-partners`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Code': tenantCode
        }
      })
      const partnersData = await partnersResponse.json()
      if (partnersData.success) {
        setChannelPartners(partnersData.data)
      }

      // Fetch competitor analysis
      const competitorResponse = await fetch(`${apiClient.defaults.baseURL}/trade-marketing/competitor-analysis`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Code': tenantCode
        }
      })
      const competitorData = await competitorResponse.json()
      if (competitorData.success) {
        setCompetitorData(competitorData.data)
      } else {
        // Fallback to mock data if API returns nothing
        setCompetitorData([
          {
            competitor: 'Competitor A',
            marketShare: 28.5,
            priceIndex: 102.3,
            promotionalActivity: 85.2,
            trend: 'up'
          },
          {
            competitor: 'Competitor B',
            marketShare: 22.1,
            priceIndex: 98.7,
            promotionalActivity: 72.4,
            trend: 'down'
          },
          {
            competitor: 'Competitor C',
            marketShare: 18.9,
            priceIndex: 105.1,
            promotionalActivity: 91.8,
            trend: 'stable'
          }
        ])
      }
    } catch (error) {
      console.error('Error fetching trade marketing data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100'
      case 'planned': return 'text-blue-600 bg-blue-100'
      case 'completed': return 'text-gray-600 bg-gray-100'
      case 'paused': return 'text-yellow-600 bg-yellow-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'discount': return 'text-purple-600 bg-purple-100'
      case 'rebate': return 'text-blue-600 bg-blue-100'
      case 'volume_incentive': return 'text-green-600 bg-green-100'
      case 'display_allowance': return 'text-orange-600 bg-orange-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getBudgetUtilization = (spent: number, budget: number) => {
    return Math.round((spent / budget) * 100)
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
          <h1 className="text-2xl font-bold text-gray-900">Trade Marketing</h1>
          <p className="text-gray-600">Manage trade promotions, retailer incentives, and market analysis</p>
        </div>
        <Button>
          <Target className="h-4 w-4 mr-2" />
          Create Promotion
        </Button>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-100">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Overview', icon: BarChart3 },
            { id: 'promotions', name: 'Promotions', icon: Target },
            { id: 'channels', name: 'Channel Partners', icon: Users },
            { id: 'competitors', name: 'Competitor Analysis', icon: TrendingUp }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Trade Spend</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.totalSpend)}</p>
                <p className="text-xs text-green-600">+12.5% vs last quarter</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Target className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Programs</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.activePromotions}</p>
                <p className="text-xs text-blue-600">{metrics.channelPartners} partners</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Trade ROI</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.roi}x</p>
                <p className="text-xs text-green-600">Efficiency: {metrics.tradeSpendEfficiency}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Zap className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Volume Growth</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.volumeGrowth}%</p>
                <p className="text-xs text-gray-600">Price realization: {metrics.priceRealization}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Market Share</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.marketShare}%</p>
                <p className="text-xs text-green-600">+2.1% vs competitors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Programs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {promotions.slice(0, 3).map((promotion) => (
                  <div key={promotion.id} className="flex items-center justify-between p-4 bg-surface-secondary rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{promotion.name}</div>
                      <div className="text-sm text-gray-500">{promotion.category} • {promotion.channel}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">
                        {promotion.actualROI ? `${promotion.actualROI}x ROI` : `${promotion.expectedROI}x Expected`}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatCurrency(promotion.spent)} spent
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Channel Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {channelPartners.map((partner) => (
                  <div key={partner.id} className="flex items-center justify-between p-4 bg-surface-secondary rounded-lg">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-3 ${
                        partner.tier === 'platinum' ? 'bg-purple-500' :
                        partner.tier === 'gold' ? 'bg-yellow-500' :
                        partner.tier === 'silver' ? 'bg-gray-400' : 'bg-orange-500'
                      }`}></div>
                      <div>
                        <div className="font-medium text-gray-900">{partner.name}</div>
                        <div className="text-sm text-gray-500 capitalize">{partner.type} • {partner.tier}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-blue-600">{partner.performance}%</div>
                      <div className="text-sm text-gray-500">{partner.programs} programs</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'promotions' && (
        <Card>
          <CardHeader>
            <CardTitle>Trade Marketing Programs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-surface-secondary">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Program Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type & Channel
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Budget & Spend
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Performance Impact
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
                  {promotions.map((promotion) => (
                    <tr key={promotion.id} className="hover:bg-surface-secondary">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{promotion.name}</div>
                          <div className="text-sm text-gray-500">
                            {new Date(promotion.startDate).toLocaleDateString()} - {new Date(promotion.endDate).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">{promotion.category}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(promotion.type)}`}>
                          {promotion.type.replace('_', ' ')}
                        </span>
                        <div className="text-xs text-gray-500 mt-1">{promotion.channel}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(promotion.status)}`}>
                          {promotion.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatCurrency(promotion.spent)} / {formatCurrency(promotion.budget)}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className={`h-2 rounded-full ${
                              getBudgetUtilization(promotion.spent, promotion.budget) > 80 
                                ? 'bg-red-600' 
                                : getBudgetUtilization(promotion.spent, promotion.budget) > 60 
                                  ? 'bg-yellow-600' 
                                  : 'bg-green-600'
                            }`}
                            style={{ width: `${getBudgetUtilization(promotion.spent, promotion.budget)}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {getBudgetUtilization(promotion.spent, promotion.budget)}% utilized
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs text-gray-600">
                          <div>Volume: +{promotion.performance.volumeImpact}%</div>
                          <div>Revenue: +{promotion.performance.revenueImpact}%</div>
                          <div>Margin: +{promotion.performance.marginImpact}%</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          Expected: {promotion.expectedROI}x
                        </div>
                        {promotion.actualROI && (
                          <div className={`text-sm ${promotion.actualROI >= promotion.expectedROI ? 'text-green-600' : 'text-red-600'}`}>
                            Actual: {promotion.actualROI}x
                          </div>
                        )}
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
      )}

      {activeTab === 'channels' && (
        <Card>
          <CardHeader>
            <CardTitle>Channel Partner Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {channelPartners.map((partner) => (
                <Card key={partner.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className={`w-4 h-4 rounded-full mr-3 ${
                          partner.tier === 'platinum' ? 'bg-purple-500' :
                          partner.tier === 'gold' ? 'bg-yellow-500' :
                          partner.tier === 'silver' ? 'bg-gray-400' : 'bg-orange-500'
                        }`}></div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{partner.name}</h3>
                          <p className="text-sm text-gray-500 capitalize">{partner.type}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${
                        partner.tier === 'platinum' ? 'text-purple-600 bg-purple-100' :
                        partner.tier === 'gold' ? 'text-yellow-600 bg-yellow-100' :
                        partner.tier === 'silver' ? 'text-gray-600 bg-gray-100' : 'text-orange-600 bg-orange-100'
                      }`}>
                        {partner.tier}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Total Spend</span>
                        <span className="font-medium">{formatCurrency(partner.totalSpend)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Performance</span>
                        <span className="font-medium text-green-600">{partner.performance}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Active Programs</span>
                        <span className="font-medium">{partner.programs}</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t">
                      <Button variant="outline" size="sm" className="w-full">
                        Manage Programs
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'competitors' && (
        <Card>
          <CardHeader>
            <CardTitle>Competitive Intelligence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-surface-secondary">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Competitor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Market Share
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price Index
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Promotional Activity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trend
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {competitorData.map((competitor, index) => (
                    <tr key={index} className="hover:bg-surface-secondary">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{competitor.competitor}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{competitor.marketShare}%</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="h-2 rounded-full bg-blue-600"
                            style={{ width: `${(competitor.marketShare / 35) * 100}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm ${competitor.priceIndex > 100 ? 'text-red-600' : 'text-green-600'}`}>
                          {competitor.priceIndex}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{competitor.promotionalActivity}%</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="h-2 rounded-full bg-orange-600"
                            style={{ width: `${competitor.promotionalActivity}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${
                          competitor.trend === 'up' ? 'text-green-600 bg-green-100' :
                          competitor.trend === 'down' ? 'text-red-600 bg-red-100' :
                          'text-gray-600 bg-gray-100'
                        }`}>
                          {competitor.trend === 'up' ? <TrendingUp className="h-3 w-3 mr-1" /> :
                           competitor.trend === 'down' ? <TrendingDown className="h-3 w-3 mr-1" /> :
                           <BarChart3 className="h-3 w-3 mr-1" />}
                          {competitor.trend}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Button variant="outline" size="sm">
                          View Analysis
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}