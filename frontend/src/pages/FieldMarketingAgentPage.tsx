import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fieldMarketingService } from '../services/fieldMarketing.service';

const FieldMarketingAgentPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [visits, setVisits] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any>({ totals: { pending: 0, approved: 0, paid: 0 } });
  const [stats, setStats] = useState({
    todayVisits: 0,
    weekVisits: 0,
    monthCommission: 0,
    boardsPlaced: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [visitsRes, commissionsRes] = await Promise.all([
        fieldMarketingService.getVisits({ startDate: today }),
        fieldMarketingService.getCommissions()
      ]);
      
      setVisits(visitsRes.visits || []);
      setCommissions(commissionsRes);
      
      setStats({
        todayVisits: visitsRes.visits?.filter((v: any) => v.visit_status === 'completed').length || 0,
        weekVisits: visitsRes.visits?.length || 0,
        monthCommission: commissionsRes.totals?.approved || 0,
        boardsPlaced: 0
      });
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const startNewVisit = () => {
    navigate('/field-marketing/customer-selection');
  };

  return (
    <div className="min-h-screen bg-surface-secondary p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Field Marketing Agent</h1>
          <p className="text-gray-600">GPS Validation • Board Placement • Product Distribution</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-gray-600 text-sm">Today's Visits</div>
            <div className="text-2xl font-bold text-blue-600">{stats.todayVisits}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-gray-600 text-sm">This Week</div>
            <div className="text-2xl font-bold text-green-600">{stats.weekVisits}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-gray-600 text-sm">Commission (Approved)</div>
            <div className="text-2xl font-bold text-purple-600">${commissions.totals?.approved || 0}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-gray-600 text-sm">Boards Placed</div>
            <div className="text-2xl font-bold text-orange-600">{stats.boardsPlaced}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <button
            onClick={startNewVisit}
            className="bg-blue-600 text-white p-6 rounded-lg shadow-lg hover:bg-blue-700 transition"
          >
            <div className="text-lg font-bold mb-2">🎯 Start New Visit</div>
            <div className="text-sm opacity-90">GPS validation & customer selection</div>
          </button>
          
          <button
            onClick={() => navigate('/field-marketing/visits')}
            className="bg-green-600 text-white p-6 rounded-lg shadow-lg hover:bg-green-700 transition"
          >
            <div className="text-lg font-bold mb-2">📋 My Visits</div>
            <div className="text-sm opacity-90">View visit history & details</div>
          </button>
          
          <button
            onClick={() => navigate('/field-marketing/commissions')}
            className="bg-purple-600 text-white p-6 rounded-lg shadow-lg hover:bg-purple-700 transition"
          >
            <div className="text-lg font-bold mb-2">💰 Commissions</div>
            <div className="text-sm opacity-90">Track your earnings</div>
          </button>
        </div>

        {/* Recent Visits */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Recent Visits</h2>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : visits.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No visits yet. Start your first visit!
              </div>
            ) : (
              <div className="space-y-3">
                {visits.slice(0, 5).map((visit: any) => (
                  <div 
                    key={visit.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-surface-secondary cursor-pointer"
                    onClick={() => navigate(`/field-marketing/visits/${visit.id}`)}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{visit.customer_name}</div>
                      <div className="text-sm text-gray-600">
                        {visit.visit_code} • {new Date(visit.start_time).toLocaleDateString()}
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

        {/* Commission Summary */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Commission Summary</h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  ${commissions.totals?.pending || 0}
                </div>
                <div className="text-sm text-gray-600">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  ${commissions.totals?.approved || 0}
                </div>
                <div className="text-sm text-gray-600">Approved</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  ${commissions.totals?.paid || 0}
                </div>
                <div className="text-sm text-gray-600">Paid</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FieldMarketingAgentPage;
