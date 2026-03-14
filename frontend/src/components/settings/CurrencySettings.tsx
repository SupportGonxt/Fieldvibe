import React, { useState, useEffect } from 'react'
import { 
  CURRENCIES, 
  Currency, 
  getDefaultCurrency, 
  setDefaultCurrency,
  formatCurrency,
  getCurrencyName,
  getCurrencySymbol
} from '../../utils/currency'

interface CurrencySettingsProps {
  onCurrencyChange?: (currency: Currency) => void
}

export const CurrencySettings: React.FC<CurrencySettingsProps> = ({ onCurrencyChange }) => {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(getDefaultCurrency())
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setSelectedCurrency(getDefaultCurrency())
  }, [])

  const handleCurrencyChange = async (currency: Currency) => {
    setIsLoading(true)
    
    try {
      // Update the default currency
      setDefaultCurrency(currency)
      setSelectedCurrency(currency)
      
      // Notify parent component
      onCurrencyChange?.(currency)
      
      // Show success message (you could use a toast library here)
      
    } catch (error) {
      console.error('Failed to update currency:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const previewAmount = 1234.56

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Currency Settings</h3>
        <p className="text-sm text-gray-600">
          Choose your preferred currency for displaying amounts throughout the application.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Currency
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(CURRENCIES).map(([code, config]) => (
              <div
                key={code}
                className={`
                  relative rounded-lg border-2 cursor-pointer transition-all duration-200
                  ${selectedCurrency === code 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-100 hover:border-gray-300 bg-white'
                  }
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                onClick={() => !isLoading && handleCurrencyChange(code as Currency)}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                        ${selectedCurrency === code 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-100 text-gray-600'
                        }
                      `}>
                        {config.symbol}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{config.code}</div>
                        <div className="text-sm text-gray-500">{config.name}</div>
                      </div>
                    </div>
                    {selectedCurrency === code && (
                      <div className="text-blue-500">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="bg-surface-secondary rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Preview</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Standard format:</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(previewAmount, selectedCurrency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Compact format:</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(previewAmount, selectedCurrency, { compact: true })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Symbol only:</span>
                <span className="font-medium text-gray-900">
                  {getCurrencySymbol(selectedCurrency)}{previewAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-sm text-gray-600">Updating currency...</span>
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-start space-x-3">
          <div className="text-blue-500 mt-0.5">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h5 className="text-sm font-medium text-blue-900">Currency Information</h5>
            <p className="text-sm text-blue-700 mt-1">
              Your currency preference is saved locally and will be remembered across sessions. 
              All amounts throughout the application will be displayed in your selected currency.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CurrencySettings