import { apiClient } from './api.service'

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
  status: 'active' | 'inactive' | 'suspended'
  last_login?: string
  created_at: string
  tenant_id: string
}

class UsersService {
  async getUsers(params?: { search?: string; role?: string; status?: string; page?: number; limit?: number }): Promise<{ users: User[]; total: number }> {
    try {
      const response = await apiClient.get('/users', { params })
      const data = response.data.data || response.data
      return {
        users: Array.isArray(data) ? data : data?.users || [],
        total: data?.total || (Array.isArray(data) ? data.length : 0)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
      return { users: [], total: 0 }
    }
  }

  async getUser(id: string): Promise<User | null> {
    try {
      const response = await apiClient.get(`/users/${id}`)
      return response.data.data || null
    } catch (error) {
      console.error('Failed to fetch user:', error)
      return null
    }
  }

  async createUser(user: Partial<User>): Promise<User> {
    const response = await apiClient.post('/users', user)
    return response.data.data
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const response = await apiClient.put(`/users/${id}`, updates)
    return response.data.data
  }

  async deleteUser(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}`)
  }

  async getTeamLeaders(): Promise<User[]> {
    try {
      const response = await apiClient.get('/users', { params: { role: 'team_leader' } })
      const data = response.data.data || response.data
      return Array.isArray(data) ? data : data?.users || []
    } catch (error) {
      console.error('Failed to fetch team leaders:', error)
      return []
    }
  }
}

export const usersService = new UsersService()
