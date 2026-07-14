// Guards transactionService's real contract: URLs built from the config
// baseUrl, filters passed through as axios params, `data.data`-or-`data`
// unwrapping, and the error policy — reads degrade (null / [] / zeroed
// summary) while writes rethrow so callers can surface the failure.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../services/api.service', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import { apiClient } from '../../services/api.service'
import { transactionService } from '../../services/transaction.service'

const getMock = apiClient.get as ReturnType<typeof vi.fn>
const postMock = apiClient.post as ReturnType<typeof vi.fn>
const putMock = apiClient.put as ReturnType<typeof vi.fn>

const wrapped = (data: any) => ({ data: { data } })

describe('transactionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getTransactions', () => {
    it('passes the filter through as params and unwraps data.data', async () => {
      const rows = [{ id: 'TXN-001' }, { id: 'TXN-002' }]
      getMock.mockResolvedValue(wrapped(rows))

      const filter = { status: 'completed', agent_id: 'AGT-001' } as any
      const result = await transactionService.getTransactions(filter)

      expect(getMock).toHaveBeenCalledWith('/transactions', { params: filter })
      expect(result).toEqual(rows)
    })

    it('falls back to a plain data payload when there is no data.data envelope', async () => {
      const rows = [{ id: 'TXN-001' }]
      getMock.mockResolvedValue({ data: rows })

      expect(await transactionService.getTransactions()).toEqual(rows)
    })

    it('rethrows fetch errors', async () => {
      getMock.mockRejectedValue(new Error('API Error'))
      await expect(transactionService.getTransactions()).rejects.toThrow('API Error')
    })
  })

  describe('getTransaction', () => {
    it('fetches by id', async () => {
      const row = { id: 'TXN-001' }
      getMock.mockResolvedValue(wrapped(row))

      expect(await transactionService.getTransaction('TXN-001')).toEqual(row)
      expect(getMock).toHaveBeenCalledWith('/transactions/TXN-001')
    })

    it('returns null instead of throwing when the fetch fails', async () => {
      getMock.mockRejectedValue(new Error('not found'))
      expect(await transactionService.getTransaction('NOPE')).toBeNull()
    })
  })

  describe('createTransaction', () => {
    it('posts to the base url and unwraps the created row', async () => {
      const created = { id: 'TXN-100', amount: 1500 }
      postMock.mockResolvedValue(wrapped(created))

      const body = { amount: 1500, type: 'forward' } as any
      expect(await transactionService.createTransaction(body)).toEqual(created)
      expect(postMock).toHaveBeenCalledWith('/transactions', body)
    })

    it('rethrows create errors', async () => {
      postMock.mockRejectedValue(new Error('Failed to create transaction'))
      await expect(transactionService.createTransaction({} as any))
        .rejects.toThrow('Failed to create transaction')
    })
  })

  describe('updateTransaction', () => {
    it('puts partial updates to the id url', async () => {
      const updated = { id: 'TXN-001', amount: 2000 }
      putMock.mockResolvedValue(wrapped(updated))

      expect(await transactionService.updateTransaction('TXN-001', { amount: 2000 } as any))
        .toEqual(updated)
      expect(putMock).toHaveBeenCalledWith('/transactions/TXN-001', { amount: 2000 })
    })
  })

  describe('createReverseTransaction', () => {
    it('posts the reversal to /:id/reverse using the request transaction_id', async () => {
      const reversed = { id: 'TXN-001', status: 'reversed' }
      postMock.mockResolvedValue(wrapped(reversed))

      const request = { transaction_id: 'TXN-001', reason: 'Customer request' } as any
      expect(await transactionService.createReverseTransaction(request)).toEqual(reversed)
      expect(postMock).toHaveBeenCalledWith('/transactions/TXN-001/reverse', request)
    })
  })

  describe('getTransactionSummary', () => {
    it('unwraps the summary payload', async () => {
      const summary = { total_transactions: 5, total_amount: 7500 }
      getMock.mockResolvedValue(wrapped(summary))

      expect(await transactionService.getTransactionSummary()).toEqual(summary)
      expect(getMock).toHaveBeenCalledWith('/transactions/summary', { params: undefined })
    })

    it('degrades to a zeroed summary when the fetch fails', async () => {
      getMock.mockRejectedValue(new Error('boom'))

      const summary = await transactionService.getTransactionSummary()
      expect(summary.total_transactions).toBe(0)
      expect(summary.total_amount).toBe(0)
      expect(summary.forward_transactions).toEqual({ count: 0, amount: 0 })
    })
  })
})
