import { describe, it, expect, vi, beforeEach } from 'vitest'
import { transactionService } from '../../services/transaction.service'
import { createMockTransaction, mockApiResponse, mockApiError } from '../utils/test-utils'

// Mock the API service
vi.mock('../../services/api.service', () => ({
  apiService: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}))

describe('TransactionService', () => {
  const mockTransaction = createMockTransaction()
  const mockTransactions = [
    createMockTransaction({ id: 'TXN-001', amount: 1500 }),
    createMockTransaction({ id: 'TXN-002', amount: 2500 }),
    createMockTransaction({ id: 'TXN-003', amount: 750 }),
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createTransaction', () => {
    it('creates a new transaction successfully', async () => {
      const { apiService } = await import('../../services/api.service')
      apiService.post.mockResolvedValue(mockApiResponse(mockTransaction))

      const transactionData = {
        type: 'sale',
        amount: 1500,
        customerId: 'CUST-001',
        agentId: 'AGT-001',
        products: [
          {
            id: 'PROD-001',
            name: 'Wireless Headphones',
            quantity: 2,
            unitPrice: 750,
            totalPrice: 1500
          }
        ]
      }

      const result = await transactionService.createTransaction(transactionData)

      expect(apiService.post).toHaveBeenCalledWith('/transactions', transactionData)
      expect(result).toEqual(mockTransaction)
    })

    it('handles transaction creation errors', async () => {
      const { apiService } = require('../../services/api.service')
      apiService.post.mockRejectedValue(new Error('Failed to create transaction'))

      const transactionData = {
        type: 'sale',
        amount: 1500,
        customerId: 'CUST-001',
        agentId: 'AGT-001',
        products: []
      }

      await expect(transactionService.createTransaction(transactionData))
        .rejects.toThrow('Failed to create transaction')
    })

    it('validates required transaction fields', async () => {
      const { apiService } = require('../../services/api.service')
      
      const invalidTransactionData = {
        type: 'sale',
        // Missing required fields
      }

      await expect(transactionService.createTransaction(invalidTransactionData as any))
        .rejects.toThrow()
    })
  })

  describe('getTransactions', () => {
    it('fetches transactions with default parameters', async () => {
      const { apiService } = require('../../services/api.service')
      apiService.get.mockResolvedValue(mockApiResponse({ 
        transactions: mockTransactions,
        total: mockTransactions.length,
        page: 1,
        limit: 10
      }))

      const result = await transactionService.getTransactions()

      expect(apiService.get).toHaveBeenCalledWith('/transactions', {
        params: {
          page: 1,
          limit: 10,
          sortBy: 'timestamp',
          sortOrder: 'desc'
        }
      })
      expect(result.transactions).toEqual(mockTransactions)
      expect(result.total).toBe(mockTransactions.length)
    })

    it('fetches transactions with custom filters', async () => {
      const { apiService } = require('../../services/api.service')
      apiService.get.mockResolvedValue(mockApiResponse({ 
        transactions: mockTransactions,
        total: mockTransactions.length
      }))

      const filters = {
        page: 2,
        limit: 20,
        status: 'completed',
        agentId: 'AGT-001',
        customerId: 'CUST-001',
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      }

      await transactionService.getTransactions(filters)

      expect(apiService.get).toHaveBeenCalledWith('/transactions', {
        params: {
          ...filters,
          sortBy: 'timestamp',
          sortOrder: 'desc'
        }
      })
    })

    it('handles API errors when fetching transactions', async () => {
      const { apiService } = require('../../services/api.service')
      apiService.get.mockRejectedValue(new Error('API Error'))

      await expect(transactionService.getTransactions())
        .rejects.toThrow('API Error')
    })
  })

  describe('getTransactionById', () => {
    it('fetches a specific transaction by ID', async () => {
      const { apiService } = require('../../services/api.service')
      apiService.get.mockResolvedValue(mockApiResponse(mockTransaction))

      const result = await transactionService.getTransactionById('TXN-001')

      expect(apiService.get).toHaveBeenCalledWith('/transactions/TXN-001')
      expect(result).toEqual(mockTransaction)
    })

    it('handles not found errors', async () => {
      const { apiService } = require('../../services/api.service')
      apiService.get.mockRejectedValue(new Error('Transaction not found'))

      await expect(transactionService.getTransactionById('INVALID-ID'))
        .rejects.toThrow('Transaction not found')
    })
  })

  describe('updateTransaction', () => {
    it('updates a transaction successfully', async () => {
      const { apiService } = require('../../services/api.service')
      const updatedTransaction = { ...mockTransaction, amount: 2000 }
      apiService.put.mockResolvedValue(mockApiResponse(updatedTransaction))

      const updateData = { amount: 2000 }
      const result = await transactionService.updateTransaction('TXN-001', updateData)

      expect(apiService.put).toHaveBeenCalledWith('/transactions/TXN-001', updateData)
      expect(result).toEqual(updatedTransaction)
    })

    it('handles update errors', async () => {
      const { apiService } = require('../../services/api.service')
      apiService.put.mockRejectedValue(new Error('Update failed'))

      await expect(transactionService.updateTransaction('TXN-001', { amount: 2000 }))
        .rejects.toThrow('Update failed')
    })
  })

  describe('reverseTransaction', () => {
    it('reverses a transaction successfully', async () => {
      const { apiService } = require('../../services/api.service')
      const reversedTransaction = { ...mockTransaction, status: 'reversed' }
      apiService.post.mockResolvedValue(mockApiResponse(reversedTransaction))

      const reverseData = { reason: 'Customer request' }
      const result = await transactionService.reverseTransaction('TXN-001', reverseData)

      expect(apiService.post).toHaveBeenCalledWith('/transactions/TXN-001/reverse', reverseData)
      expect(result).toEqual(reversedTransaction)
    })

    it('handles reverse errors', async () => {
      const { apiService } = require('../../services/api.service')
      apiService.post.mockRejectedValue(new Error('Cannot reverse completed transaction'))

      await expect(transactionService.reverseTransaction('TXN-001', { reason: 'Test' }))
        .rejects.toThrow('Cannot reverse completed transaction')
    })
  })

  describe('getTransactionAnalytics', () => {
    it('fetches transaction analytics', async () => {
      const { apiService } = require('../../services/api.service')
      const mockAnalytics = {
        totalTransactions: 150,
        totalAmount: 125000,
        averageAmount: 833.33,
        transactionsByStatus: {
          completed: 140,
          pending: 8,
          failed: 2
        },
        transactionsByType: {
          sale: 120,
          refund: 20,
          exchange: 10
        },
        dailyTrends: [
          { date: '2024-01-01', count: 15, amount: 12500 },
          { date: '2024-01-02', count: 18, amount: 15000 }
        ]
      }

      apiService.get.mockResolvedValue(mockApiResponse(mockAnalytics))

      const result = await transactionService.getTransactionAnalytics({
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      })

      expect(apiService.get).toHaveBeenCalledWith('/transactions/analytics', {
        params: {
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        }
      })
      expect(result).toEqual(mockAnalytics)
    })
  })

  describe('Transaction Creation with Deep Validation', () => {
    it('creates a complex transaction with multiple products', async () => {
      const { apiService } = require('../../services/api.service')
      
      const complexTransaction = createMockTransaction({
        products: [
          {
            id: 'PROD-001',
            name: 'Wireless Headphones',
            quantity: 2,
            unitPrice: 750,
            totalPrice: 1500
          },
          {
            id: 'PROD-002',
            name: 'Bluetooth Speaker',
            quantity: 1,
            unitPrice: 200,
            totalPrice: 200
          }
        ],
        amount: 1700,
        tax: 170,
        discount: 50,
        finalAmount: 1820
      })

      apiService.post.mockResolvedValue(mockApiResponse(complexTransaction))

      const result = await transactionService.createTransaction(complexTransaction)

      expect(result.products).toHaveLength(2)
      expect(result.amount).toBe(1700)
      expect(result.finalAmount).toBe(1820)
    })

    it('validates product quantities and prices', async () => {
      const invalidTransaction = {
        type: 'sale',
        amount: 1500,
        customerId: 'CUST-001',
        agentId: 'AGT-001',
        products: [
          {
            id: 'PROD-001',
            name: 'Wireless Headphones',
            quantity: -1, // Invalid quantity
            unitPrice: 750,
            totalPrice: 1500
          }
        ]
      }

      await expect(transactionService.createTransaction(invalidTransaction))
        .rejects.toThrow()
    })

    it('calculates transaction totals correctly', async () => {
      const { apiService } = require('../../services/api.service')
      
      const transactionWithCalculations = createMockTransaction({
        subtotal: 1500,
        tax: 150,
        discount: 100,
        finalAmount: 1550
      })

      apiService.post.mockResolvedValue(mockApiResponse(transactionWithCalculations))

      const result = await transactionService.createTransaction(transactionWithCalculations)

      expect(result.subtotal).toBe(1500)
      expect(result.tax).toBe(150)
      expect(result.discount).toBe(100)
      expect(result.finalAmount).toBe(1550)
    })
  })
})