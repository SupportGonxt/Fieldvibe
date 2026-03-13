import React, { useState } from 'react'

interface Integration {
  id: string
  name: string
  description: string
  category: string
  icon: string
  status: 'connected' | 'disconnected' | 'error'
  connected_at?: string
}

export const IntegrationsPage: React.FC = () => {
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null)

  const mockIntegrations: Integration[] = [
    {
      id: '1',
      name: 'Slack',
      description: 'Send notifications and alerts to Slack channels',
      category: 'Communication',
      icon: '💬',
      status: 'disconnected'
    },
    {
      id: '2',
      name: 'Google Drive',
      description: 'Backup and sync files to Google Drive',
      category: 'Storage',
      icon: '📁',
      status: 'disconnected'
    },
    {
      id: '3',
      name: 'Mailchimp',
      description: 'Sync customer data with Mailchimp campaigns',
      category: 'Marketing',
      icon: '📧',
      status: 'disconnected'
    },
    {
      id: '4',
      name: 'QuickBooks',
      description: 'Sync financial data with QuickBooks',
      category: 'Accounting',
      icon: '💰',
      status: 'disconnected'
    },
    {
      id: '5',
      name: 'Zapier',
      description: 'Connect with 3000+ apps via Zapier',
      category: 'Automation',
      icon: '⚡',
      status: 'disconnected'
    },
    {
      id: '6',
      name: 'Twilio',
      description: 'Send SMS notifications to customers',
      category: 'Communication',
      icon: '📱',
      status: 'disconnected'
    }
  ]

  const getStatusBadge = (status: string) => {
    const badges = {
      connected: 'bg-green-100 text-green-800',
      disconnected: 'bg-gray-100 text-gray-800',
      error: 'bg-red-100 text-red-800'
    }
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800'
  }

  const categories = Array.from(new Set(mockIntegrations.map(i => i.category)))

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
          <p className="mt-1 text-sm text-gray-500">
            Connect FieldVibe with your favorite tools and services
          </p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          Browse All Integrations
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Available</p>
              <p className="text-2xl font-semibold text-gray-900">{mockIntegrations.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Connected</p>
              <p className="text-2xl font-semibold text-gray-900">
                {mockIntegrations.filter(i => i.status === 'connected').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
              <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Categories</p>
              <p className="text-2xl font-semibold text-gray-900">{categories.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Integrations by Category */}
      {categories.map((category) => (
        <div key={category} className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-medium text-gray-900">{category}</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mockIntegrations
                .filter(i => i.category === category)
                .map((integration) => (
                  <div
                    key={integration.id}
                    className="border border-gray-100 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center">
                        <div className="text-3xl mr-3">{integration.icon}</div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">{integration.name}</h3>
                          <span className={`mt-1 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(integration.status)}`}>
                            {integration.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">{integration.description}</p>
                    {integration.status === 'connected' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedIntegration(integration)
                            setShowConfigModal(true)
                          }}
                          className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded text-sm text-center hover:bg-gray-200"
                        >
                          Configure
                        </button>
                        <button className="flex-1 bg-red-100 text-red-700 px-3 py-2 rounded text-sm text-center hover:bg-red-200">
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedIntegration(integration)
                          setShowConfigModal(true)
                        }}
                        className="w-full bg-blue-600 text-white px-3 py-2 rounded text-sm text-center hover:bg-blue-700"
                      >
                        Connect
                      </button>
                    )}
                    {integration.connected_at && (
                      <p className="mt-2 text-xs text-gray-500">
                        Connected {new Date(integration.connected_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      ))}

      {/* API Keys Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">API Keys</h2>
        <p className="text-sm text-gray-500 mb-4">
          Use these API keys to integrate FieldVibe with custom applications
        </p>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-surface-secondary rounded-lg">
            <div>
              <div className="text-sm font-medium text-gray-900">Production API Key</div>
              <div className="text-sm text-gray-500 font-mono">sk_live_••••••••••••••••</div>
            </div>
            <div className="flex gap-2">
              <button className="text-blue-600 hover:text-blue-900 text-sm font-medium">
                Reveal
              </button>
              <button className="text-blue-600 hover:text-blue-900 text-sm font-medium">
                Copy
              </button>
              <button className="text-red-600 hover:text-red-900 text-sm font-medium">
                Revoke
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-surface-secondary rounded-lg">
            <div>
              <div className="text-sm font-medium text-gray-900">Test API Key</div>
              <div className="text-sm text-gray-500 font-mono">sk_test_••••••••••••••••</div>
            </div>
            <div className="flex gap-2">
              <button className="text-blue-600 hover:text-blue-900 text-sm font-medium">
                Reveal
              </button>
              <button className="text-blue-600 hover:text-blue-900 text-sm font-medium">
                Copy
              </button>
              <button className="text-red-600 hover:text-red-900 text-sm font-medium">
                Revoke
              </button>
            </div>
          </div>

          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            Generate New API Key
          </button>
        </div>
      </div>

      {/* Webhooks Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Webhooks</h2>
        <p className="text-sm text-gray-500 mb-4">
          Configure webhooks to receive real-time notifications about events in your account
        </p>
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No webhooks configured</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new webhook endpoint.</p>
          <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            Add Webhook
          </button>
        </div>
      </div>
    </div>
  )
}
