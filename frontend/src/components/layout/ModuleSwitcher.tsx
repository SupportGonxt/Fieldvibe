import { useState } from 'react'
import { 
  Route, 
  TrendingUp, 
  Building2, 
  DollarSign, 
  Settings,
  ShoppingCart
} from 'lucide-react'

export type ModuleType = 'operations' | 'sales' | 'marketing' | 'crm' | 'finance' | 'admin'

interface ModuleSwitcherProps {
  currentModule: ModuleType
  onModuleChange: (module: ModuleType) => void
}

const modules = [
  {
    id: 'operations' as ModuleType,
    name: 'Operations',
    icon: Route,
    description: 'Field Operations, Van Sales, Inventory'
  },
  {
    id: 'sales' as ModuleType,
    name: 'Sales',
    icon: ShoppingCart,
    description: 'Orders, Invoices, Payments'
  },
  {
    id: 'marketing' as ModuleType,
    name: 'Marketing',
    icon: TrendingUp,
    description: 'Trade Marketing, Promotions, Campaigns'
  },
  {
    id: 'crm' as ModuleType,
    name: 'CRM',
    icon: Building2,
    description: 'Customers, KYC, Surveys'
  },
  {
    id: 'finance' as ModuleType,
    name: 'Finance',
    icon: DollarSign,
    description: 'Commissions, Cash Reconciliation'
  },
  {
    id: 'admin' as ModuleType,
    name: 'Admin',
    icon: Settings,
    description: 'Users, Settings, Audit'
  }
]

export default function ModuleSwitcher({ currentModule, onModuleChange }: ModuleSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)

  const currentModuleData = modules.find(m => m.id === currentModule)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-info-500"
      >
        {currentModuleData && (
          <>
            <currentModuleData.icon className="w-5 h-5" />
            <span>{currentModuleData.name}</span>
          </>
        )}
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 z-20 w-64 mt-2 bg-white border border-gray-100 rounded-lg shadow-lg">
            <div className="p-2">
              {modules.map((module) => {
                const Icon = module.icon
                const isActive = module.id === currentModule

                return (
                  <button
                    key={module.id}
                    onClick={() => {
                      onModuleChange(module.id)
                      setIsOpen(false)
                    }}
                    className={`w-full flex items-start gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      isActive
                        ? 'bg-info-50 text-info-700'
                        : 'hover:bg-surface-secondary text-gray-700'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                      isActive ? 'text-info-600' : 'text-gray-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${
                        isActive ? 'text-info-700' : 'text-gray-900'
                      }`}>
                        {module.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {module.description}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
