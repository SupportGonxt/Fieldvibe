import { ApiService, buildUrl } from './api.service'

export interface TransactionItem {
  id?: string
  product_id: string
  quantity: number
  unit_price: number
  discount_amount?: number
  tax_amount?: number
  line_total?: number
  product_name?: string
  product_sku?: string
  original_item_id?: string
}

export interface Payment {
  id?: string
  payment_method: string
  amount: number
  currency_id: string
  reference_number?: string
  payment_date?: string
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  payment_type?: 'payment' | 'refund'
  currency_code?: string
  currency_symbol?: string
}

export interface TransactionHistory {
  id: string
  action: string
  old_status: string
  new_status: string
  user_id: string
  notes?: string
  created_at: string
  amount?: number
  user_name?: string
}

export interface Transaction {
  id: string
  transaction_number: string
  transaction_type: 'sale' | 'return' | 'refund' | 'exchange' | 'payment' | 'credit' | 'debit' | 'adjustment'
  customer_id: string
  agent_id: string
  total_amount: number
  currency_id: string
  payment_method: 'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'credit' | 'voucher'
  payment_status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded'
  transaction_date: string
  status: 'draft' | 'pending' | 'completed' | 'cancelled' | 'reversed'
  notes?: string
  subtotal?: number
  discount_amount?: number
  tax_amount?: number
  completed_at?: string
  completion_notes?: string
  reversed_at?: string
  reversal_reason?: string
  original_transaction_id?: string
  
  // Joined fields
  customer_name?: string
  customer_address?: string
  customer_phone?: string
  agent_name?: string
  currency_code?: string
  currency_symbol?: string
  decimal_places?: number
  item_count?: number
  payment_count?: number
  total_paid?: number
  
  // Related data
  items?: TransactionItem[]
  payments?: Payment[]
  history?: TransactionHistory[]
}

export interface TransactionFilters {
  transaction_type?: string
  customer_id?: string
  agent_id?: string
  status?: string
  payment_status?: string
  payment_method?: string
  date_from?: string
  date_to?: string
  amount_min?: number
  amount_max?: number
  limit?: number
  offset?: number
}

export interface TransactionsPaginated {
  transactions: Transaction[]
  pagination: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
}

export interface RefundRequest {
  refund_amount: number
  reason: string
  refund_method?: string
  items_to_refund?: Array<{
    item_id: string
    quantity: number
  }>
}

export interface RefundResponse {
  refund_transaction_id: string
  refund_number: string
  refund_amount: number
  message: string
}

export interface TransactionsDashboard {
  transactionStats: {
    total_transactions: number
    completed_transactions: number
    pending_transactions: number
    cancelled_transactions: number
    reversed_transactions: number
    total_revenue: number
    avg_transaction_value: number
  }
  paymentStats: {
    total_payments: number
    successful_payments: number
    failed_payments: number
    total_payments_amount: number
  }
  transactionsByType: Array<{
    transaction_type: string
    count: number
    total_amount: number
  }>
  paymentMethods: Array<{
    payment_method: string
    count: number
    total_amount: number
  }>
  recentTransactions: Array<{
    id: string
    transaction_number: string
    transaction_type: string
    total_amount: number
    status: string
    payment_status: string
    transaction_date: string
    customer_name?: string
    currency_symbol?: string
  }>
  dailyTrends: Array<{
    date: string
    transaction_count: number
    daily_revenue: number
  }>
}

class ComprehensiveTransactionsService extends ApiService {
  private readonly baseUrl = '/comprehensive-transactions'

  // Get all transactions with advanced filtering
  async getTransactions(filters?: TransactionFilters) {
    const url = buildUrl(`${this.baseUrl}/transactions`, filters)
    const response = await this.get<{ data: TransactionsPaginated }>(url)
    return response.data.data
  }

  // Create a new transaction
  async createTransaction(data: {
    transaction_type: string
    customer_id: string
    agent_id: string
    currency_id: string
    payment_method?: string
    items: Array<{
      product_id: string
      quantity: number
      unit_price: number
      discount_amount?: number
      tax_amount?: number
    }>
    notes?: string
  }) {
    const response = await this.post<{ data: { id: string, transaction_number: string, total_amount: number, message: string } }>(`${this.baseUrl}/transactions`, data)
    return response.data.data
  }

  // Get transaction details
  async getTransaction(transactionId: string) {
    const response = await this.get<{ data: { transaction: Transaction } }>(`${this.baseUrl}/transactions/${transactionId}`)
    return response.data.data.transaction
  }

  // Complete a transaction
  async completeTransaction(transactionId: string, data?: {
    payment_details?: {
      amount: number
      payment_method: string
      reference_number?: string
    }
    notes?: string
  }) {
    const response = await this.put(`${this.baseUrl}/transactions/${transactionId}/complete`, data)
    return response.data?.data || response.data
  }

  // Process a refund for a transaction
  async refundTransaction(transactionId: string, refundData: RefundRequest) {
    const response = await this.post<{ data: RefundResponse }>(`${this.baseUrl}/transactions/${transactionId}/refund`, refundData)
    return response.data.data
  }

  // Reverse a transaction
  async reverseTransaction(transactionId: string, reason: string) {
    const response = await this.put(`${this.baseUrl}/transactions/${transactionId}/reverse`, { reason })
    return response.data?.data || response.data
  }

  // Get comprehensive transactions dashboard data
  async getDashboard() {
    const response = await this.get<{ data: TransactionsDashboard }>(`${this.baseUrl}/dashboard`)
    return response.data.data
  }

  // Utility functions for transaction calculations
  static calculateLineTotal(item: TransactionItem): number {
    const subtotal = item.quantity * item.unit_price
    const discount = item.discount_amount || 0
    const tax = item.tax_amount || 0
    return subtotal - discount + tax
  }

  static calculateTransactionTotal(items: TransactionItem[]): {
    subtotal: number
    totalDiscount: number
    totalTax: number
    total: number
  } {
    let subtotal = 0
    let totalDiscount = 0
    let totalTax = 0

    items.forEach(item => {
      subtotal += item.quantity * item.unit_price
      totalDiscount += item.discount_amount || 0
      totalTax += item.tax_amount || 0
    })

    const total = subtotal - totalDiscount + totalTax

    return {
      subtotal,
      totalDiscount,
      totalTax,
      total
    }
  }

  // Validate transaction data
  static validateTransaction(data: {
    transaction_type: string
    customer_id: string
    agent_id: string
    currency_id: string
    items: TransactionItem[]
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!data.transaction_type) {
      errors.push('Transaction type is required')
    }

    if (!data.customer_id) {
      errors.push('Customer is required')
    }

    if (!data.agent_id) {
      errors.push('Agent is required')
    }

    if (!data.currency_id) {
      errors.push('Currency is required')
    }

    if (!data.items || data.items.length === 0) {
      errors.push('At least one item is required')
    } else {
      data.items.forEach((item, index) => {
        if (!item.product_id) {
          errors.push(`Item ${index + 1}: Product is required`)
        }
        if (!item.quantity || item.quantity <= 0) {
          errors.push(`Item ${index + 1}: Valid quantity is required`)
        }
        if (!item.unit_price || item.unit_price < 0) {
          errors.push(`Item ${index + 1}: Valid unit price is required`)
        }
      })
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // Format transaction status for display
  static formatTransactionStatus(status: string): { label: string; color: string } {
    const statusMap: Record<string, { label: string; color: string }> = {
      draft: { label: 'Draft', color: 'gray' },
      pending: { label: 'Pending', color: 'yellow' },
      completed: { label: 'Completed', color: 'green' },
      cancelled: { label: 'Cancelled', color: 'red' },
      reversed: { label: 'Reversed', color: 'red' }
    }

    return statusMap[status] || { label: status, color: 'gray' }
  }

  // Format payment status for display
  static formatPaymentStatus(status: string): { label: string; color: string } {
    const statusMap: Record<string, { label: string; color: string }> = {
      pending: { label: 'Pending', color: 'yellow' },
      completed: { label: 'Paid', color: 'green' },
      failed: { label: 'Failed', color: 'red' },
      cancelled: { label: 'Cancelled', color: 'red' },
      refunded: { label: 'Refunded', color: 'orange' },
      partially_refunded: { label: 'Partially Refunded', color: 'orange' }
    }

    return statusMap[status] || { label: status, color: 'gray' }
  }

  // Get transaction type options
  static getTransactionTypes(): Array<{ value: string; label: string }> {
    return [
      { value: 'sale', label: 'Sale' },
      { value: 'return', label: 'Return' },
      { value: 'refund', label: 'Refund' },
      { value: 'exchange', label: 'Exchange' },
      { value: 'payment', label: 'Payment' },
      { value: 'credit', label: 'Credit' },
      { value: 'debit', label: 'Debit' },
      { value: 'adjustment', label: 'Adjustment' }
    ]
  }

  // Get payment method options
  static getPaymentMethods(): Array<{ value: string; label: string }> {
    return [
      { value: 'cash', label: 'Cash' },
      { value: 'card', label: 'Card' },
      { value: 'mobile_money', label: 'Mobile Money' },
      { value: 'bank_transfer', label: 'Bank Transfer' },
      { value: 'credit', label: 'Credit' },
      { value: 'voucher', label: 'Voucher' }
    ]
  }

  // Check if transaction can be refunded
  static canRefund(transaction: Transaction): boolean {
    return transaction.status === 'completed' && 
           transaction.payment_status === 'completed' &&
           transaction.transaction_type !== 'refund'
  }

  // Check if transaction can be reversed
  static canReverse(transaction: Transaction): boolean {
    return transaction.status !== 'reversed' && 
           transaction.status !== 'cancelled'
  }

  // Calculate available refund amount
  static getAvailableRefundAmount(transaction: Transaction): number {
    const totalPaid = transaction.total_paid || 0
    // In a real implementation, you'd subtract any previous refunds
    return totalPaid
  }

  // Generate transaction receipt data
  static generateReceiptData(transaction: Transaction): {
    header: any
    items: any[]
    totals: any
    payments: any[]
    footer: any
  } {
    return {
      header: {
        transaction_number: transaction.transaction_number,
        transaction_date: transaction.transaction_date,
        customer_name: transaction.customer_name,
        agent_name: transaction.agent_name
      },
      items: transaction.items?.map(item => ({
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount_amount || 0,
        tax: item.tax_amount || 0,
        total: item.line_total || this.calculateLineTotal(item)
      })) || [],
      totals: {
        subtotal: transaction.subtotal || 0,
        discount: transaction.discount_amount || 0,
        tax: transaction.tax_amount || 0,
        total: transaction.total_amount
      },
      payments: transaction.payments?.map(payment => ({
        method: payment.payment_method,
        amount: payment.amount,
        reference: payment.reference_number,
        date: payment.payment_date
      })) || [],
      footer: {
        status: transaction.status,
        payment_status: transaction.payment_status,
        currency_symbol: transaction.currency_symbol
      }
    }
  }
}

export const comprehensiveTransactionsService = new ComprehensiveTransactionsService()
export default comprehensiveTransactionsService