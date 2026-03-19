import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import SearchableSelect from '../../components/ui/SearchableSelect'
import { apiClient } from '../../services/api.service'

interface Board { id: number; name: string; type: string; width: number; height: number; commissionRate: number; installCost: number; }

const BoardManagementPage: React.FC = () => {
  const [boards, setBoards] = useState<Board[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Board>>({});

  useEffect(() => { loadBoards(); }, []);

  const loadBoards = async () => {
    try {
      const res = await apiClient.get('/admin/boards');
      setBoards(res.data.boards || []);
    } catch (err) { console.error(err); }
  };

  const saveBoard = async () => {
    try {
      if (editing) {
        await apiClient.put(`/admin/boards/${editing}`, form);
      } else {
        await apiClient.post('/admin/boards', form);
      }
      loadBoards(); setEditing(null); setForm({});
    } catch (err) { console.error(err); }
  };

  const deleteBoard = async (id: number) => {
    if (!window.confirm('Delete this board?')) return;
    try {
      const res = await apiClient.delete(`/admin/boards/${id}`);
      loadBoards();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Board Management</h1>
        <button onClick={() => { setEditing(0); setForm({}); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Board
        </button>
      </div>

      {editing !== null && (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">{editing ? 'Edit Board' : 'New Board'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Board Name" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} className="px-4 py-2 border rounded" />
            <SearchableSelect
              options={[
                { value: '', label: 'Select Type' },
                { value: 'billboard', label: 'Billboard' },
                { value: 'standee', label: 'Standee' },
                { value: 'banner', label: 'Banner' },
              ]}
              value={form.type || '' || null}
              placeholder="Select Type"
            />
            <input type="number" placeholder="Width (cm)" value={form.width || ''} onChange={e => setForm({...form, width: +e.target.value})} className="px-4 py-2 border rounded" />
            <input type="number" placeholder="Height (cm)" value={form.height || ''} onChange={e => setForm({...form, height: +e.target.value})} className="px-4 py-2 border rounded" />
            <input type="number" placeholder="Commission (₹)" value={form.commissionRate || ''} onChange={e => setForm({...form, commissionRate: +e.target.value})} className="px-4 py-2 border rounded" />
            <input type="number" placeholder="Install Cost (₹)" value={form.installCost || ''} onChange={e => setForm({...form, installCost: +e.target.value})} className="px-4 py-2 border rounded" />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={saveBoard} className="px-4 py-2 bg-green-600 text-white rounded flex items-center gap-2"><Save className="w-4 h-4" /> Save</button>
            <button onClick={() => { setEditing(null); setForm({}); }} className="px-4 py-2 bg-gray-300 rounded flex items-center gap-2"><X className="w-4 h-4" /> Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Size</th>
              <th className="px-4 py-3 text-left">Commission</th>
              <th className="px-4 py-3 text-left">Install Cost</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {boards.map(b => (
              <tr key={b.id} className="border-t hover:bg-surface-secondary">
                <td className="px-4 py-3 font-medium">{b.name}</td>
                <td className="px-4 py-3">{b.type}</td>
                <td className="px-4 py-3">{b.width} x {b.height} cm</td>
                <td className="px-4 py-3">₹{b.commissionRate}</td>
                <td className="px-4 py-3">₹{b.installCost}</td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => { setEditing(b.id); setForm(b); }} className="text-blue-600 hover:text-blue-800"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => deleteBoard(b.id)} className="text-red-600 hover:text-red-800"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BoardManagementPage;
