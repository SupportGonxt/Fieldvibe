import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Calendar } from 'lucide-react';
import SearchableSelect from '../../components/ui/SearchableSelect'
import { apiClient } from '../../services/api.service'

interface Campaign { id: number; name: string; startDate: string; endDate: string; budget: number; status: string; target: number; }

const CampaignManagementPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Campaign>>({ status: 'planned' });

  useEffect(() => { loadCampaigns(); }, []);

  const loadCampaigns = async () => {
    try {
      const res = await apiClient.get('/admin/campaigns');
      setCampaigns(res.data.campaigns || []);
    } catch (err) { console.error(err); }
  };

  const saveCampaign = async () => {
    try {
      if (editing) {
        await apiClient.put(`/admin/campaigns/${editing}`, form);
      } else {
        await apiClient.post('/admin/campaigns', form);
      }
      loadCampaigns(); setEditing(null); setForm({ status: 'planned' });
    } catch (err) { console.error(err); }
  };

  const deleteCampaign = async (id: number) => {
    if (!window.confirm('Delete campaign?')) return;
    try {
      const res = await apiClient.delete(`/admin/campaigns/${id}`);
      loadCampaigns();
    } catch (err) { console.error(err); }
  };

  const getStatusColor = (status: string) => {
    const colors = { planned: 'bg-blue-100 text-blue-800', active: 'bg-green-100 text-green-800', completed: 'bg-gray-100 text-gray-800', cancelled: 'bg-red-100 text-red-800' };
    return colors[status as keyof typeof colors] || 'bg-gray-100';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Campaign Management</h1>
        <button onClick={() => { setEditing(0); setForm({ status: 'planned' }); }} className="px-4 py-2 bg-purple-600 text-white rounded-lg flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      {editing !== null && (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">{editing ? 'Edit Campaign' : 'New Campaign'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Campaign Name" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} className="px-4 py-2 border rounded col-span-2" />
            <input type="date" placeholder="Start Date" value={form.startDate || ''} onChange={e => setForm({...form, startDate: e.target.value})} className="px-4 py-2 border rounded" />
            <input type="date" placeholder="End Date" value={form.endDate || ''} onChange={e => setForm({...form, endDate: e.target.value})} className="px-4 py-2 border rounded" />
            <input type="number" placeholder="Budget (₹)" value={form.budget || ''} onChange={e => setForm({...form, budget: +e.target.value})} className="px-4 py-2 border rounded" />
            <input type="number" placeholder="Target (units)" value={form.target || ''} onChange={e => setForm({...form, target: +e.target.value})} className="px-4 py-2 border rounded" />
            <SearchableSelect
              options={[
                { value: 'planned', label: 'Planned' },
                { value: 'active', label: 'Active' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              value={form.status}
              placeholder="Planned"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={saveCampaign} className="px-4 py-2 bg-green-600 text-white rounded">Save</button>
            <button onClick={() => { setEditing(null); setForm({ status: 'planned' }); }} className="px-4 py-2 bg-gray-300 rounded">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaigns.map(c => (
          <div key={c.id} className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">{c.name}</h3>
              <span className={`px-2 py-1 text-xs rounded ${getStatusColor(c.status)}`}>{c.status}</span>
            </div>
            <div className="space-y-2 text-sm text-gray-600 mb-4">
              <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {c.startDate} to {c.endDate}</div>
              <div>Budget: ₹{c.budget?.toLocaleString()}</div>
              <div>Target: {c.target} units</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditing(c.id); setForm(c); }} className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"><Edit2 className="w-4 h-4 inline" /></button>
              <button onClick={() => deleteCampaign(c.id)} className="px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CampaignManagementPage;
