import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fieldOperationsService } from '../../services/field-operations.service'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { Settings, Save } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface SettingRow {
  key: string
  label: string
  description: string
  type: 'text' | 'number' | 'boolean'
  default: string
}

const SETTINGS_SCHEMA: SettingRow[] = [
  { key: 'default_working_days_per_week', label: 'Default Working Days per Week', description: 'How many days per week agents work (Mon-Fri = 5)', type: 'number', default: '5' },
  { key: 'default_target_visits_per_day', label: 'Default Target Visits per Day', description: 'Default daily visit target for new agents', type: 'number', default: '20' },
  { key: 'default_target_registrations_per_day', label: 'Default Target Registrations per Day', description: 'Default daily registration target', type: 'number', default: '10' },
  { key: 'default_target_conversions_per_day', label: 'Default Target Conversions per Day', description: 'Default daily conversion target', type: 'number', default: '5' },
  { key: 'commission_calculation_method', label: 'Commission Calculation Method', description: 'How commissions are calculated: per_visit, per_registration, per_conversion, tier_based', type: 'text', default: 'tier_based' },
  { key: 'auto_recalculate_targets', label: 'Auto-Recalculate Targets', description: 'Automatically recalculate actuals at end of day (true/false)', type: 'boolean', default: 'false' },
  { key: 'require_gps_for_visits', label: 'Require GPS for Visits', description: 'Require GPS location when checking in/out of visits', type: 'boolean', default: 'true' },
  { key: 'max_visit_duration_hours', label: 'Max Visit Duration (hours)', description: 'Maximum allowed visit duration before auto-checkout', type: 'number', default: '4' },
  { key: 'default_revisit_radius_meters', label: 'Default Revisit Radius (meters)', description: 'GPS radius for store revisit check-ins. Agents must be within this distance of a store to check in for revisits. Set per-company in company settings.', type: 'number', default: '200' },
]

export default function FieldOpsSettingsPage() {
  const queryClient = useQueryClient()
  const [localSettings, setLocalSettings] = useState<Record<string, string>>({})
  const [hasChanges, setHasChanges] = useState(false)

  const { data: settings, isLoading, isError } = useQuery({
    queryKey: ['field-ops-settings'],
    queryFn: () => fieldOperationsService.getFieldOpsSettings(),
  })

  useEffect(() => {
    if (settings) {
      const settingsData = settings?.data || settings || []
      const mapped: Record<string, string> = {}
      if (Array.isArray(settingsData)) {
        settingsData.forEach((s: any) => { mapped[s.setting_key] = s.setting_value })
      }
      SETTINGS_SCHEMA.forEach(s => {
        if (!mapped[s.key]) mapped[s.key] = s.default
      })
      setLocalSettings(mapped)
    }
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: (settingsArr: { setting_key: string; setting_value: string; description?: string }[]) =>
      fieldOperationsService.bulkSaveFieldOpsSettings(settingsArr),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-ops-settings'] })
      toast.success('Settings saved')
      setHasChanges(false)
    },
    onError: () => toast.error('Failed to save settings'),
  })

  function handleChange(key: string, value: string) {
    setLocalSettings({ ...localSettings, [key]: value })
    setHasChanges(true)
  }

  function handleSave() {
    const settingsArr = SETTINGS_SCHEMA.map(s => ({
      setting_key: s.key,
      setting_value: localSettings[s.key] || s.default,
      description: s.description,
    }))
    saveMutation.mutate(settingsArr)
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 text-lg font-medium">Failed to load settings</p>
          <p className="text-gray-500 mt-2">Please try refreshing the page</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Field Ops Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Global defaults for field operations targets, working days, and commissions
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saveMutation.isPending}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="card p-6">
        <div className="space-y-6">
          {SETTINGS_SCHEMA.map(setting => (
            <div key={setting.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <div className="sm:w-1/2">
                <label className="text-sm font-medium text-gray-900 dark:text-white">{setting.label}</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{setting.description}</p>
              </div>
              <div className="sm:w-1/2">
                {setting.type === 'boolean' ? (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localSettings[setting.key] === 'true'}
                      onChange={(e) => handleChange(setting.key, e.target.checked ? 'true' : 'false')}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {localSettings[setting.key] === 'true' ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                ) : (
                  <input
                    type={setting.type}
                    value={localSettings[setting.key] || ''}
                    onChange={(e) => handleChange(setting.key, e.target.value)}
                    className="input w-full sm:max-w-xs"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
