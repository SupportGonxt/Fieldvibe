import { apiClient } from './api.service'

export interface PriceList {
  id: string
  tenant_id: string
  name: string
  description?: string
  customer_type?: string
  region_id?: string
  area_id?: string
  channel?: string
  currency: string
  effective_start: string
  effective_end?: string
  is_active: boolean
  priority: number
  created_at: string
  updated_at: string
}

export interface PriceListItem {
  id: string
  price_list_id: string
  product_id: string
  product_name?: string
  product_code?: string
  price: number
  min_quantity?: number
  max_quantity?: number
  discount_percentage?: number
  created_at: string
  updated_at: string
}

export interface PriceListWithItems extends PriceList {
  items: PriceListItem[]
}

export interface PriceListFilter {
  customer_type?: string
  region_id?: string
  area_id?: string
  channel?: string
  currency?: string
  is_active?: boolean
  search?: string
}

class PricingService {
  async getPriceLists(filter?: PriceListFilter): Promise<PriceList[]> {
    try {
      const response = await apiClient.get('/price-lists', { params: filter })
      return response.data.data || []
    } catch (error) {
      console.error('Failed to fetch price lists:', error)
      throw error
    }
  }

  async getPriceList(id: string): Promise<PriceListWithItems | null> {
    try {
      const response = await apiClient.get(`/price-lists/${id}`)
      return response.data.data
    } catch (error) {
      console.error('Failed to fetch price list:', error)
      return null
    }
  }

  async createPriceList(data: Omit<PriceList, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<PriceList> {
    try {
      const response = await apiClient.post('/price-lists', data)
      return response.data.data
    } catch (error) {
      console.error('Failed to create price list:', error)
      throw error
    }
  }

  async updatePriceList(id: string, data: Partial<PriceList>): Promise<PriceList> {
    try {
      const response = await apiClient.put(`/price-lists/${id}`, data)
      return response.data.data
    } catch (error) {
      console.error('Failed to update price list:', error)
      throw error
    }
  }

  async deletePriceList(id: string): Promise<void> {
    try {
      await apiClient.delete(`/price-lists/${id}`)
    } catch (error) {
      console.error('Failed to delete price list:', error)
      throw error
    }
  }

  async updatePriceListItems(priceListId: string, items: Array<Omit<PriceListItem, 'id' | 'price_list_id' | 'created_at' | 'updated_at'>>): Promise<PriceListItem[]> {
    try {
      const response = await apiClient.post(`/price-lists/${priceListId}/items`, { items })
      return response.data.data
    } catch (error) {
      console.error('Failed to update price list items:', error)
      throw error
    }
  }

  async getCustomerPrices(customerId: string): Promise<Array<{ product_id: string; resolved_price: number; source: string }>> {
    try {
      const response = await apiClient.get('/pricing/customer-prices', {
        params: { customer_id: customerId }
      })
      return response.data.data || []
    } catch (error) {
      console.error('Failed to fetch customer prices:', error)
      return []
    }
  }

  async getProductPrice(productId: string, customerId?: string, quantity?: number): Promise<any> {
    try {
      const response = await apiClient.get('/pricing/quote', {
        params: { product_id: productId, customer_id: customerId, quantity }
      })
      return response.data.data
    } catch (error) {
      console.error('Failed to get product price:', error)
      throw error
    }
  }

  async getBulkPrices(items: Array<{ product_id: string; quantity: number }>, customerId?: string): Promise<any[]> {
    try {
      const response = await apiClient.post('/pricing/bulk-quote', {
        items,
        customer_id: customerId
      })
      return response.data.data
    } catch (error) {
      console.error('Failed to get bulk prices:', error)
      throw error
    }
  }
}

export const pricingService = new PricingService()
