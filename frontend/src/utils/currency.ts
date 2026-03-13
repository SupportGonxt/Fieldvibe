// Currency utilities for FieldVibe
export type Currency = 'USD' | 'ZAR' | 'EUR' | 'GBP'

export interface CurrencyConfig {
  code: Currency
  symbol: string
  name: string
  locale: string
  decimals: number
}

export const CURRENCIES: Record<Currency, CurrencyConfig> = {
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    locale: 'en-US',
    decimals: 2
  },
  ZAR: {
    code: 'ZAR',
    symbol: 'R',
    name: 'South African Rand',
    locale: 'en-ZA',
    decimals: 2
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    locale: 'en-EU',
    decimals: 2
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    locale: 'en-GB',
    decimals: 2
  }
}

// Default currency - can be changed via settings
let defaultCurrency: Currency = 'ZAR'

export const setDefaultCurrency = (currency: Currency): void => {
  defaultCurrency = currency
  // Store in localStorage for persistence
  if (typeof window !== 'undefined') {
    localStorage.setItem('fieldvibe_currency', currency)
  }
}

export const getDefaultCurrency = (): Currency => {
  // Check localStorage first
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('fieldvibe_currency') as Currency
    if (stored && CURRENCIES[stored]) {
      defaultCurrency = stored
    }
  }
  return defaultCurrency
}

export const formatCurrency = (
  amount: number | string | null | undefined,
  currencyOrOptions?: Currency | {
    showSymbol?: boolean
    showCode?: boolean
    compact?: boolean
  },
  options?: {
    showSymbol?: boolean
    showCode?: boolean
    compact?: boolean
  }
): string => {
  // Handle null/undefined amounts and convert strings to numbers
  let numAmount: number
  if (amount === null || amount === undefined) {
    numAmount = 0
  } else if (typeof amount === 'string') {
    numAmount = parseFloat(amount) || 0
  } else if (isNaN(amount)) {
    numAmount = 0
  } else {
    numAmount = amount
  }

  let curr: Currency
  let opts: { showSymbol?: boolean; showCode?: boolean; compact?: boolean }

  // Handle different parameter combinations
  if (typeof currencyOrOptions === 'string') {
    // formatCurrency(amount, currency, options)
    curr = currencyOrOptions
    opts = options || {}
  } else if (typeof currencyOrOptions === 'object' && currencyOrOptions !== null) {
    // formatCurrency(amount, options)
    curr = getDefaultCurrency()
    opts = currencyOrOptions
  } else {
    // formatCurrency(amount)
    curr = getDefaultCurrency()
    opts = {}
  }

  const config = CURRENCIES[curr]
  const { showSymbol = true, showCode = false, compact = false } = opts

  if (compact && Math.abs(numAmount) >= 1000000) {
    const millions = numAmount / 1000000
    return `${showSymbol ? config.symbol : ''}${millions.toFixed(1)}M${showCode ? ` ${config.code}` : ''}`
  }

  if (compact && Math.abs(numAmount) >= 1000) {
    const thousands = numAmount / 1000
    return `${showSymbol ? config.symbol : ''}${thousands.toFixed(1)}K${showCode ? ` ${config.code}` : ''}`
  }

  // Format number with thousand separators and decimals
  const formattedNumber = numAmount.toFixed(config.decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  
  let result = formattedNumber
  
  if (showSymbol) {
    result = `${config.symbol} ${formattedNumber}`
  }
  
  if (showCode) {
    result = showSymbol ? `${result} (${config.code})` : `${formattedNumber} ${config.code}`
  }

  return result
}

export const parseCurrency = (value: string, currency?: Currency): number => {
  const curr = currency || getDefaultCurrency()
  const config = CURRENCIES[curr]
  
  // Remove currency symbols and spaces
  const cleaned = value
    .replace(new RegExp(`[${config.symbol}\\s]`, 'g'), '')
    .replace(config.code, '')
    .trim()
  
  return parseFloat(cleaned) || 0
}

export const getCurrencySymbol = (currency?: Currency): string => {
  const curr = currency || getDefaultCurrency()
  return CURRENCIES[curr].symbol
}

export const getCurrencyName = (currency?: Currency): string => {
  const curr = currency || getDefaultCurrency()
  return CURRENCIES[curr].name
}

// Exchange rate utilities (for future implementation)
export interface ExchangeRate {
  from: Currency
  to: Currency
  rate: number
  lastUpdated: Date
}

// Mock exchange rates - in production, these would come from an API
const MOCK_EXCHANGE_RATES: ExchangeRate[] = [
  { from: 'USD', to: 'ZAR', rate: 18.50, lastUpdated: new Date() },
  { from: 'ZAR', to: 'USD', rate: 0.054, lastUpdated: new Date() },
  { from: 'EUR', to: 'ZAR', rate: 20.10, lastUpdated: new Date() },
  { from: 'ZAR', to: 'EUR', rate: 0.050, lastUpdated: new Date() },
  { from: 'GBP', to: 'ZAR', rate: 23.20, lastUpdated: new Date() },
  { from: 'ZAR', to: 'GBP', rate: 0.043, lastUpdated: new Date() }
]

export const convertCurrency = (
  amount: number,
  from: Currency,
  to: Currency
): number => {
  if (from === to) return amount
  
  const rate = MOCK_EXCHANGE_RATES.find(r => r.from === from && r.to === to)
  if (rate) {
    return amount * rate.rate
  }
  
  // If direct rate not found, try reverse
  const reverseRate = MOCK_EXCHANGE_RATES.find(r => r.from === to && r.to === from)
  if (reverseRate) {
    return amount / reverseRate.rate
  }
  
  // Fallback - no conversion
  return amount
}

export const getExchangeRate = (from: Currency, to: Currency): number | null => {
  if (from === to) return 1
  
  const rate = MOCK_EXCHANGE_RATES.find(r => r.from === from && r.to === to)
  if (rate) return rate.rate
  
  const reverseRate = MOCK_EXCHANGE_RATES.find(r => r.from === to && r.to === from)
  if (reverseRate) return 1 / reverseRate.rate
  
  return null
}

// Currency validation
export const isValidCurrency = (currency: string): currency is Currency => {
  return Object.keys(CURRENCIES).includes(currency)
}

// Format for display in tables and cards
export const formatCurrencyCompact = (amount: number, currency?: Currency): string => {
  return formatCurrency(amount, currency, { compact: true })
}

// Format for forms and inputs
export const formatCurrencyInput = (amount: number, currency?: Currency): string => {
  return formatCurrency(amount, currency, { showSymbol: false })
}

// Initialize default currency from localStorage on module load
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('fieldvibe_currency') as Currency
  if (stored && CURRENCIES[stored]) {
    defaultCurrency = stored
  }
}
