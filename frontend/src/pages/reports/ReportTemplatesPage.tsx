import React, { useState } from 'react';
import { FileText, Play, Star } from 'lucide-react';
import { apiClient } from '../../services/api.service'

interface Template { id: number; name: string; description: string; category: string; popular: boolean; }

const ReportTemplatesPage: React.FC = () => {
  const [templates] = useState<Template[]>([
    { id: 1, name: 'Daily Sales Summary', description: 'Total sales, orders, and revenue by day', category: 'Sales', popular: true },
    { id: 2, name: 'Agent Performance', description: 'Visits, placements, and commissions by agent', category: 'Performance', popular: true },
    { id: 3, name: 'Commission Payout Report', description: 'Detailed commission breakdown for payroll', category: 'Finance', popular: true },
    { id: 4, name: 'Board Placement Tracking', description: 'All board placements with GPS and photos', category: 'Field Marketing', popular: false },
    { id: 5, name: 'Shelf Analytics Report', description: 'Brand share and SKU availability metrics', category: 'Trade Marketing', popular: false },
    { id: 6, name: 'Customer Visit History', description: 'Complete visit logs with timestamps', category: 'Operations', popular: false },
    { id: 7, name: 'Inventory Stock Report', description: 'Current stock levels and reorder points', category: 'Inventory', popular: false },
    { id: 8, name: 'Territory Coverage Map', description: 'Geographic coverage and agent assignments', category: 'Territory', popular: false },
  ]);

  const runTemplate = async (templateId: number) => {
    try {
      const res = await apiClient.post(`/reports/templates/${templateId}/run`, {}, { responseType: 'blob' });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${templateId}-${Date.now()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) { console.error(err); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2"><FileText className="w-8 h-8 text-purple-600" /> Report Templates</h1>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Popular Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.filter(t => t.popular).map(t => (
            <div key={t.id} className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
              <div className="flex justify-between items-start mb-3">
                <Star className="w-5 h-5 text-yellow-500 fill-current" />
                <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">{t.category}</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">{t.name}</h3>
              <p className="text-sm text-gray-600 mb-4">{t.description}</p>
              <button onClick={() => runTemplate(t.id)} className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2">
                <Play className="w-4 h-4" /> Run Report
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">All Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.filter(t => !t.popular).map(t => (
            <div key={t.id} className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
              <div className="flex justify-between items-start mb-3">
                <FileText className="w-5 h-5 text-gray-400" />
                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">{t.category}</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">{t.name}</h3>
              <p className="text-sm text-gray-600 mb-4">{t.description}</p>
              <button onClick={() => runTemplate(t.id)} className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2">
                <Play className="w-4 h-4" /> Run Report
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReportTemplatesPage;
