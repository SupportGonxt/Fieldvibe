import { useState } from 'react';
import { Loader2, Send, Sparkles } from 'lucide-react';
import { api } from '../api';

type AskData = Record<string, unknown> | null;

interface AskResponse {
  answer: string;
  intent: string | null;
  data: AskData;
}

function DataPreview({ data }: { data: AskData }) {
  if (data === null) return null;
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  // trend_over_time comes back as { trend: [{ day, n }, ...] } — render as a small table.
  const trend = data.trend;
  if (Array.isArray(trend)) {
    return (
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <th className="pb-1 pr-4">Day</th>
              <th className="pb-1">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-night-50">
            {(trend as Array<{ day: string; n: number }>).map((row) => (
              <tr key={row.day}>
                <td className="py-1 pr-4 text-slate-600 dark:text-slate-300">{row.day}</td>
                <td className="py-1 text-slate-900 dark:text-white">{row.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Everything else is a single scalar aggregate — show it as a KPI-style number.
  return (
    <div className="mt-3 flex flex-wrap gap-4">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-xl bg-slate-50 px-4 py-2 dark:bg-night-200">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {key.replace(/_/g, ' ')}
          </p>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {value === null || value === undefined ? '—' : String(value)}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function AskPanel() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskResponse | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/portal/ask', { question });
      setResult(res.data?.data ?? null);
    } catch {
      setError('Could not get an answer right now.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-6 rounded-2xl bg-white p-6 shadow-card dark:bg-night-100">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
        <Sparkles className="h-4 w-4 text-primary-600" /> Ask a question
      </h2>
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. How many sign ups do we have?"
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none dark:border-night-50 dark:bg-night-200 dark:text-white"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Ask
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {result && (
        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-night-50">
          <p className="text-sm text-slate-900 dark:text-white">{result.answer}</p>
          <DataPreview data={result.data} />
        </div>
      )}
    </section>
  );
}
