import React, { useState, useRef, useEffect } from 'react'
import { Download, FileText, Table, Printer, ChevronDown } from 'lucide-react'
import { exportToCSV, exportToXLSX, exportTableToExcel, printTable } from '../../utils/export'
import type { ExportColumn } from '../../utils/export'

interface ExportMenuProps {
  data: any[]
  columns: ExportColumn[]
  filename?: string
  title?: string
  onPDF?: () => void
  className?: string
}

export default function ExportMenu({
  data,
  columns,
  filename = 'export',
  title = 'Report',
  onPDF,
  className = '',
}: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCSV = () => {
    exportToCSV(data, columns, filename)
    setOpen(false)
  }

  const handleExcel = () => {
    exportTableToExcel(data, columns, filename, title)
    setOpen(false)
  }

  const handleXLSX = () => {
    exportToXLSX(data, columns, filename, title)
    setOpen(false)
  }

  const handlePrint = () => {
    printTable(data, columns, title)
    setOpen(false)
  }

  const handlePDF = () => {
    onPDF?.()
    setOpen(false)
  }

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-300 dark:border-night-50 rounded-lg bg-white dark:bg-night-50 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-night-100 transition-colors"
        disabled={data.length === 0}
      >
        <Download className="w-4 h-4" />
        Export
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-night-50 border border-gray-200 dark:border-night-100 rounded-lg shadow-lg z-50 py-1">
          <button
            onClick={handleCSV}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-night-100"
          >
            <Table className="w-4 h-4 text-green-600" />
            Export as CSV
          </button>
          <button
            onClick={handleXLSX}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-night-100"
          >
            <Table className="w-4 h-4 text-blue-600" />
            Export as Excel
          </button>
          {onPDF && (
            <button
              onClick={handlePDF}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-night-100"
            >
              <FileText className="w-4 h-4 text-red-600" />
              Export as PDF
            </button>
          )}
          <div className="border-t border-gray-100 dark:border-night-100 my-1" />
          <button
            onClick={handlePrint}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-night-100"
          >
            <Printer className="w-4 h-4 text-gray-600" />
            Print
          </button>
        </div>
      )}
    </div>
  )
}
