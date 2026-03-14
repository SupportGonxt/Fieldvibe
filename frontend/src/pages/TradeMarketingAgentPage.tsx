import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tradeMarketingService } from '../services/tradeMarketing.service';

const TradeMarketingAgentPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [visits, setVisits] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>({
    visitsSummary: { total_visits: 0, completed_visits: 0 },
    shelfSummary: { avg_shelf_share: 0 },
    skuSummary: { total_skus_checked: 0, available_skus: 0 },
    activationsSummary: { total_activations: 0, total_samples: 0 }
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [visitsRes, analyticsRes] = await Promise.all([
        tradeMarketingService.getVisits({ startDate: today }),
        tradeMarketingService.getAnalyticsSummary()
      ]);
      
      setVisits(visitsRes.visits || []);
      setAnalytics(analyticsRes);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const startNewVisit = () => {
    navigate('/trade-marketing/store-selection');
  };

  return (
    <div className="min-h-screen bg-surface-secondary p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Trade Marketing Agent</h1>
          <p className="text-gray-600">In-Store Analytics • Shelf Monitoring • Brand Activations</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-gray-600 text-sm">Today's Visits</div>
            <div className="text-2xl font-bold text-blue-600">
              {visits.filter(v => v.visit_status === 'completed').length}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-gray-600 text-sm">Avg Shelf Share</div>
            <div className="text-2xl font-bold text-green-600">
              {analytics.shelfSummary?.avg_shelf_share?.toFixed(1) || 0}%
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-gray-600 text-sm">SKUs Checked</div>
            <div className="text-2xl font-bold text-purple-600">
              {analytics.skuSummary?.total_skus_checked || 0}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-gray-600 text-sm">Activations</div>
            <div className="text-2xl font-bold text-orange-600">
              {analytics.activationsSummary?.total_activations || 0}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <button
            onClick={startNewVisit}
            className="bg-blue-600 text-white p-6 rounded-lg shadow-lg hover:bg-blue-700 transition"
          >
            <div className="text-lg font-bold mb-2">🏪 Start Store Visit</div>
            <div className="text-sm opacity-90">Check-in and begin audit</div>
          </button>
          
          <button
            onClick={() => navigate('/trade-marketing/visits')}
            className="bg-green-600 text-white p-6 rounded-lg shadow-lg hover:bg-green-700 transition"
          >
            <div className="text-lg font-bold mb-2">📊 My Visits</div>
            <div className="text-sm opacity-90">View visit history</div>
          </button>
          
          <button
            onClick={() => navigate('/trade-marketing/analytics')}
            className="bg-purple-600 text-white p-6 rounded-lg shadow-lg hover:bg-purple-700 transition"
          >
            <div className="text-lg font-bold mb-2">📈 Analytics</div>
            <div className="text-sm opacity-90">Performance metrics</div>
          </button>
        </div>

        {/* Activity Modules */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center mb-3">
              <div className="text-3xl mr-3">📏</div>
              <div>
                <div className="font-bold">Shelf Analytics</div>
                <div className="text-sm text-gray-600">Measure shelf space & facings</div>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Track brand presence vs competitors
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center mb-3">
              <div className="text-3xl mr-3">✅</div>
              <div>
                <div className="font-bold">SKU Availability</div>
                <div className="text-sm text-gray-600">Check stock & pricing</div>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Monitor availability & price compliance
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center mb-3">
              <div className="text-3xl mr-3">🎯</div>
              <div>
                <div className="font-bold">POS Materials</div>
                <div className="text-sm text-gray-600">Track display materials</div>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Verify POS material installation
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center mb-3">
              <div className="text-3xl mr-3">🎉</div>
              <div>
                <div className="font-bold">Brand Activations</div>
                <div className="text-sm text-gray-600">Execute campaigns</div>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Run promotions & collect feedback
            </div>
          </div>
        </div>

        {/* Recent Visits */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Recent Store Visits</h2>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : visits.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No visits yet. Start your first store visit!
              </div>
            ) : (
              <div className="space-y-3">
                {visits.slice(0, 5).map((visit: any) => (
                  <div 
                    key={visit.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-surface-secondary cursor-pointer"
                    onClick={() => navigate(`/trade-marketing/visits/${visit.id}`)}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{visit.store_name}</div>
                      <div className="text-sm text-gray-600">
                        {visit.visit_code} • {new Date(visit.check_in_time).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="ml-4">
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        visit.visit_status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {visit.visit_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradeMarketingAgentPage;
