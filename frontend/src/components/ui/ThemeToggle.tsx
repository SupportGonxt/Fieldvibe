import { Sun, Moon, Monitor } from 'lucide-react'
import { useThemeStore } from '../../store/theme.store'

export default function ThemeToggle() {
  const { theme, setTheme } = useThemeStore()

  const themes = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'System' },
  ]

  return (
    <div className="flex items-center bg-gray-100 dark:bg-night-100 rounded-lg p-1 gap-0.5">
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`p-1.5 rounded-md transition-all ${
            theme === value
              ? 'bg-white dark:bg-night-50 shadow-sm text-primary-600 dark:text-pulse'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          title={label}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}
