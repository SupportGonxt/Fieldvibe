import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Package } from 'lucide-react';
import SearchableSelect from '../../components/ui/SearchableSelect'
import { apiClient } from '../../services/api.service'

interface Material { id: number; name: string; type: string; brand: string; stockQty: number; cost: number; supplier: string; }

const POSLibraryPage: React.FC = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Material>>({});

  useEffect(() => { loadMaterials(); }, []);

  const loadMaterials = async () => {
    try {
      const res = await apiClient.get('/admin/pos-library');
      setMaterials(res.data.materials || []);
    } catch (err) { console.error(err); }
  };

  const saveMaterial = async () => {
    try {
      if (editing) {
        await apiClient.put(`/admin/pos-library/${editing}`, form);
      } else {
        await apiClient.post('/admin/pos-library', form);
      }
      loadMaterials(); setEditing(null); setForm({});
    } catch (err) { console.error(err); }
  };

  const deleteMaterial = async (id: number) => {
    if (!window.confirm('Delete material?')) return;
    try {
      const res = await apiClient.delete(`/admin/pos-library/${id}`);
      loadMaterials();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Package className="w-8 h-8 text-indigo-600" /> POS Material Library</h1>
        <button onClick={() => { setEditing(0); setForm({}); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Material
        </button>
      </div>

      {editing !== null && (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">{editing ? 'Edit Material' : 'New Material'}</h2>
          <div className="grid grid-cols-3 gap-4">
            <input placeholder="Material Name" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} className="px-4 py-2 border rounded" />
            <SearchableSelect
              options={[
                { value: '', label: 'Type' },
                { value: 'Standee', label: 'Standee' },
                { value: 'Banner', label: 'Banner' },
                { value: 'Decal', label: 'Decal' },
                { value: 'Display', label: 'Display' },
                { value: 'Wobbler', label: 'Wobbler' },
              ]}
              value={form.type || '' || null}
              placeholder="Type"
            />
            <input placeholder="Brand" value={form.brand || ''} onChange={e => setForm({...form, brand: e.target.value})} className="px-4 py-2 border rounded" />
            <input type="number" placeholder="Stock Qty" value={form.stockQty || ''} onChange={e => setForm({...form, stockQty: +e.target.value})} className="px-4 py-2 border rounded" />
            <input type="number" placeholder="Cost (₹)" value={form.cost || ''} onChange={e => setForm({...form, cost: +e.target.value})} className="px-4 py-2 border rounded" />
            <input placeholder="Supplier" value={form.supplier || ''} onChange={e => setForm({...form, supplier: e.target.value})} className="px-4 py-2 border rounded" />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={saveMaterial} className="px-4 py-2 bg-green-600 text-white rounded">Save</button>
            <button onClick={() => { setEditing(null); setForm({}); }} className="px-4 py-2 bg-gray-300 rounded">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Brand</th>
              <th className="px-4 py-3 text-left">Stock</th>
              <th className="px-4 py-3 text-left">Cost</th>
              <th className="px-4 py-3 text-left">Supplier</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {materials.map(m => (
              <tr key={m.id} className="border-t hover:bg-surface-secondary">
                <td className="px-4 py-3 font-medium">{m.name}</td>
                <td className="px-4 py-3">{m.type}</td>
                <td className="px-4 py-3">{m.brand}</td>
                <td className="px-4 py-3"><span className={m.stockQty < 20 ? 'text-red-600 font-semibold' : ''}>{m.stockQty}</span></td>
                <td className="px-4 py-3">₹{m.cost}</td>
                <td className="px-4 py-3">{m.supplier}</td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => { setEditing(m.id); setForm(m); }} className="text-blue-600 hover:text-blue-800"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => deleteMaterial(m.id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default POSLibraryPage;
