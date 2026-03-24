import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'

// Mock auth store
const mockAuthStore = {
  user: {
    id: 1,
    name: 'Test User',
    email: 'test@example.com',
    role: 'admin'
  },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  initialize: vi.fn(),
}

// Mock useAuthStore hook
vi.mock('../../store/auth.store', () => ({
  useAuthStore: () => mockAuthStore
}))

// Custom render function that includes providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

// Transaction creation utilities for testing
export const createMockTransaction = (overrides = {}) => ({
  id: 'TXN-001',
  type: 'sale',
  amount: 1500.00,
  currency: 'USD',
  status: 'completed',
  customerId: 'CUST-001',
  customerName: 'ABC Electronics',
  agentId: 'AGT-001',
  agentName: 'John Smith',
  products: [
    {
      id: 'PROD-001',
      name: 'Wireless Headphones',
      quantity: 2,
      unitPrice: 750.00,
      totalPrice: 1500.00
    }
  ],
  location: {
    address: '123 Main St, New York, NY',
    coordinates: { lat: 40.7128, lng: -74.0060 }
  },
  timestamp: new Date().toISOString(),
  notes: 'Successful sale with customer satisfaction',
  ...overrides
})

export const createMockCustomer = (overrides = {}) => ({
  id: 'CUST-001',
  name: 'ABC Electronics',
  email: 'contact@abcelectronics.com',
  phone: '+1-555-0123',
  address: '123 Main St, New York, NY 10001',
  type: 'retail',
  status: 'active',
  creditLimit: 50000,
  currentBalance: 12500,
  lastOrderDate: '2024-01-15',
  totalOrders: 45,
  totalSpent: 125000,
  assignedAgent: 'John Smith',
  ...overrides
})

export const createMockAgent = (overrides = {}) => ({
  id: 'AGT-001',
  name: 'John Smith',
  email: 'john.smith@company.com',
  phone: '+1-555-0101',
  role: 'senior_agent',
  status: 'active',
  route: 'Manhattan North',
  location: {
    lat: 40.7589,
    lng: -73.9851,
    address: '123 Main St, New York, NY',
    lastUpdate: new Date().toISOString()
  },
  performance: {
    visitsToday: 8,
    salesToday: 2500,
    distanceToday: 45.2,
    efficiency: 92
  },
  device: {
    battery: 85,
    signal: 4,
    lastSync: new Date().toISOString()
  },
  ...overrides
})

export const createMockProduct = (overrides = {}) => ({
  id: 'PROD-001',
  name: 'Wireless Headphones',
  sku: 'WH-001',
  category: 'Electronics',
  brand: 'TechBrand',
  price: 750.00,
  cost: 450.00,
  stock: 150,
  minStock: 20,
  status: 'active',
  description: 'High-quality wireless headphones with noise cancellation',
  specifications: {
    color: 'Black',
    weight: '250g',
    batteryLife: '30 hours'
  },
  ...overrides
})

export const createMockBoardPlacement = (overrides = {}) => ({
  id: 'BB-001',
  boardId: 'BB-001',
  type: 'billboard',
  location: {
    address: '123 Main St, New York, NY',
    description: 'Near Central Station',
    coordinates: { lat: 40.7128, lng: -74.0060 }
  },
  campaign: {
    id: 'CAMP-001',
    name: 'Summer Sale 2024',
    client: 'Fashion Retailer Inc'
  },
  agent: {
    id: 'AGT-001',
    name: 'John Smith'
  },
  status: 'active',
  placementDate: '2024-06-15',
  lastVerified: '2024-06-20',
  performance: {
    visibilityScore: 92,
    estimatedImpressions: 45000,
    costPerImpression: 0.02
  },
  photos: {
    before: 'photo1.jpg',
    after: 'photo2.jpg',
    current: 'photo3.jpg'
  },
  ...overrides
})

// API response mocks
export const mockApiResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data))
})

export const mockApiError = (message = 'API Error', status = 500) => ({
  ok: false,
  status,
  json: () => Promise.resolve({ error: message }),
  text: () => Promise.resolve(JSON.stringify({ error: message }))
})

// Test data generators
export const generateTransactions = (count = 10) => {
  return Array.from({ length: count }, (_, index) => 
    createMockTransaction({
      id: `TXN-${String(index + 1).padStart(3, '0')}`,
      amount: Math.random() * 5000 + 100,
      customerId: `CUST-${String(Math.floor(Math.random() * 50) + 1).padStart(3, '0')}`,
      agentId: `AGT-${String(Math.floor(Math.random() * 10) + 1).padStart(3, '0')}`
    })
  )
}

export const generateCustomers = (count = 20) => {
  const customerTypes = ['retail', 'wholesale', 'distributor']
  const statuses = ['active', 'inactive', 'pending']
  
  return Array.from({ length: count }, (_, index) => 
    createMockCustomer({
      id: `CUST-${String(index + 1).padStart(3, '0')}`,
      name: `Customer ${index + 1}`,
      type: customerTypes[Math.floor(Math.random() * customerTypes.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      totalSpent: Math.random() * 100000 + 10000
    })
  )
}

export const generateAgents = (count = 5) => {
  const routes = ['Manhattan North', 'Manhattan South', 'Brooklyn', 'Queens', 'Bronx']
  const statuses = ['active', 'inactive', 'offline']
  
  return Array.from({ length: count }, (_, index) => 
    createMockAgent({
      id: `AGT-${String(index + 1).padStart(3, '0')}`,
      name: `Agent ${index + 1}`,
      route: routes[index % routes.length],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      performance: {
        visitsToday: Math.floor(Math.random() * 15) + 1,
        salesToday: Math.random() * 5000 + 500,
        distanceToday: Math.random() * 100 + 20,
        efficiency: Math.floor(Math.random() * 40) + 60
      }
    })
  )
}