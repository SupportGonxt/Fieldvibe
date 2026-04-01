import { ApiService, buildUrl } from './api.service'

export interface Currency {
  id: string
  code: string
  name: string
  symbol: string
  decimal_places: number
  exchange_rate: number
  is_base_currency: boolean
  is_active: boolean
  location_count?: number
  currency_type?: string
  last_rate_update?: string
}

export interface LocationCurrency {
  id: string
  country_code: string
  country_name: string
  region?: string
  currency_id: string
  is_default: boolean
  currency_code?: string
  currency_name?: string
  currency_symbol?: string
  exchange_rate?: number
}

export interface CurrencyDetection {
  currency: Currency
  detection_method: 'country_code' | 'coordinates' | 'default'
  location_info: {
    latitude?: number
    longitude?: number
    country_code?: string
    ip_address?: string
  }
}

export interface CurrencyConversion {
  original_amount: number
  converted_amount: number
  from_currency: {
    id: string
    code: string
    symbol: string
    exchange_rate: number
  }
  to_currency: {
    id: string
    code: string
    symbol: string
    exchange_rate: number
  }
  conversion_rate: number
  converted_at: string
}

export interface ExchangeRateHistory {
  id: string
  currency_id: string
  old_rate: number
  new_rate: number
  source: string
  updated_by: string
  updated_at: string
  currency_code?: string
  currency_name?: string
  updated_by_name?: string
}

export interface CurrencySystemDashboard {
  currencyStats: {
    total_currencies: number
    active_currencies: number
    base_currencies: number
  }
  locationStats: {
    total_locations: number
    currencies_in_use: number
    default_locations: number
  }
  activeCurrencies: Currency[]
  recentRateUpdates: ExchangeRateHistory[]
}

class CurrencySystemService extends ApiService {
  private readonly baseUrl = '/currency-system'

  // Get all available currencies
  async getCurrencies(activeOnly: boolean = true) {
    const url = buildUrl(`${this.baseUrl}/currencies`, { active_only: activeOnly })
    const response = await this.get<{ data: { currencies: Currency[] } }>(url)
    return response.data.data.currencies
  }

  // Add a new currency
  async addCurrency(data: {
    code: string
    name: string
    symbol: string
    decimal_places?: number
    exchange_rate?: number
    is_base_currency?: boolean
  }) {
    const response = await this.post(`${this.baseUrl}/currencies`, data)
    return response.data?.data || response.data
  }

  // Update currency exchange rate
  async updateExchangeRate(currencyId: string, data: {
    exchange_rate: number
    source?: string
  }) {
    const response = await this.put(`${this.baseUrl}/currencies/${currencyId}/exchange-rate`, data)
    return response.data?.data || response.data
  }

  // Get location-currency mappings
  async getLocationCurrencies(params?: {
    country_code?: string
    region?: string
  }) {
    const url = buildUrl(`${this.baseUrl}/location-currencies`, params)
    const response = await this.get<{ data: { location_currencies: LocationCurrency[] } }>(url)
    return response.data.data.location_currencies
  }

  // Add location-currency mapping
  async addLocationCurrency(data: {
    country_code: string
    country_name: string
    region?: string
    currency_id: string
    is_default?: boolean
  }) {
    const response = await this.post(`${this.baseUrl}/location-currencies`, data)
    return response.data?.data || response.data
  }

  // Detect currency based on location
  async detectCurrency(data: {
    latitude?: number
    longitude?: number
    country_code?: string
    ip_address?: string
  }) {
    const response = await this.post<{ data: CurrencyDetection }>(`${this.baseUrl}/detect-currency`, data)
    return response.data.data
  }

  // Convert amount between currencies
  async convertCurrency(data: {
    amount: number
    from_currency_id: string
    to_currency_id: string
  }) {
    const response = await this.post<{ data: CurrencyConversion }>(`${this.baseUrl}/convert`, data)
    return response.data.data
  }

  // Get currency system dashboard data
  async getDashboard() {
    const response = await this.get<{ data: CurrencySystemDashboard }>(`${this.baseUrl}/dashboard`)
    return response.data.data
  }

  // Utility functions for currency formatting
  static formatAmount(amount: number, currency: Currency): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: currency.decimal_places,
      maximumFractionDigits: currency.decimal_places
    }).format(amount)
  }

  static formatAmountWithSymbol(amount: number, currency: Currency): string {
    const formattedAmount = amount.toFixed(currency.decimal_places)
    return `${currency.symbol}${formattedAmount}`
  }

  static parseAmount(amountString: string, currency: Currency): number {
    // Remove currency symbol and parse
    const cleanAmount = amountString.replace(currency.symbol, '').replace(/,/g, '').trim()
    return parseFloat(cleanAmount) || 0
  }

  // Get user's preferred currency from localStorage
  static getPreferredCurrency(): string | null {
    return localStorage.getItem('preferred_currency')
  }

  // Set user's preferred currency
  static setPreferredCurrency(currencyId: string): void {
    localStorage.setItem('preferred_currency', currencyId)
  }

  // Auto-detect currency based on browser locale and geolocation
  async autoDetectCurrency(): Promise<Currency> {
    try {
      // Try to get user's location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported'))
          return
        }

        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 5000,
          maximumAge: 300000 // 5 minutes
        })
      })

      // Detect currency based on coordinates
      const detection = await this.detectCurrency({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      })
      return detection.currency
    } catch (error) {
      // Fallback to browser locale
      const locale = navigator.language || 'en-US'
      const countryCode = locale.split('-')[1] || 'US'

      try {
        const detection = await this.detectCurrency({ country_code: countryCode })
        return detection.currency
      } catch (fallbackError) {
        // Final fallback - get base currency
        const currencies = await this.getCurrencies(true)
        const baseCurrency = currencies.find(c => c.is_base_currency)
        if (baseCurrency) {
          return baseCurrency
        }
        throw new Error('No currency configuration found')
      }
    }
  }

  // Get exchange rate between two currencies
  static calculateExchangeRate(fromCurrency: Currency, toCurrency: Currency): number {
    if (fromCurrency.is_base_currency) {
      return toCurrency.exchange_rate
    } else if (toCurrency.is_base_currency) {
      return 1 / fromCurrency.exchange_rate
    } else {
      return toCurrency.exchange_rate / fromCurrency.exchange_rate
    }
  }

  // Convert amount using currency objects
  static convertAmount(amount: number, fromCurrency: Currency, toCurrency: Currency): number {
    const rate = this.calculateExchangeRate(fromCurrency, toCurrency)
    const convertedAmount = amount * rate
    return Math.round(convertedAmount * Math.pow(10, toCurrency.decimal_places)) / Math.pow(10, toCurrency.decimal_places)
  }

  // Get common currency codes
  static getCommonCurrencies(): Array<{ code: string; name: string; symbol: string }> {
    return [
      { code: 'USD', name: 'US Dollar', symbol: '$' },
      { code: 'EUR', name: 'Euro', symbol: '€' },
      { code: 'GBP', name: 'British Pound', symbol: '£' },
      { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
      { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
      { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
      { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
      { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
      { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
      { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
      { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
      { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
      { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
      { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
      { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
      { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
      { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
      { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
      { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' }
    ]
  }
}

export const currencySystemService = new CurrencySystemService()
export default currencySystemService