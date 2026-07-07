import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { api } from '../api';
import PortalImage from './PortalImage';

interface StoreRow {
  id: string | number;
  store_name?: string;
  visit_date?: string;
  created_at?: string;
  photo_id?: string | number | null;
  share_of_wall?: number | null;
}

const PAGE_SIZE = 25;

export default function StoresTable() {
  const [rows, setRows] = useState<StoreRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get('/portal/stores', { params: { limit: PAGE_SIZE, offset } })
      .then((res) => {
        if (!cancelled) setRows(res.data?.data || []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load stores');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [offset]);

  return (
    <div>
      {loading && (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}
      {error && <p className="py-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!loading && !error && rows.length === 0 && (
        <p className="py-6 text-sm text-slate-500 dark:text-slate-400">No stores yet.</p>
      )}
      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="pb-2 pr-4">Photo</th>
                <th className="pb-2 pr-4">Store</th>
                <th className="pb-2 pr-4">Share of Wall</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-night-50">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-2 pr-4">
                    <PortalImage photoId={row.photo_id} alt={row.store_name || 'Store'} />
                  </td>
                  <td className="py-2 pr-4 font-medium text-slate-900 dark:text-white">{row.store_name || '—'}</td>
                  <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                    {row.share_of_wall != null ? `${row.share_of_wall}%` : '—'}
                  </td>
                  <td className="py-2 text-slate-500 dark:text-slate-400">
                    {(row.visit_date || row.created_at || '').slice(0, 10) || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          disabled={offset === 0 || loading}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 disabled:opacity-40 dark:border-night-50 dark:text-slate-300"
        >
          <ChevronLeft className="h-3 w-3" /> Prev
        </button>
        <button
          onClick={() => setOffset((o) => o + PAGE_SIZE)}
          disabled={rows.length < PAGE_SIZE || loading}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 disabled:opacity-40 dark:border-night-50 dark:text-slate-300"
        >
          Next <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
