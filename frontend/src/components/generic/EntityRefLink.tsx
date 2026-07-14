import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'

export interface EntityRef {
  id: string
  name: string
  code?: string
  type: 'customer' | 'product' | 'brand' | 'order' | 'agent' | 'territory' | 'route'
}

interface EntityRefLinkProps {
  entity: EntityRef
  className?: string
  showIcon?: boolean
}

const routeBuilders = {
  customer: (id: string) => `/customers/${id}`,
  product: (id: string) => `/products/${id}`,
  brand: (id: string) => `/brands/${id}`,
  order: (id: string) => `/orders/${id}`,
  agent: (id: string) => `/field-operations/agents/${id}`,
  territory: (id: string) => `/admin/territories/${id}`,
  route: (id: string) => `/van-sales/routes/${id}`,
}

export function EntityRefLink({ entity, className = '', showIcon = false }: EntityRefLinkProps) {
  const route = routeBuilders[entity.type]?.(entity.id)
  
  if (!route) {
    return <span className={className}>{entity.name}</span>
  }

  return (
    <Link
      to={route}
      className={`text-info-600 hover:text-info-800 hover:underline inline-flex items-center gap-1 ${className}`}
    >
      {entity.name}
      {entity.code && <span className="text-gray-500 text-xs">({entity.code})</span>}
      {showIcon && <ExternalLink className="h-3 w-3" />}
    </Link>
  )
}

export const routeFor = routeBuilders
