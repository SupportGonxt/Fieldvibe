import React from 'react'

type PresetKey = 'today' | 'wtd' | 'mtd' | 'ytd' | 'custom'

interface DateRangePresetsProps {
  startDate: string
  endDate: string
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
}

function getPresetDates(preset: PresetKey): { start: string; end: string } | null {
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  if (preset === 'today') {
    return { start: today, end: today }
  }

  if (preset === 'wtd') {
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(now)
    monday.setDate(now.getDate() + mondayOffset)
    return { start: monday.toISOString().split('T')[0], end: today }
  }

  if (preset === 'mtd') {
    const monthStart = today.substring(0, 7) + '-01'
    return { start: monthStart, end: today }
  }

  if (preset === 'ytd') {
    const yearStart = today.substring(0, 4) + '-01-01'
    return { start: yearStart, end: today }
  }

  return null
}

function getActivePreset(startDate: string, endDate: string): PresetKey {
  if (!startDate && !endDate) return 'custom'

  const presets: PresetKey[] = ['today', 'wtd', 'mtd', 'ytd']
  for (const preset of presets) {
    const dates = getPresetDates(preset)
    if (dates && dates.start === startDate && dates.end === endDate) {
      return preset
    }
  }
  return 'custom'
}

const DateRangePresets: React.FC<DateRangePresetsProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}) => {
  const activePreset = getActivePreset(startDate, endDate)

  const handlePreset = (preset: PresetKey) => {
    if (preset === 'custom') {
      onStartDateChange('')
      onEndDateChange('')
      return
    }
    const dates = getPresetDates(preset)
    if (dates) {
      onStartDateChange(dates.start)
      onEndDateChange(dates.end)
    }
  }

  const btnClass = (preset: PresetKey) =>
    `px-3 py-1.5 text-sm rounded-md transition-colors ${
      activePreset === preset
        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm font-medium'
        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
    }`

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        <button onClick={() => handlePreset('today')} className={btnClass('today')}>Today</button>
        <button onClick={() => handlePreset('wtd')} className={btnClass('wtd')}>Week to Date</button>
        <button onClick={() => handlePreset('mtd')} className={btnClass('mtd')}>Month to Date</button>
        <button onClick={() => handlePreset('ytd')} className={btnClass('ytd')}>Year to Date</button>
        <button onClick={() => handlePreset('custom')} className={btnClass('custom')}>Custom</button>
      </div>
      {activePreset === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={e => onStartDateChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <span className="text-gray-500 text-sm">to</span>
          <input
            type="date"
            value={endDate}
            onChange={e => onEndDateChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
      )}
    </div>
  )
}

export default DateRangePresets
