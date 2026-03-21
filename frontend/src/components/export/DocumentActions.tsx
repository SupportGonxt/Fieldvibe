import React, { useState, useRef, useEffect } from 'react'
import { FileText, Printer, Download, ChevronDown } from 'lucide-react'
import { generatePDF } from '../../utils/pdf/document-generator'
import type { DocumentData } from '../../utils/pdf/document-generator'

interface DocumentActionsProps {
  documentData: DocumentData
  className?: string
}

export default function DocumentActions({ documentData, className = '' }: DocumentActionsProps) {
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

  const documentTypeLabels: Record<string, string> = {
    invoice: 'Invoice',
    order: 'Sales Order',
    pick_slip: 'Pick Slip',
    credit_note: 'Credit Note',
    delivery_note: 'Delivery Note',
    quotation: 'Quotation',
    receipt: 'Receipt',
    van_load: 'Van Load Sheet',
    van_sales_order: 'Van Sales Order',
    stock_count: 'Stock Count Sheet',
    stock_transfer: 'Stock Transfer Note',
    stock_issue: 'Stock Issue Note',
    goods_receipt: 'Goods Received Note',
    board_placement: 'Board Placement Record',
    product_distribution: 'Product Distribution Record',
    commission_statement: 'Commission Statement',
    sales_return: 'Sales Return Note',
  }

  const handlePrint = () => {
    generatePDF(documentData)
    setOpen(false)
  }

  const handlePrintPickSlip = () => {
    generatePDF({ ...documentData, type: 'pick_slip' })
    setOpen(false)
  }

  const handlePrintDeliveryNote = () => {
    generatePDF({ ...documentData, type: 'delivery_note' })
    setOpen(false)
  }

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-300 dark:border-night-50 rounded-lg bg-white dark:bg-night-50 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-night-100 transition-colors"
      >
        <Printer className="w-4 h-4" />
        Print / PDF
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-night-50 border border-gray-200 dark:border-night-100 rounded-lg shadow-lg z-50 py-1">
          <button
            onClick={handlePrint}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-night-100"
          >
            <FileText className="w-4 h-4 text-blue-600" />
            <div className="text-left">
              <div className="font-medium">Print {documentTypeLabels[documentData.type]}</div>
              <div className="text-xs text-gray-500">Standard document</div>
            </div>
          </button>

          {(documentData.type === 'order' || documentData.type === 'invoice') && (
            <>
              <button
                onClick={handlePrintPickSlip}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-night-100"
              >
                <Download className="w-4 h-4 text-amber-600" />
                <div className="text-left">
                  <div className="font-medium">Print Pick Slip</div>
                  <div className="text-xs text-gray-500">Warehouse picking list</div>
                </div>
              </button>

              <button
                onClick={handlePrintDeliveryNote}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-night-100"
              >
                <FileText className="w-4 h-4 text-purple-600" />
                <div className="text-left">
                  <div className="font-medium">Print Delivery Note</div>
                  <div className="text-xs text-gray-500">Customer delivery copy</div>
                </div>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
