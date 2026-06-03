import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  separator?: React.ReactNode;
  showHome?: boolean;
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ 
  items,
  separator = <ChevronRight className="w-4 h-4 text-gray-400" />,
  showHome = true
}) => {
  const location = useLocation();

  // Auto-generate breadcrumbs from URL if items not provided
  const breadcrumbItems = items || generateBreadcrumbsFromPath(location.pathname);

  // Add home breadcrumb if enabled
  const allItems: BreadcrumbItem[] = showHome 
    ? [{ label: 'Home', path: '/', icon: Home }, ...breadcrumbItems]
    : breadcrumbItems;

  if (allItems.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-sm">
      {allItems.map((item, index) => {
        const isLast = index === allItems.length - 1;
        const Icon = item.icon;

        return (
          <React.Fragment key={index}>
            {index > 0 && <span className="flex-shrink-0">{separator}</span>}
            
            {isLast || !item.path ? (
              <span className="flex items-center gap-1.5 font-medium text-gray-900">
                {Icon && <Icon className="w-4 h-4" />}
                {item.label}
              </span>
            ) : (
              <Link
                to={item.path}
                className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors"
              >
                {Icon && <Icon className="w-4 h-4" />}
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

// Helper function to generate breadcrumbs from pathname
function generateBreadcrumbsFromPath(pathname: string): BreadcrumbItem[] {
  const pathSegments = pathname.split('/').filter(Boolean);
  
  if (pathSegments.length === 0) {
    return [];
  }

  const breadcrumbs: BreadcrumbItem[] = [];
  let currentPath = '';

  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    
    // Format label: capitalize and replace hyphens with spaces
    const label = segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    // Don't add path for last item (current page)
    const isLast = index === pathSegments.length - 1;
    
    breadcrumbs.push({
      label,
      path: isLast ? undefined : currentPath
    });
  });

  return breadcrumbs;
}

// Custom labels mapping for specific routes
export const breadcrumbLabels: Record<string, string> = {
  '/field-marketing': 'Field Marketing',
  '/field-marketing/customer-selection': 'Select Customer',
  '/field-marketing/board-placement': 'Board Placement',
  '/field-marketing/product-distribution': 'Product Distribution',
  '/field-marketing/visit-workflow': 'Visit Workflow',
  '/trade-marketing': 'Trade Marketing',
  '/trade-marketing/shelf-analytics': 'Shelf Analytics',
  '/trade-marketing/sku-availability': 'SKU Availability',
  '/trade-marketing/pos-materials': 'POS Materials',
  '/trade-marketing/brand-activation': 'Brand Activation',
  '/van-sales/dashboard': 'Van Sales Dashboard',
  '/field-operations/dashboard': 'Field Operations Dashboard',
  '/field-operations/reports/goldrush-stores': 'Stores Report',
  '/admin': 'Admin Panel',
};

// Enhanced version with custom labels
export const BreadcrumbsWithLabels: React.FC<Omit<BreadcrumbsProps, 'items'>> = (props) => {
  const location = useLocation();
  
  // Generate items with custom labels
  const items = generateBreadcrumbsFromPath(location.pathname).map((item, index) => {
    // Build full path for this segment
    const fullPath = location.pathname.split('/').slice(0, index + 2).join('/');
    const customLabel = breadcrumbLabels[fullPath];
    
    return {
      ...item,
      label: customLabel || item.label
    };
  });

  return <Breadcrumbs {...props} items={items} />;
};

export default Breadcrumbs;
