import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Search, ChevronDown, X, Loader2 } from 'lucide-react'

export interface AsyncOption {
  value: string
  label: string
  subtitle?: string
  metadata?: Record<string, unknown>
}

interface AsyncSearchableSelectProps {
  fetchOptions: (query: string) => Promise<AsyncOption[]>
  value: string | null
  onChange: (value: string | null, option: AsyncOption | null) => void
  placeholder?: string
  label?: string
  searchPlaceholder?: string
  disabled?: boolean
  error?: string
  className?: string
  required?: boolean
  debounceMs?: number
  minChars?: number
}

export default function AsyncSearchableSelect({
  fetchOptions,
  value,
  onChange,
  placeholder = 'Select...',
  label,
  searchPlaceholder = 'Type to search...',
  disabled = false,
  error,
  className = '',
  required = false,
  debounceMs = 300,
  minChars = 1,
}: AsyncSearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<AsyncOption[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedOption, setSelectedOption] = useState<AsyncOption | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const doSearch = useCallback(async (query: string) => {
    if (query.length < minChars) {
      setOptions([])
      return
    }
    setLoading(true)
    try {
      const results = await fetchOptions(query)
      setOptions(results)
      setHighlightedIndex(0)
    } catch {
      setOptions([])
    } finally {
      setLoading(false)
    }
  }, [fetchOptions, minChars])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(search), debounceMs)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, doSearch, debounceMs])

  const handleOpen = useCallback(() => {
    if (disabled) return
    setIsOpen(true)
    setSearch('')
    setOptions([])
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [disabled])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setSearch('')
  }, [])

  const handleSelect = useCallback((option: AsyncOption) => {
    setSelectedOption(option)
    onChange(option.value, option)
    handleClose()
  }, [onChange, handleClose])

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedOption(null)
    onChange(null, null)
  }, [onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        handleOpen()
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(i => Math.min(i + 1, options.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (options[highlightedIndex]) handleSelect(options[highlightedIndex])
        break
      case 'Escape':
        e.preventDefault()
        handleClose()
        break
    }
  }, [isOpen, options, highlightedIndex, handleOpen, handleSelect, handleClose])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) handleClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [handleClose])

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <button
        type="button"
        onClick={isOpen ? handleClose : handleOpen}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-3 py-2.5 text-left border rounded-lg transition-colors text-sm
          ${error ? 'border-red-500' : 'border-gray-300 dark:border-night-50'}
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-night-200' : 'bg-white dark:bg-night-50 hover:border-gray-400 dark:hover:border-night-100 cursor-pointer'}
          ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}
        `}
      >
        <span className={selectedOption ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {selectedOption && !disabled && (
            <span role="button" tabIndex={-1} onClick={handleClear} className="p-0.5 hover:bg-gray-200 dark:hover:bg-night-100 rounded">
              <X className="w-3.5 h-3.5 text-gray-400" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-night-50 border border-gray-200 dark:border-night-100 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-night-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-night-100 rounded-md bg-gray-50 dark:bg-night-200 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Searching...
              </div>
            ) : search.length < minChars ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">
                Type at least {minChars} character{minChars > 1 ? 's' : ''} to search
              </div>
            ) : options.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">No results found</div>
            ) : (
              options.map((option, idx) => (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`px-3 py-2.5 cursor-pointer text-sm transition-colors
                    ${idx === highlightedIndex ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-night-100'}
                    ${option.value === value ? 'font-medium text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}
                  `}
                >
                  <div>{option.label}</div>
                  {option.subtitle && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{option.subtitle}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  )
}
