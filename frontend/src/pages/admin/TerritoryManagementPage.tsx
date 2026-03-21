import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, MapPin } from 'lucide-react';
import { apiClient } from '../../services/api.service'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

interface Territory { id: number; name: string; region: string; agents: number; area: string; coordinates: string; }

const TerritoryManagementPage: React.FC = () => {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ title: string; message: string; action: () => void }>({ title: '', message: '', action: () => {} })
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Territory>>({});

  useEffect(() => { loadTerritories(); }, []);

  const loadTerritories = async () => {
    try {
      const res = await apiClient.get('/admin/territories');
      setTerritories(res.data.territories || []);
    } catch (err) { console.error(err); }
  };

  const saveTerritory = async () => {
    try {
      if (editing) {
        await apiClient.put(`/admin/territories/${editing}`, form);
      } else {
        await apiClient.post('/admin/territories', form);
      }
      loadTerritories(); setEditing(null); setForm({});
    } catch (err) { console.error(err); }
  };

  const deleteTerritory = async (id: number) => {
    setPendingAction({ title: 'Confirm', message: 'Delete territory?', action: async () => {
    try {
      const res = await apiClient.delete(`/admin/territories/${id}`);
      loadTerritories();
    } catch (err) { console.error(err); }
    } })
    setConfirmOpen(true)
    return
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2"><MapPin className="w-8 h-8 text-red-600" /> Territory Management</h1>
        <button onClick={() => { setEditing(0); setForm({}); }} className="px-4 py-2 bg-red-600 text-white rounded-lg flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Territory
        </button>
      </div>

      {editing !== null && (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">{editing ? 'Edit Territory' : 'New Territory'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Territory Name" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} className="px-4 py-2 border rounded" />
            <input placeholder="Region" value={form.region || ''} onChange={e => setForm({...form, region: e.target.value})} className="px-4 py-2 border rounded" />
            <input placeholder="Area (sq km)" value={form.area || ''} onChange={e => setForm({...form, area: e.target.value})} className="px-4 py-2 border rounded" />
            <input type="number" placeholder="Assigned Agents" value={form.agents || ''} onChange={e => setForm({...form, agents: +e.target.value})} className="px-4 py-2 border rounded" />
            <textarea placeholder="GPS Coordinates (lat,lng;lat,lng...)" value={form.coordinates || ''} onChange={e => setForm({...form, coordinates: e.target.value})} className="px-4 py-2 border rounded col-span-2" rows={3} />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={saveTerritory} className="px-4 py-2 bg-green-600 text-white rounded">Save</button>
            <button onClick={() => { setEditing(null); setForm({}); }} className="px-4 py-2 bg-gray-300 rounded">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {territories.map(t => (
          <div key={t.id} className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">{t.name}</h3>
                <p className="text-sm text-gray-600">{t.region}</p>
              </div>
              <MapPin className="w-6 h-6 text-red-600" />
            </div>
            <div className="space-y-2 text-sm mb-4">
              <div><span className="text-gray-600">Area:</span> <span className="font-medium">{t.area} sq km</span></div>
              <div><span className="text-gray-600">Agents:</span> <span className="font-medium">{t.agents}</span></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditing(t.id); setForm(t); }} className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 text-sm"><Edit2 className="w-4 h-4 inline mr-1" /> Edit</button>
              <button onClick={() => deleteTerritory(t.id)} className="px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => { pendingAction.action(); setConfirmOpen(false); }}
        title={pendingAction.title}
        message={pendingAction.message}
        confirmLabel="Confirm"
        variant="danger"
      />
    </div>
  );
};

export default TerritoryManagementPage;
