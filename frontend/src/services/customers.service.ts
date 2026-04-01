import { apiClient } from './api.service'
import { API_CONFIG } from '../config/api.config'

export interface Customer {
  id: string
  tenant_id: string
  name: string
  code: string
  type: 'retail' | 'wholesale' | 'distributor' | 'store'
  phone?: string
  email?: string
  address?: string
  latitude?: number
  longitude?: number
  route_id?: string
  credit_limit: number
  payment_terms: number
  status: 'active' | 'inactive' | 'suspended'
  created_at: string
  route_name?: string
  route_code?: string
  area_name?: string
  region_name?: string
  total_orders: number
  total_sales: number
}

export interface CustomerFilter {
  search?: string
  type?: string
  status?: string
  route_id?: string
  area_id?: string
  region_id?: string
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface CustomerStats {
  total_customers: number
  active_customers: number
  inactive_customers: number
  total_sales: number
  average_order_value: number
  top_customers: Customer[]
  customers_by_type: {
    retail: number
    wholesale: number
    distributor: number
  }
  customers_by_region: Array<{
    region: string
    count: number
    sales: number
  }>
}

class CustomersService {
  private readonly baseUrl = API_CONFIG.ENDPOINTS.CUSTOMERS.BASE

  async getCustomers(filter?: CustomerFilter): Promise<{ customers: Customer[], pagination: any }> {
    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.CUSTOMERS.BASE, { params: filter })
      return {
        customers: response.data.data?.customers || response.data.data || [],
        pagination: response.data.data?.pagination || {}
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error)
      throw error
    }
  }

  async getCustomer(id: string): Promise<Customer | null> {
    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.CUSTOMERS.BY_ID(id))
      return response.data.data?.customer || response.data.data
    } catch (error) {
      console.error('Failed to fetch customer:', error)
      return null
    }
  }

  async createCustomer(customer: Omit<Customer, 'id' | 'created_at' | 'total_orders' | 'total_sales'>): Promise<Customer> {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.CUSTOMERS.BASE, customer)
      return response.data.data
    } catch (error) {
      console.error('Failed to create customer:', error)
      throw error
    }
  }

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
    try {
      const response = await apiClient.put(API_CONFIG.ENDPOINTS.CUSTOMERS.BY_ID(id), updates)
      return response.data.data
    } catch (error) {
      console.error('Failed to update customer:', error)
      throw error
    }
  }

  async deleteCustomer(id: string): Promise<void> {
    try {
      await apiClient.delete(API_CONFIG.ENDPOINTS.CUSTOMERS.BY_ID(id))
    } catch (error) {
      console.error('Failed to delete customer:', error)
      throw error
    }
  }

  async getCustomerStats(): Promise<CustomerStats> {
    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.CUSTOMERS.STATS)
      return response.data.data
    } catch (error) {
      console.error('Failed to fetch customer stats:', error)
      throw error
    }
  }

  async getCustomerOrders(customerId: string, filter?: any): Promise<any[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${customerId}/orders`, { params: filter })
      return Array.isArray(response.data.data?.orders) ? response.data.data.orders : 
             Array.isArray(response.data.data) ? response.data.data : []
    } catch (error) {
      console.error('Failed to fetch customer orders:', error)
      return []
    }
  }

  async getCustomerTransactions(customerId: string, filter?: any): Promise<any[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${customerId}/transactions`, { params: filter })
      return response.data.data || []
    } catch (error) {
      console.error('Failed to fetch customer transactions:', error)
      return []
    }
  }

  async getCustomerVisits(customerId: string, filter?: any): Promise<any[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${customerId}/visits`, { params: filter })
      return Array.isArray(response.data.data) ? response.data.data : []
    } catch (error) {
      console.error('Failed to fetch customer visits:', error)
      return []
    }
  }

  async exportCustomers(filter?: CustomerFilter, format: 'csv' | 'excel' | 'pdf' = 'csv'): Promise<Blob> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/export`, {
        params: { ...filter, format },
        responseType: 'blob'
      })
      return response.data
    } catch (error) {
      console.error('Failed to export customers:', error)
      throw error
    }
  }

  async bulkUpdateCustomers(updates: Array<{ id: string; updates: Partial<Customer> }>): Promise<Customer[]> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/bulk`, { updates })
      return response.data.data
    } catch (error) {
      console.error('Failed to bulk update customers:', error)
      throw error
    }
  }

  async importCustomers(file: File): Promise<{ success: number; errors: any[] }> {
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await apiClient.post(`${this.baseUrl}/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      return response.data.data
    } catch (error) {
      console.error('Failed to import customers:', error)
      throw error
    }
  }

}

export const customersService = new CustomersService()
