import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { LucideIcon } from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { EmptyAnalytics } from '../ui/EmptyState'

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16']

// --- KPI Metric Card ---
interface MetricProps {
  label: string
  value: string | number
  change?: number
  changeLabel?: string
  icon?: LucideIcon
  color?: string
}

export function AnalyticsMetric({ label, value, change, changeLabel = 'vs last period', icon: Icon, color = '#3B82F6' }: MetricProps) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {change > 0 ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : change < 0 ? (
                <TrendingDown className="w-4 h-4 text-red-500" />
              ) : (
                <Minus className="w-4 h-4 text-gray-400" />
              )}
              <span className={`text-sm font-medium ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                {change > 0 ? '+' : ''}{change.toFixed(1)}%
              </span>
              <span className="text-xs text-gray-400 ml-1">{changeLabel}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="p-3 rounded-xl" style={{ backgroundColor: `${color}15` }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
        )}
      </div>
    </div>
  )
}

// --- Metrics Grid ---
interface MetricsGridProps {
  metrics: MetricProps[]
  columns?: 2 | 3 | 4
}

export function AnalyticsMetricsGrid({ metrics, columns = 4 }: MetricsGridProps) {
  const colClass = columns === 2 ? 'lg:grid-cols-2' : columns === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${colClass} gap-4`}>
      {metrics.map((m, i) => (
        <AnalyticsMetric key={i} {...m} />
      ))}
    </div>
  )
}

// --- Trend Chart ---
interface TrendChartProps {
  title: string
  data: any[]
  dataKey: string
  xAxisKey?: string
  color?: string
  height?: number
  secondaryDataKey?: string
  secondaryColor?: string
  areaFill?: boolean
}

export function AnalyticsTrendChart({
  title,
  data,
  dataKey,
  xAxisKey = 'date',
  color = '#3B82F6',
  height = 300,
  secondaryDataKey,
  secondaryColor = '#10B981',
  areaFill = true,
}: TrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="card p-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
        <EmptyAnalytics />
      </div>
    )
  }

  return (
    <div className="card p-5">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey={xAxisKey} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
            <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            {secondaryDataKey && <Legend />}
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fill={areaFill ? color : 'transparent'}
              fillOpacity={areaFill ? 0.1 : 0}
              strokeWidth={2}
            />
            {secondaryDataKey && (
              <Area
                type="monotone"
                dataKey={secondaryDataKey}
                stroke={secondaryColor}
                fill={areaFill ? secondaryColor : 'transparent'}
                fillOpacity={areaFill ? 0.1 : 0}
                strokeWidth={2}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// --- Bar Chart ---
interface BarChartProps {
  title: string
  data: any[]
  dataKey: string
  xAxisKey?: string
  color?: string
  height?: number
  layout?: 'horizontal' | 'vertical'
  secondaryDataKey?: string
  secondaryColor?: string
}

export function AnalyticsBarChart({
  title,
  data,
  dataKey,
  xAxisKey = 'name',
  color = '#3B82F6',
  height = 300,
  layout = 'vertical',
  secondaryDataKey,
  secondaryColor = '#10B981',
}: BarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="card p-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
        <EmptyAnalytics />
      </div>
    )
  }

  return (
    <div className="card p-5">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout={layout === 'horizontal' ? 'horizontal' : 'vertical'}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            {layout === 'horizontal' ? (
              <>
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                <YAxis dataKey={xAxisKey} type="category" width={100} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
              </>
            ) : (
              <>
                <XAxis dataKey={xAxisKey} tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" />
              </>
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            {secondaryDataKey && <Legend />}
            <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
            {secondaryDataKey && (
              <Bar dataKey={secondaryDataKey} fill={secondaryColor} radius={[4, 4, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// --- Pie / Donut Chart ---
interface PieChartProps {
  title: string
  data: { name: string; value: number; color?: string }[]
  height?: number
  donut?: boolean
}

export function AnalyticsPieChart({ title, data, height = 300, donut = false }: PieChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="card p-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
        <EmptyAnalytics />
      </div>
    )
  }

  return (
    <div className="card p-5">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={donut ? 50 : 0}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-3 mt-3 justify-center">
        {data.map((entry, index) => (
          <div key={index} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color || CHART_COLORS[index % CHART_COLORS.length] }}
            />
            {entry.name}
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Summary Table ---
interface SummaryTableProps {
  title: string
  columns: { key: string; label: string; render?: (value: any, row: any) => React.ReactNode }[]
  data: any[]
  maxRows?: number
}

export function AnalyticsSummaryTable({ title, columns, data, maxRows = 5 }: SummaryTableProps) {
  const displayData = data.slice(0, maxRows)

  if (!data || data.length === 0) {
    return (
      <div className="card p-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
        <EmptyAnalytics />
      </div>
    )
  }

  return (
    <div className="card p-5">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-night-100">
              {columns.map(col => (
                <th key={col.key} className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, idx) => (
              <tr key={idx} className="border-b border-gray-100 dark:border-night-100 last:border-0">
                {columns.map(col => (
                  <td key={col.key} className="py-2 px-3 text-gray-700 dark:text-gray-300">
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- Full Analytics Panel ---
interface AnalyticsPanelProps {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function AnalyticsPanel({ title, description, children, className = '' }: AnalyticsPanelProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}
