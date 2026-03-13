/**
 * Tenant Service - Handles multi-tenant configuration and detection
 * Supports multiple tenant resolution strategies for scalable deployment
 */

export interface TenantConfig {
  code: string
  name: string
  domain?: string
  subdomain?: string
  theme?: {
    primaryColor?: string
    logo?: string
    favicon?: string
  }
  features?: string[]
  apiEndpoint?: string
}

export interface TenantMapping {
  [key: string]: TenantConfig
}

// Default tenant configurations
const DEFAULT_TENANT_MAPPINGS: TenantMapping = {
  'demo.fieldvibe.com': {
    code: 'DEMO',
    name: 'Demo Tenant',
    domain: 'demo.fieldvibe.com',
    theme: {
      primaryColor: '#3B82F6',
      logo: '/assets/demo-logo.png'
    }
  },
  'pepsi.fieldvibe.com': {
    code: 'PEPSI_SA',
    name: 'Pepsi South Africa',
    domain: 'pepsi.fieldvibe.com',
    theme: {
      primaryColor: '#004B93',
      logo: '/assets/pepsi-logo.png'
    }
  },
  'ss.gonxt.tech': {
    code: 'DEMO', // Default for main domain
    name: 'FieldVibe Demo',
    domain: 'ss.gonxt.tech'
  },
  'localhost': {
    code: 'DEMO',
    name: 'Local Development',
    domain: 'localhost'
  },
  'work-1-otdktmkeksbigpch.prod-runtime.all-hands.dev': {
    code: 'DEMO',
    name: 'FieldVibe Development',
    domain: 'work-1-otdktmkeksbigpch.prod-runtime.all-hands.dev'
  },
  'work-1-vmhjvymxmtxtzzmm.prod-runtime.all-hands.dev': {
    code: 'DEMO',
    name: 'FieldVibe Development',
    domain: 'work-1-vmhjvymxmtxtzzmm.prod-runtime.all-hands.dev'
  }
}

class TenantService {
  private currentTenant: TenantConfig | null = null
  private tenantMappings: TenantMapping = DEFAULT_TENANT_MAPPINGS

  /**
   * Initialize tenant service and detect current tenant
   */
  async initialize(): Promise<TenantConfig> {
    if (this.currentTenant) {
      return this.currentTenant
    }

    // Try multiple detection strategies
    let tenant = await this.detectTenantFromDomain() ||
                 await this.detectTenantFromSubdomain() ||
                 await this.detectTenantFromPath() ||
                 await this.detectTenantFromQuery() ||
                 await this.detectTenantFromAPI() ||
                 this.getDefaultTenant()

    this.currentTenant = tenant
    await this.applyTenantConfiguration(tenant)
    
    return tenant
  }

  /**
   * Get current tenant configuration
   */
  getCurrentTenant(): TenantConfig | null {
    return this.currentTenant
  }

  /**
   * Get tenant code for API headers
   */
  getTenantCode(): string {
    return this.currentTenant?.code || 'DEMO'
  }

  /**
   * Strategy 1: Detect tenant from full domain
   */
  private async detectTenantFromDomain(): Promise<TenantConfig | null> {
    const hostname = window.location.hostname
    return this.tenantMappings[hostname] || null
  }

  /**
   * Strategy 2: Detect tenant from subdomain
   * e.g., demo.fieldvibe.com -> DEMO_SA
   */
  private async detectTenantFromSubdomain(): Promise<TenantConfig | null> {
    const hostname = window.location.hostname
    const parts = hostname.split('.')
    
    if (parts.length >= 3) {
      const subdomain = parts[0]
      const tenantCode = `${subdomain.toUpperCase()}_SA`
      
      // Check if we have a mapping for this subdomain
      const existingMapping = Object.values(this.tenantMappings)
        .find(tenant => tenant.code === tenantCode)
      
      if (existingMapping) {
        return existingMapping
      }

      // Create dynamic tenant config
      return {
        code: tenantCode,
        name: `${subdomain.charAt(0).toUpperCase() + subdomain.slice(1)} Tenant`,
        subdomain: subdomain,
        domain: hostname
      }
    }
    
    return null
  }

  /**
   * Strategy 3: Detect tenant from URL path
   * e.g., /tenant/demo/dashboard -> DEMO_SA
   */
  private async detectTenantFromPath(): Promise<TenantConfig | null> {
    const pathParts = window.location.pathname.split('/')
    
    if (pathParts[1] === 'tenant' && pathParts[2]) {
      const tenantSlug = pathParts[2]
      const tenantCode = `${tenantSlug.toUpperCase()}_SA`
      
      return {
        code: tenantCode,
        name: `${tenantSlug.charAt(0).toUpperCase() + tenantSlug.slice(1)} Tenant`,
        domain: window.location.hostname
      }
    }
    
    return null
  }

  /**
   * Strategy 4: Detect tenant from query parameter
   * e.g., ?tenant=DEMO_SA
   */
  private async detectTenantFromQuery(): Promise<TenantConfig | null> {
    const urlParams = new URLSearchParams(window.location.search)
    const tenantCode = urlParams.get('tenant')
    
    if (tenantCode) {
      return {
        code: tenantCode,
        name: `${tenantCode} Tenant`,
        domain: window.location.hostname
      }
    }
    
    return null
  }

  /**
   * Strategy 5: Detect tenant from API endpoint
   * Call backend to resolve tenant based on domain
   */
  private async detectTenantFromAPI(): Promise<TenantConfig | null> {
    try {
      const response = await fetch('/api/tenant/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          domain: window.location.hostname,
          path: window.location.pathname
        })
      })

      if (response.ok) {
        const tenantData = await response.json()
        return tenantData.data
      }
    } catch (error) {
      console.warn('Failed to resolve tenant from API:', error)
    }
    
    return null
  }

  /**
   * Get default tenant configuration
   */
  private getDefaultTenant(): TenantConfig {
    return {
      code: 'DEMO',
      name: 'Default Tenant',
      domain: window.location.hostname
    }
  }

  /**
   * Apply tenant-specific configuration (theme, branding, etc.)
   */
  private async applyTenantConfiguration(tenant: TenantConfig): Promise<void> {
    // Apply theme
    if (tenant.theme?.primaryColor) {
      document.documentElement.style.setProperty('--primary-color', tenant.theme.primaryColor)
    }

    // Update favicon
    if (tenant.theme?.favicon) {
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement
      if (favicon) {
        favicon.href = tenant.theme.favicon
      }
    }

    // Update page title
    if (tenant.name) {
      document.title = `${tenant.name} - FieldVibe`
    }

    // Store tenant info in localStorage for persistence
    localStorage.setItem('fieldvibe-tenant', JSON.stringify(tenant))
  }

  /**
   * Load tenant mappings from external source (API, config file, etc.)
   */
  async loadTenantMappings(): Promise<void> {
    try {
      const response = await fetch('/api/tenant/mappings')
      if (response.ok) {
        const mappings = await response.json()
        this.tenantMappings = { ...this.tenantMappings, ...mappings.data }
      }
    } catch (error) {
      console.warn('Failed to load tenant mappings:', error)
    }
  }

  /**
   * Update tenant mappings (for admin interface)
   */
  updateTenantMappings(mappings: TenantMapping): void {
    this.tenantMappings = { ...this.tenantMappings, ...mappings }
  }

  /**
   * Switch tenant (useful for admin users managing multiple tenants)
   */
  async switchTenant(tenantCode: string): Promise<TenantConfig | null> {
    const tenant = Object.values(this.tenantMappings)
      .find(t => t.code === tenantCode)

    if (tenant) {
      this.currentTenant = tenant
      await this.applyTenantConfiguration(tenant)
      
      // Reload the page to apply new tenant context
      window.location.reload()
      
      return tenant
    }

    return null
  }

  /**
   * Get all available tenants (for admin interface)
   */
  getAllTenants(): TenantConfig[] {
    return Object.values(this.tenantMappings)
  }
}

// Export singleton instance
export const tenantService = new TenantService()
export default tenantService