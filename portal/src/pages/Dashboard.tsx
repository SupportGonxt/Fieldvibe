import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Loader2, LayoutDashboard } from 'lucide-react';
import { api, clearToken } from '../api';
import KpiWidget, { Kpis } from '../components/KpiWidget';
import IndividualsTable from '../components/IndividualsTable';
import StoresTable from '../components/StoresTable';
import InsightsWidget from '../components/InsightsWidget';
import AskPanel from '../components/AskPanel';

interface Widget {
  type: string;
  title: string;
  source?: string;
  options?: { hidden?: boolean; [key: string]: unknown };
}

function renderWidget(widget: Widget, kpis: Kpis | null) {
  switch (widget.type) {
    case 'kpi':
      return <KpiWidget kpis={kpis} />;
    case 'individuals_table':
      return <IndividualsTable />;
    case 'stores_table':
      return <StoresTable />;
    case 'insights':
      return <InsightsWidget />;
    default:
      return null;
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/portal/overview')
      .then((res) => {
        if (cancelled) return;
        setWidgets(res.data?.data?.widgets || []);
        setKpis(res.data?.data?.kpis ?? null);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your dashboard');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function onLogout() {
    clearToken();
    navigate('/login');
  }

  const visibleWidgets = widgets.filter((w) => w.options?.hidden !== true);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary-600" />
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Your Dashboard</h1>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-night-50 dark:text-slate-300 dark:hover:bg-night-100"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </header>

      {loading && (
        <div className="flex items-center gap-2 py-12 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your dashboard…
        </div>
      )}
      {error && <p className="py-8 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="space-y-6">
          <AskPanel />
          {visibleWidgets.map((widget, i) => {
            const content = renderWidget(widget, kpis);
            if (content === null) return null;
            return (
              <section key={i} className="rounded-2xl bg-white p-6 shadow-card dark:bg-night-100">
                <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">{widget.title}</h2>
                {content}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
