import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Calendar, Filter, BarChart3, 
  TrendingUp, Package, Users, Truck, DollarSign, 
  FileSpreadsheet, Building2, ClipboardList, RefreshCw
} from 'lucide-react';
import { apiService } from '../../services/api.service';

interface Report {
  id: string;
  name: string;
  category: string;
  description: string;
}

interface ReportData {
  success: boolean;
  data: any;
}

const categoryIcons: Record<string, React.ReactNode> = {
  'Sales': <TrendingUp className="w-5 h-5" />,
  'Inventory': <Package className="w-5 h-5" />,
  'Field Operations': <Users className="w-5 h-5" />,
  'Finance': <DollarSign className="w-5 h-5" />,
  'Van Sales': <Truck className="w-5 h-5" />,
  'Statutory': <Building2 className="w-5 h-5" />,
};

const categoryColors: Record<string, string> = {
  'Sales': 'bg-blue-100 text-blue-700 border-blue-200',
  'Inventory': 'bg-green-100 text-green-700 border-green-200',
  'Field Operations': 'bg-purple-100 text-purple-700 border-purple-200',
  'Finance': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Van Sales': 'bg-orange-100 text-orange-700 border-orange-200',
  'Statutory': 'bg-red-100 text-red-700 border-red-200',
};

const ReportsHub: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingReports, setLoadingReports] = useState(true);
  const [filters, setFilters] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    customer_id: '',
    product_id: '',
    agent_id: '',
    warehouse_id: '',
    status: '',
  });
  const [activeCategory, setActiveCategory] = useState<string>('All');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await apiService.get('/reports');
      if (response.data?.success) {
        setReports(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoadingReports(false);
    }
  };

  const generateReport = async (format: string = 'json') => {
    if (!selectedReport) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      params.append('format', format);
      
      const url = `/reports/${selectedReport.id}?${params.toString()}`;
      
      if (format === 'json') {
        const response = await apiService.get(url);
        if (response.data?.success) {
          setReportData(response.data.data);
        }
      } else {
        const token = localStorage.getItem('token');
        const baseUrl = import.meta.env.VITE_API_URL || 'https://fieldvibe-api.reshigan-085.workers.dev/api';
        const fullUrl = `${baseUrl}${url}`;
        
        const response = await fetch(fullUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `${selectedReport.id}-${Date.now()}.${format === 'html' ? 'html' : format}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(downloadUrl);
        }
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['All', ...Array.from(new Set(reports.map(r => r.category)))];
  const filteredReports = activeCategory === 'All' 
    ? reports 
    : reports.filter(r => r.category === activeCategory);

  const renderSummaryCards = () => {
    if (!reportData) return null;
    
    if (reportData.summary) {
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Object.entries(reportData.summary).map(([key, value]) => (
            <div key={key} className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
              <div className="text-sm text-gray-600 capitalize">{key.replace(/_/g, ' ')}</div>
              <div className="text-2xl font-bold text-blue-700">
                {typeof value === 'number' ? value.toLocaleString() : String(value)}
              </div>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderDataTable = () => {
    if (!reportData) return null;
    
    const dataArray = Array.isArray(reportData) ? reportData : 
                      reportData.daily_sales || reportData.details || 
                      (Array.isArray(reportData.data) ? reportData.data : []);
    
    if (!dataArray || dataArray.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No data available for the selected filters</p>
        </div>
      );
    }
    
    const columns = Object.keys(dataArray[0] || {});
    
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-4 py-3 text-left text-sm font-semibold text-gray-700 capitalize">
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataArray.map((row: any, i: number) => (
              <tr key={i} className="border-t hover:bg-surface-secondary">
                {columns.map((col) => (
                  <td key={col} className="px-4 py-3 text-sm">
                    {typeof row[col] === 'number' 
                      ? row[col].toLocaleString() 
                      : row[col] ?? '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            Reports Hub
          </h1>
          <p className="text-gray-600 mt-1">Generate comprehensive reports with filters and export options</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-lg p-4 sticky top-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              Available Reports
            </h2>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    activeCategory === cat 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            
            {loadingReports ? (
              <div className="text-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600" />
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredReports.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => { setSelectedReport(report); setReportData(null); }}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedReport?.id === report.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-100 hover:border-blue-300 hover:bg-surface-secondary'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`p-1.5 rounded ${categoryColors[report.category] || 'bg-gray-100'}`}>
                        {categoryIcons[report.category] || <FileText className="w-4 h-4" />}
                      </span>
                      <div>
                        <div className="font-medium text-sm">{report.name}</div>
                        <div className="text-xs text-gray-500">{report.category}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3">
          {selectedReport ? (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold">{selectedReport.name}</h2>
                    <p className="text-gray-600 text-sm">{selectedReport.description}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm ${categoryColors[selectedReport.category]}`}>
                    {selectedReport.category}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={filters.start_date}
                      onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      End Date
                    </label>
                    <input
                      type="date"
                      value={filters.end_date}
                      onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Filter className="w-4 h-4 inline mr-1" />
                      Status
                    </label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="pending">Pending</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => generateReport('json')}
                      disabled={loading}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <BarChart3 className="w-4 h-4" />
                      )}
                      Generate
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 border-t pt-4">
                  <span className="text-sm text-gray-600 mr-2">Export:</span>
                  <button
                    onClick={() => generateReport('csv')}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2 text-sm"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    CSV
                  </button>
                  <button
                    onClick={() => generateReport('html')}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 flex items-center gap-2 text-sm"
                  >
                    <FileText className="w-4 h-4" />
                    PDF/Print
                  </button>
                </div>
              </div>

              {reportData && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Report Results</h3>
                  {renderSummaryCards()}
                  {renderDataTable()}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-lg p-12 text-center">
              <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Select a Report</h3>
              <p className="text-gray-500">Choose a report from the list on the left to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsHub;
