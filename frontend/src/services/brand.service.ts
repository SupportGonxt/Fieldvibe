import { apiClient } from './api'

export interface Brand {
  id: string
  name: string
  code: string
  description?: string
  status: 'active' | 'inactive'
  product_count?: number
  survey_count?: number
  activation_count?: number
  created_at?: string
  updated_at?: string
}

export interface BrandFormData {
  name: string
  code: string
  description?: string
  status: 'active' | 'inactive'
}

export const brandService = {
  async getBrands(params?: { search?: string; status?: string }): Promise<Brand[]> {
    const response = await apiClient.get('/brands', { params })
    const brandsData = response.data.data?.brands || response.data.data || response.data || []
    return Array.isArray(brandsData) ? brandsData : []
  },

  async getBrand(id: string): Promise<Brand> {
    const response = await apiClient.get(`/brands/${id}`)
    return response.data?.data || response.data
  },

  async createBrand(data: BrandFormData): Promise<Brand> {
    const response = await apiClient.post('/brands', data)
    return response.data?.data || response.data
  },

  async updateBrand(id: string, data: BrandFormData): Promise<Brand> {
    const response = await apiClient.put(`/brands/${id}`, data)
    return response.data?.data || response.data
  },

  async deleteBrand(id: string): Promise<void> {
    await apiClient.delete(`/brands/${id}`)
  },

  async getBrandSurveys(brandId: string): Promise<any[]> {
    const response = await apiClient.get(`/brands/${brandId}/surveys`)
    return response.data?.data || response.data
  },

  async getBrandActivations(brandId: string): Promise<any[]> {
    const response = await apiClient.get(`/brands/${brandId}/activations`)
    return response.data?.data || response.data
  },

  async getBrandBoards(brandId: string): Promise<any[]> {
    const response = await apiClient.get(`/brands/${brandId}/boards`)
    return response.data?.data || response.data
  },

  async getBrandProducts(brandId: string): Promise<any[]> {
    const response = await apiClient.get(`/brands/${brandId}/products`)
    return response.data?.data || response.data
  },
}
