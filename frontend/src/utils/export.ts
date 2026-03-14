/**
 * Export utilities for CSV, Excel-compatible CSV, and data downloads
 */

interface ExportColumn {
  key: string
  label: string
  format?: (value: any, row: any) => string
}

export function exportToCSV(
  data: any[],
  columns: ExportColumn[],
  filename: string = 'export'
): void {
  if (data.length === 0) return

  const headers = columns.map(col => `"${col.label.replace(/"/g, '""')}"`).join(',')
  const rows = data.map(row =>
    columns.map(col => {
      const value = col.format ? col.format(row[col.key], row) : row[col.key]
      const strValue = String(value ?? '')
      return `"${strValue.replace(/"/g, '""')}"`
    }).join(',')
  )

  const csv = [headers, ...rows].join('\n')
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${filename}.csv`)
}

export function exportToJSON(data: any[], filename: string = 'export'): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  downloadBlob(blob, `${filename}.json`)
}

export function exportTableToExcel(
  data: any[],
  columns: ExportColumn[],
  filename: string = 'export',
  sheetName: string = 'Sheet1'
): void {
  if (data.length === 0) return

  const tableRows = data.map(row =>
    columns.map(col => {
      const value = col.format ? col.format(row[col.key], row) : row[col.key]
      return `<td>${escapeHtml(String(value ?? ''))}</td>`
    }).join('')
  )

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head><meta charset="utf-8">
    <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
    <x:Name>${sheetName}</x:Name>
    <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
    </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
    <style>td{mso-number-format:"\\@";}</style>
    </head><body>
    <table>
      <thead><tr>${columns.map(col => `<th style="font-weight:bold;background:#f0f0f0;">${escapeHtml(col.label)}</th>`).join('')}</tr></thead>
      <tbody>${tableRows.map(r => `<tr>${r}</tr>`).join('')}</tbody>
    </table>
    </body></html>`

  const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
  downloadBlob(blob, `${filename}.xls`)
}

export function printTable(
  data: any[],
  columns: ExportColumn[],
  title: string = 'Report'
): void {
  const tableRows = data.map(row =>
    columns.map(col => {
      const value = col.format ? col.format(row[col.key], row) : row[col.key]
      return `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:10pt;">${escapeHtml(String(value ?? ''))}</td>`
    }).join('')
  )

  const html = `
    <!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      @page { size: landscape; margin: 10mm; }
      body { font-family: -apple-system, sans-serif; color: #1f2937; }
      h1 { font-size: 16pt; margin-bottom: 5px; }
      .meta { font-size: 9pt; color: #6b7280; margin-bottom: 15px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #d1d5db; }
      tr:nth-child(even) { background: #f9fafb; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style>
    </head><body>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">Generated: ${new Date().toLocaleString('en-GB')} | Total Records: ${data.length}</div>
    <table>
      <thead><tr>${columns.map(col => `<th>${escapeHtml(col.label)}</th>`).join('')}</tr></thead>
      <tbody>${tableRows.map(r => `<tr>${r}</tr>`).join('')}</tbody>
    </table>
    </body></html>`

  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 500)
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type { ExportColumn }
