import React, { useState, useEffect } from 'react'
import { useToast } from '../../components/ui/Toast'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface SystemSettings {
  general: {
    company_name: string
    timezone: string
    currency: string
    date_format: string
    language: string
  }
  email: {
    smtp_host: string
    smtp_port: number
    smtp_username: string
    smtp_from_email: string
    smtp_from_name: string
  }
  security: {
    session_timeout: number
    password_min_length: number
    password_require_uppercase: boolean
    password_require_lowercase: boolean
    password_require_numbers: boolean
    password_require_special: boolean
    two_factor_enabled: boolean
  }
  features: {
    enable_notifications: boolean
    enable_analytics: boolean
    enable_api_access: boolean
    enable_mobile_app: boolean
  }
}

export const SystemSettingsPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'general' | 'email' | 'security' | 'features'>('general')

  const mockSettings: SystemSettings = {
    general: {
      company_name: 'FieldVibe',
      timezone: 'Africa/Johannesburg',
      currency: 'ZAR',
      date_format: 'DD/MM/YYYY',
      language: 'en'
    },
    email: {
      smtp_host: 'smtp.example.com',
      smtp_port: 587,
      smtp_username: 'noreply@example.com',
      smtp_from_email: 'noreply@example.com',
      smtp_from_name: 'FieldVibe'
    },
    security: {
      session_timeout: 30,
      password_min_length: 8,
      password_require_uppercase: true,
      password_require_lowercase: true,
      password_require_numbers: true,
      password_require_special: true,
      two_factor_enabled: false
    },
    features: {
      enable_notifications: true,
      enable_analytics: true,
      enable_api_access: true,
      enable_mobile_app: true
    }
  }

  const { toast } = useToast()
  const [settings, setSettings] = useState(mockSettings)

  const handleSave = () => {
  }

  const tabs = [
    { id: 'general', name: 'General', icon: '⚙️' },
    { id: 'email', name: 'Email', icon: '📧' },
    { id: 'security', name: 'Security', icon: '🔒' },
    { id: 'features', name: 'Features', icon: '✨' }
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure system-wide settings and preferences
          </p>
        </div>
        <button
          onClick={handleSave}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Save Changes
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-100">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={settings.general.company_name}
                  onChange={(e) => setSettings({
                    ...settings,
                    general: { ...settings.general, company_name: e.target.value }
                  })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                <select
                  value={settings.general.timezone}
                  onChange={(e) => setSettings({
                    ...settings,
                    general: { ...settings.general, timezone: e.target.value }
                  })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="Africa/Johannesburg">Africa/Johannesburg (SAST)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select
                  value={settings.general.currency}
                  onChange={(e) => setSettings({
                    ...settings,
                    general: { ...settings.general, currency: e.target.value }
                  })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="ZAR">ZAR - South African Rand</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
                <select
                  value={settings.general.date_format}
                  onChange={(e) => setSettings({
                    ...settings,
                    general: { ...settings.general, date_format: e.target.value }
                  })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                <select
                  value={settings.general.language}
                  onChange={(e) => setSettings({
                    ...settings,
                    general: { ...settings.general, language: e.target.value }
                  })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="en">English</option>
                  <option value="af">Afrikaans</option>
                  <option value="zu">Zulu</option>
                  <option value="xh">Xhosa</option>
                </select>
              </div>
            </div>
          )}

          {/* Email Settings */}
          {activeTab === 'email' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                <input
                  type="text"
                  value={settings.email.smtp_host}
                  onChange={(e) => setSettings({
                    ...settings,
                    email: { ...settings.email, smtp_host: e.target.value }
                  })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
                <input
                  type="number"
                  value={settings.email.smtp_port}
                  onChange={(e) => setSettings({
                    ...settings,
                    email: { ...settings.email, smtp_port: parseInt(e.target.value) }
                  })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Username</label>
                <input
                  type="text"
                  value={settings.email.smtp_username}
                  onChange={(e) => setSettings({
                    ...settings,
                    email: { ...settings.email, smtp_username: e.target.value }
                  })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
                <input
                  type="email"
                  value={settings.email.smtp_from_email}
                  onChange={(e) => setSettings({
                    ...settings,
                    email: { ...settings.email, smtp_from_email: e.target.value }
                  })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
                <input
                  type="text"
                  value={settings.email.smtp_from_name}
                  onChange={(e) => setSettings({
                    ...settings,
                    email: { ...settings.email, smtp_from_name: e.target.value }
                  })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4">
                <button className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">
                  Test Email Configuration
                </button>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Session Timeout (minutes)</label>
                <input
                  type="number"
                  value={settings.security.session_timeout}
                  onChange={(e) => setSettings({
                    ...settings,
                    security: { ...settings.security, session_timeout: parseInt(e.target.value) }
                  })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password Minimum Length</label>
                <input
                  type="number"
                  value={settings.security.password_min_length}
                  onChange={(e) => setSettings({
                    ...settings,
                    security: { ...settings.security, password_min_length: parseInt(e.target.value) }
                  })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-900">Password Requirements</h3>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.security.password_require_uppercase}
                    onChange={(e) => setSettings({
                      ...settings,
                      security: { ...settings.security, password_require_uppercase: e.target.checked }
                    })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Require uppercase letters</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.security.password_require_lowercase}
                    onChange={(e) => setSettings({
                      ...settings,
                      security: { ...settings.security, password_require_lowercase: e.target.checked }
                    })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Require lowercase letters</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.security.password_require_numbers}
                    onChange={(e) => setSettings({
                      ...settings,
                      security: { ...settings.security, password_require_numbers: e.target.checked }
                    })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Require numbers</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.security.password_require_special}
                    onChange={(e) => setSettings({
                      ...settings,
                      security: { ...settings.security, password_require_special: e.target.checked }
                    })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Require special characters</span>
                </label>
              </div>

              <div className="pt-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.security.two_factor_enabled}
                    onChange={(e) => setSettings({
                      ...settings,
                      security: { ...settings.security, two_factor_enabled: e.target.checked }
                    })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-900">Enable Two-Factor Authentication</span>
                </label>
              </div>
            </div>
          )}

          {/* Features Settings */}
          {activeTab === 'features' && (
            <div className="space-y-6">
              <label className="flex items-center justify-between p-4 bg-surface-secondary rounded-lg">
                <div>
                  <div className="text-sm font-medium text-gray-900">Notifications</div>
                  <div className="text-sm text-gray-500">Enable system-wide notifications</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.features.enable_notifications}
                  onChange={(e) => setSettings({
                    ...settings,
                    features: { ...settings.features, enable_notifications: e.target.checked }
                  })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-surface-secondary rounded-lg">
                <div>
                  <div className="text-sm font-medium text-gray-900">Analytics</div>
                  <div className="text-sm text-gray-500">Enable analytics and tracking</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.features.enable_analytics}
                  onChange={(e) => setSettings({
                    ...settings,
                    features: { ...settings.features, enable_analytics: e.target.checked }
                  })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-surface-secondary rounded-lg">
                <div>
                  <div className="text-sm font-medium text-gray-900">API Access</div>
                  <div className="text-sm text-gray-500">Enable API access for integrations</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.features.enable_api_access}
                  onChange={(e) => setSettings({
                    ...settings,
                    features: { ...settings.features, enable_api_access: e.target.checked }
                  })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-surface-secondary rounded-lg">
                <div>
                  <div className="text-sm font-medium text-gray-900">Mobile App</div>
                  <div className="text-sm text-gray-500">Enable mobile app access</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.features.enable_mobile_app}
                  onChange={(e) => setSettings({
                    ...settings,
                    features: { ...settings.features, enable_mobile_app: e.target.checked }
                  })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
