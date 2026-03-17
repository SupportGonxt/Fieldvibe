import React, { useState } from 'react';
import { 
  ChevronDown, Truck, Users, Target, TrendingUp, Settings,
  Star, Package, Gift, BarChart3, MapPin
} from 'lucide-react';

interface Module {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  color: string;
  roles: string[]; // Roles that can access this module
}

interface ModuleSwitcherProps {
  currentModule?: string;
  userRole?: string;
  onModuleChange?: (moduleId: string) => void;
}

const ModuleSwitcher: React.FC<ModuleSwitcherProps> = ({ 
  currentModule = 'field-marketing',
  userRole = 'agent',
  onModuleChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [recentModules, setRecentModules] = useState<string[]>(['field-marketing', 'trade-marketing']);

  const modules: Module[] = [
    {
      id: 'van-sales',
      name: 'Van Sales',
      description: 'Manage van sales operations and deliveries',
      icon: Truck,
      path: '/van-sales/dashboard',
      color: 'text-blue-600 bg-blue-100',
      roles: ['admin', 'manager', 'van-salesman']
    },
    {
      id: 'field-operations',
      name: 'Field Operations',
      description: 'Track field activities and operations',
      icon: MapPin,
      path: '/field-operations/dashboard',
      color: 'text-green-600 bg-green-100',
      roles: ['admin', 'manager', 'field-agent']
    },
    {
      id: 'field-marketing',
      name: 'Field Marketing',
      description: 'Board placements, product distribution, commissions',
      icon: Target,
      path: '/field-marketing',
      color: 'text-orange-600 bg-orange-100',
      roles: ['admin', 'manager', 'field-marketer', 'agent']
    },
    {
      id: 'trade-marketing',
      name: 'Trade Marketing',
      description: 'Shelf analytics, SKU tracking, POS materials, activations',
      icon: TrendingUp,
      path: '/trade-marketing',
      color: 'text-purple-600 bg-purple-100',
      roles: ['admin', 'manager', 'trade-marketer', 'agent']
    },
    {
      id: 'admin',
      name: 'Admin Panel',
      description: 'System configuration and management',
      icon: Settings,
      path: '/admin',
      color: 'text-gray-600 bg-gray-100',
      roles: ['admin']
    },
  ];

  // Filter modules based on user role
  const accessibleModules = modules.filter(module => 
    module.roles.includes(userRole)
  );

  const currentModuleData = modules.find(m => m.id === currentModule) || modules[0];

  const handleModuleSelect = (moduleId: string) => {
    setIsOpen(false);
    
    // Update recent modules
    const updated = [moduleId, ...recentModules.filter(id => id !== moduleId)].slice(0, 3);
    setRecentModules(updated);
    
    // Navigate
    if (onModuleChange) {
      onModuleChange(moduleId);
    } else {
      // Default navigation
      const module = modules.find(m => m.id === moduleId);
      if (module) {
        window.location.href = module.path;
      }
    }
  };

  const toggleFavorite = (moduleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Implementation for favoriting modules
  };

  return (
    <div className="relative">
      {/* Current Module Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-surface-secondary transition-colors min-w-[280px]"
      >
        <div className={`p-2 rounded-lg ${currentModuleData.color}`}>
          <currentModuleData.icon className="w-5 h-5" />
        </div>
        <div className="flex-1 text-left">
          <div className="font-medium text-gray-900">{currentModuleData.name}</div>
          <div className="text-xs text-gray-500">Current Module</div>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute top-full left-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-100 z-50 max-h-[600px] overflow-y-auto">
            {/* Recent Modules Section */}
            {recentModules.length > 0 && (
              <div className="p-3 border-b border-gray-100">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Recently Used
                </div>
                <div className="space-y-1">
                  {recentModules.slice(0, 3).map(moduleId => {
                    const module = modules.find(m => m.id === moduleId);
                    if (!module || !accessibleModules.find(m => m.id === moduleId)) return null;
                    
                    const Icon = module.icon;
                    return (
                      <button
                        key={moduleId}
                        onClick={() => handleModuleSelect(moduleId)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-secondary transition-colors text-left"
                      >
                        <div className={`p-1.5 rounded ${module.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{module.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* All Modules Section */}
            <div className="p-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                All Modules
              </div>
              <div className="space-y-1">
                {accessibleModules.map(module => {
                  const Icon = module.icon;
                  const isActive = module.id === currentModule;
                  
                  return (
                    <button
                      key={module.id}
                      onClick={() => handleModuleSelect(module.id)}
                      className={`w-full flex items-start gap-3 px-3 py-3 rounded-lg transition-colors text-left ${
                        isActive 
                          ? 'bg-gray-100' 
                          : 'hover:bg-surface-secondary'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${module.color} flex-shrink-0`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-gray-900">{module.name}</span>
                          <button
                            onClick={(e) => toggleFavorite(module.id, e)}
                            className="text-gray-400 hover:text-yellow-500 transition-colors"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                          {module.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-100 bg-surface-secondary">
              <div className="text-xs text-gray-500 text-center">
                You have access to {accessibleModules.length} modules
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ModuleSwitcher;
