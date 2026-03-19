import { useState, useEffect } from 'react'
import { Settings, DollarSign, Bell, Lock, Mail, FileText, Globe, Zap, Save, AlertCircle, Upload, CheckCircle, Building2, MessageSquare, ShoppingCart, Receipt, Package, MapPin, Shield, Plug, RefreshCw } from 'lucide-react'
import CurrencySettings from '../../components/settings/CurrencySettings'
import api from '../../services/api'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import SearchableSelect from '../../components/ui/SearchableSelect'

interface Setting {
  key: string
  value: string
  label: string
  type: string
  category: string
  description: string
  options?: string[]
  sensitive?: boolean
  displayValue?: string
}

interface SettingsCategory {
  id: string
  name: string
  icon: string
  description: string
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Building2,
  Mail,
  MessageSquare,
  Globe,
  ShoppingCart,
  FileText,
  Receipt,
  DollarSign,
  Package,
  MapPin,
  Bell,
  Shield,
  Plug,
  Settings
}

export default function SystemSettingsPage() {
  const [activeTab, setActiveTab] = useState('company')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<Record<string, Setting>>({})
  const [categories, setCategories] = useState<SettingsCategory[]>([])
  const [modifiedSettings, setModifiedSettings] = useState<Record<string, string>>({})
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [initializing, setInitializing] = useState(false)

  useEffect(() => {
    loadSettings()
    loadCategories()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const response = await api.get('/settings')
      if (response.data?.success) {
        setSettings(response.data.data.settings || {})
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      await initializeSettings()
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const response = await api.get('/settings-categories')
      if (response.data?.success) {
        setCategories(response.data.data || [])
      }
    } catch (error) {
      console.error('Failed to load categories:', error)
      setCategories([
        { id: 'company', name: 'Company Information', icon: 'Building2', description: 'Basic company details and branding' },
        { id: 'email', name: 'Email Configuration', icon: 'Mail', description: 'SMTP settings for sending emails' },
        { id: 'sms', name: 'SMS Configuration', icon: 'MessageSquare', description: 'Twilio settings for SMS notifications' },
        { id: 'locale', name: 'Regional Settings', icon: 'Globe', description: 'Currency, date format, and timezone' },
        { id: 'orders', name: 'Order Settings', icon: 'ShoppingCart', description: 'Order processing and approval rules' },
        { id: 'invoices', name: 'Invoice Settings', icon: 'FileText', description: 'Invoice numbering and terms' },
        { id: 'tax', name: 'Tax Settings', icon: 'Receipt', description: 'Tax rates and calculations' },
        { id: 'commissions', name: 'Commission Settings', icon: 'DollarSign', description: 'Sales commission configuration' },
        { id: 'inventory', name: 'Inventory Settings', icon: 'Package', description: 'Stock management rules' },
        { id: 'visits', name: 'Visit Settings', icon: 'MapPin', description: 'Field visit requirements' },
        { id: 'notifications', name: 'Notification Settings', icon: 'Bell', description: 'Alert and notification preferences' },
        { id: 'security', name: 'Security Settings', icon: 'Shield', description: 'Authentication and access control' },
        { id: 'integrations', name: 'Integration Settings', icon: 'Plug', description: 'Third-party integrations and APIs' }
      ])
    }
  }

  const initializeSettings = async () => {
    setInitializing(true)
    try {
      await api.post('/settings/initialize')
      await loadSettings()
    } catch (error) {
      console.error('Failed to initialize settings:', error)
    } finally {
      setInitializing(false)
    }
  }

  const handleSettingChange = (key: string, value: string) => {
    setModifiedSettings(prev => ({ ...prev, [key]: value }))
    setSettings(prev => ({
      ...prev,
      [key]: { ...prev[key], value }
    }))
  }

  const handleSave = async () => {
    if (Object.keys(modifiedSettings).length === 0) {
      setSaveMessage({ type: 'error', text: 'No changes to save' })
      setTimeout(() => setSaveMessage(null), 3000)
      return
    }

    setSaving(true)
    try {
      await api.put('/settings', { settings: modifiedSettings })
      setModifiedSettings({})
      setSaveMessage({ type: 'success', text: 'Settings saved successfully!' })
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (error) {
      console.error('Failed to save settings:', error)
      setSaveMessage({ type: 'error', text: 'Failed to save settings' })
      setTimeout(() => setSaveMessage(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const getSettingsForCategory = (categoryId: string): Setting[] => {
    return Object.values(settings).filter(s => s.category === categoryId)
  }

  const renderSettingInput = (setting: Setting) => {
    const value = setting.value || ''
    
    switch (setting.type) {
      case 'boolean':
        return (
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={value === 'true'}
              onChange={(e) => handleSettingChange(setting.key, e.target.checked ? 'true' : 'false')}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        )
      
      case 'select':
        return (
          <SearchableSelect
            options={[
              { value: 'opt', label: '{opt}' },
            ]}
            value={value}
            placeholder="{opt}"
          />
        )
      
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            className="input w-full h-24"
            placeholder={setting.description}
          />
        )
      
      case 'password':
        return (
          <input
            type="password"
            value={value}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            className="input w-full"
            placeholder={setting.sensitive && setting.displayValue ? setting.displayValue : setting.description}
          />
        )
      
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            className="input w-full"
            placeholder={setting.description}
          />
        )
      
      case 'email':
        return (
          <input
            type="email"
            value={value}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            className="input w-full"
            placeholder={setting.description}
          />
        )
      
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            className="input w-full"
            placeholder={setting.description}
          />
        )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="mt-1 text-sm text-gray-600">
            Configure system-wide settings and preferences
          </p>
        </div>
        <div className="flex items-center gap-3">
          {Object.keys(modifiedSettings).length > 0 && (
            <span className="text-sm text-orange-600">
              {Object.keys(modifiedSettings).length} unsaved change(s)
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || Object.keys(modifiedSettings).length === 0}
            className="btn btn-primary flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          saveMessage.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          {saveMessage.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <span className={saveMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}>
            {saveMessage.text}
          </span>
        </div>
      )}

      {/* Alert Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-blue-900">Configuration Notice</h3>
          <p className="text-sm text-blue-700 mt-1">
            Changes to these settings will affect all users. Make sure to test thoroughly before saving.
          </p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {categories.map((category) => {
              const Icon = iconMap[category.icon] || Settings
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveTab(category.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === category.id
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-gray-600 hover:bg-surface-secondary hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{category.name}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="card p-6">
            {categories.map((category) => {
              if (activeTab !== category.id) return null
              
              const categorySettings = getSettingsForCategory(category.id)
              const Icon = iconMap[category.icon] || Settings
              
              return (
                <div key={category.id} className="space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Icon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{category.name}</h2>
                      <p className="text-sm text-gray-500">{category.description}</p>
                    </div>
                  </div>

                  {categorySettings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Settings className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No settings available for this category.</p>
                      <button
                        onClick={initializeSettings}
                        disabled={initializing}
                        className="mt-4 btn btn-secondary"
                      >
                        {initializing ? 'Initializing...' : 'Initialize Settings'}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {categorySettings.map((setting) => (
                        <div 
                          key={setting.key} 
                          className={setting.type === 'textarea' ? 'md:col-span-2' : ''}
                        >
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {setting.label}
                          </label>
                          {renderSettingInput(setting)}
                          <p className="mt-1 text-xs text-gray-500">{setting.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
