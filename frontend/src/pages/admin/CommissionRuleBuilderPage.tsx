import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calculator } from 'lucide-react';
import { apiClient } from '../../services/api.service';
import toast from 'react-hot-toast';

interface Rule { id: number; name: string; boardType: string; minQty: number; maxQty: number; rate: number; bonusRate: number; }

const CommissionRuleBuilderPage: React.FC = () => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [form, setForm] = useState<Partial<Rule>>({});

  useEffect(() => { loadRules(); }, []);

  const loadRules = async () => {
    try {
      const res = await apiClient.get('/admin/commission-rules');
      setRules(res.data?.rules || []);
    } catch (err) { console.error(err); }
  };

  const saveRule = async () => {
    try {
      await apiClient.post('/admin/commission-rules', form);
      toast.success('Rule saved');
      loadRules(); setForm({});
    } catch (err) { toast.error('Failed to save rule'); }
  };

  const deleteRule = async (id: number) => {
    if (!window.confirm('Delete rule?')) return;
    try {
      await apiClient.delete(`/admin/commission-rules/${id}`);
      toast.success('Rule deleted');
      loadRules();
    } catch (err) { toast.error('Failed to delete rule'); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Calculator className="w-8 h-8 text-green-600" /> Commission Rule Builder</h1>
        <p className="text-gray-600 mt-2">Define commission rates based on board types and quantities</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">Create New Rule</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <input placeholder="Rule Name" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} className="px-4 py-2 border rounded" />
          <select value={form.boardType || ''} onChange={e => setForm({...form, boardType: e.target.value})} className="px-4 py-2 border rounded">
            <option value="">Board Type</option>
            <option value="billboard">Billboard</option>
            <option value="standee">Standee</option>
            <option value="banner">Banner</option>
            <option value="all">All Types</option>
          </select>
          <input type="number" placeholder="Min Quantity" value={form.minQty || ''} onChange={e => setForm({...form, minQty: +e.target.value})} className="px-4 py-2 border rounded" />
          <input type="number" placeholder="Max Quantity" value={form.maxQty || ''} onChange={e => setForm({...form, maxQty: +e.target.value})} className="px-4 py-2 border rounded" />
          <input type="number" placeholder="Base Rate (₹)" value={form.rate || ''} onChange={e => setForm({...form, rate: +e.target.value})} className="px-4 py-2 border rounded" />
          <input type="number" placeholder="Bonus Rate (%)" value={form.bonusRate || ''} onChange={e => setForm({...form, bonusRate: +e.target.value})} className="px-4 py-2 border rounded" />
        </div>
        <button onClick={saveRule} className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Rule
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-surface-secondary border-b">
          <h2 className="text-lg font-semibold">Active Rules</h2>
        </div>
        <div className="divide-y">
          {rules.map(r => (
            <div key={r.id} className="px-6 py-4 hover:bg-surface-secondary">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{r.name}</h3>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <div>Board Type: <span className="font-medium text-gray-900">{r.boardType}</span></div>
                    <div>Quantity Range: <span className="font-medium text-gray-900">{r.minQty} - {r.maxQty}</span></div>
                    <div>Commission: <span className="font-medium text-green-600">₹{r.rate}</span> + <span className="font-medium text-blue-600">{r.bonusRate}% bonus</span></div>
                  </div>
                </div>
                <button onClick={() => deleteRule(r.id)} className="px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 flex items-center gap-1">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CommissionRuleBuilderPage;
