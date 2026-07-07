import { useEffect, useState } from 'react';
import { Lightbulb, Loader2 } from 'lucide-react';
import { api } from '../api';

interface InsightRow {
  visit_id: string | number;
  store_name?: string;
  share_of_wall?: number | null;
  insights?: unknown;
}

// The AI-parsed `insights` field's exact shape can vary (array of strings is
// the normal case, but stay defensive against objects/nulls from older data).
function extractObservations(insights: unknown): string[] {
  if (Array.isArray(insights)) {
    return insights.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
  }
  if (insights && typeof insights === 'object') {
    const maybeList = (insights as any).insights ?? (insights as any).observations;
    if (Array.isArray(maybeList)) {
      return maybeList.filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0);
    }
  }
  return [];
}

export default function InsightsWidget() {
  const [rows, setRows] = useState<InsightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/portal/insights')
      .then((res) => {
        if (!cancelled) setRows(res.data?.data || []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load insights');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-slate-500 dark:text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (error) return <p className="py-4 text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (rows.length === 0) {
    return <p className="py-6 text-sm text-slate-500 dark:text-slate-400">No insights yet.</p>;
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const observations = extractObservations(row.insights);
        return (
          <div key={row.visit_id} className="rounded-xl bg-slate-50 p-4 dark:bg-night-200">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-medium text-slate-900 dark:text-white">{row.store_name || 'Store'}</h3>
              {row.share_of_wall != null && (
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {row.share_of_wall}% share of wall
                </span>
              )}
            </div>
            {observations.length > 0 ? (
              <ul className="space-y-1">
                {observations.map((obs, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-500" />
                    <span>{obs}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500">No observations recorded.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
