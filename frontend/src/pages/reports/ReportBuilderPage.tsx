import React, { useState } from 'react';
import { BarChart3, Download, Calendar, Filter } from 'lucide-react';
import SearchableSelect from '../../components/ui/SearchableSelect'
import { apiClient } from '../../services/api.service'

const ReportBuilderPage: React.FC = () => {
  const [config, setConfig] = useState({ type: 'sales', dateFrom: '', dateTo: '', groupBy: 'day', filters: {} });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiClient.defaults.baseURL}/reports/generate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) setData(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const exportReport = async (format: string) => {
    try {
      const res = await fetch(`${apiClient.defaults.baseURL}/reports/export?format=${format}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, data })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${Date.now()}.${format}`;
        a.click();
      }
    } catch (err) { console.error(err); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2"><BarChart3 className="w-8 h-8 text-blue-600" /> Report Builder</h1>

      <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">Report Configuration</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SearchableSelect
            options={[
              { value: 'sales', label: 'Sales Report' },
              { value: 'commission', label: 'Commission Report' },
              { value: 'visits', label: 'Visits Report' },
              { value: 'inventory', label: 'Inventory Report' },
              { value: 'performance', label: 'Performance Report' },
            ]}
            value={config.type}
            placeholder="Sales Report"
          />
          <input type="date" value={config.dateFrom} onChange={e => setConfig({...config, dateFrom: e.target.value})} className="px-4 py-2 border rounded" placeholder="From Date" />
          <input type="date" value={config.dateTo} onChange={e => setConfig({...config, dateTo: e.target.value})} className="px-4 py-2 border rounded" placeholder="To Date" />
          <SearchableSelect
            options={[
              { value: 'day', label: 'Daily' },
              { value: 'week', label: 'Weekly' },
              { value: 'month', label: 'Monthly' },
              { value: 'quarter', label: 'Quarterly' },
            ]}
            value={config.groupBy}
            placeholder="Daily"
          />
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={generateReport} disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
          {data && (
            <>
              <button onClick={() => exportReport('xlsx')} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
                <Download className="w-4 h-4" /> Excel
              </button>
              <button onClick={() => exportReport('pdf')} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2">
                <Download className="w-4 h-4" /> PDF
              </button>
              <button onClick={() => exportReport('csv')} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
                <Download className="w-4 h-4" /> CSV
              </button>
            </>
          )}
        </div>
      </div>

      {data && (
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Report Results</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-gray-600">Total Records</div>
              <div className="text-2xl font-bold text-blue-600">{data.totalRecords || 0}</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-gray-600">Total Value</div>
              <div className="text-2xl font-bold text-green-600">₹{data.totalValue?.toLocaleString() || 0}</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-sm text-gray-600">Average</div>
              <div className="text-2xl font-bold text-purple-600">₹{data.average?.toLocaleString() || 0}</div>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="text-sm text-gray-600">Growth</div>
              <div className="text-2xl font-bold text-orange-600">{data.growth || 0}%</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  {data.headers?.map((h: string, i: number) => <th key={i} className="px-4 py-3 text-left">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.rows?.map((row: any[], i: number) => (
                  <tr key={i} className="border-t hover:bg-surface-secondary">
                    {row.map((cell, j) => <td key={j} className="px-4 py-3">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportBuilderPage;
