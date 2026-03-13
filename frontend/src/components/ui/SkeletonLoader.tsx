export function SkeletonCard() {
  return (
    <div className="card p-6 animate-pulse">
      <div className="h-4 bg-gray-200 dark:bg-night-100 rounded w-1/4 mb-4"></div>
      <div className="h-8 bg-gray-200 dark:bg-night-100 rounded w-1/2 mb-2"></div>
      <div className="h-3 bg-gray-200 dark:bg-night-100 rounded w-1/3"></div>
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-night-100">
          <thead className="bg-surface-secondary dark:bg-night-100">
            <tr>
              {[1, 2, 3, 4, 5].map((i) => (
                <th key={i} className="px-6 py-3">
                  <div className="h-3 bg-gray-200 dark:bg-night-50 rounded animate-pulse"></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-night-50 divide-y divide-gray-200 dark:divide-night-100">
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i}>
                {[1, 2, 3, 4, 5].map((j) => (
                  <td key={j} className="px-6 py-4">
                    <div className="h-4 bg-gray-200 dark:bg-night-100 rounded animate-pulse"></div>
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

export function SkeletonChart() {
  return (
    <div className="card p-6 animate-pulse">
      <div className="h-4 bg-gray-200 dark:bg-night-100 rounded w-1/4 mb-4"></div>
      <div className="h-64 bg-gray-200 dark:bg-night-100 rounded"></div>
    </div>
  )
}

export function SkeletonGrid({ items = 4 }: { items?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: items }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

export function SkeletonList({ items = 5 }: { items?: number }) {
  return (
    <div className="card p-6 space-y-4">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="w-12 h-12 bg-gray-200 dark:bg-night-100 rounded-lg"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-night-100 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 dark:bg-night-100 rounded w-1/2"></div>
          </div>
        </div>
      ))}
    </div>
  )
}
