import { Users, Store, CheckCircle2, PieChart } from 'lucide-react';

export interface Kpis {
  total_individuals: number;
  total_stores: number;
  qualification_rate: number;
  avg_share_of_wall: number | null;
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 dark:bg-night-200">
      <div className="mb-2 flex items-center gap-2 text-slate-500 dark:text-slate-400">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

export default function KpiWidget({ kpis }: { kpis: Kpis | null }) {
  if (!kpis) return null;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Tile icon={<Users className="h-4 w-4" />} label="Registrations" value={String(kpis.total_individuals)} />
      <Tile icon={<Store className="h-4 w-4" />} label="Stores" value={String(kpis.total_stores)} />
      <Tile icon={<CheckCircle2 className="h-4 w-4" />} label="Qualification Rate" value={`${kpis.qualification_rate}%`} />
      <Tile
        icon={<PieChart className="h-4 w-4" />}
        label="Avg Share of Wall"
        value={kpis.avg_share_of_wall != null ? `${kpis.avg_share_of_wall}%` : '—'}
      />
    </div>
  );
}
