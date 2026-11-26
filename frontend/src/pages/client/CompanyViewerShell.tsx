import { LogOut } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import CompanyPhotoReview from './CompanyPhotoReview'

// Whole app for the company_viewer role (a client such as Diplomat): one page,
// its company's photo review, and a way to sign out. No navigation on purpose —
// the API refuses this role everything else (workers-api/src/lib/companyViewer.js).
export default function CompanyViewerShell() {
  const { user, logout } = useAuthStore()
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-semibold text-gray-900 dark:text-white">FieldVibe</span>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline text-gray-500 dark:text-gray-400">{user?.email}</span>
            <button
              onClick={() => logout()}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <CompanyPhotoReview />
      </main>
    </div>
  )
}
