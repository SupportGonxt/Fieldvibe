import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export type PDFSection =
  | { kind: 'kv'; title: string; rows: Array<[string, string | number]> }
  | { kind: 'table'; title: string; head: string[]; rows: Array<Array<string | number>>; columnStyles?: Record<number, any> }
  | { kind: 'paragraph'; title?: string; text: string }
  | { kind: 'image'; title?: string; dataUrl: string; widthPt?: number; heightPt?: number }
  | { kind: 'spacer'; size?: number }

interface BuildOpts {
  title: string
  subtitle?: string
  filename: string
  meta?: Array<[string, string]>          // shown under the title (e.g. period, generated-at)
  sections: PDFSection[]
  footer?: string                          // shown on every page
}

const BRAND_PRIMARY: [number, number, number]   = [10, 15, 28]    // theme #0A0F1C
const BRAND_ACCENT:  [number, number, number]   = [14, 165, 233]  // sky-500
const TEXT_DIM:      [number, number, number]   = [107, 114, 128] // gray-500
const HEAD_FILL:     [number, number, number]   = [30, 41, 59]    // slate-800
const HEAD_TEXT:     [number, number, number]   = [255, 255, 255]
const ROW_ALT:       [number, number, number]   = [248, 250, 252] // slate-50

export function buildInsightsPDF(opts: BuildOpts) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 36

  // Header bar
  doc.setFillColor(...BRAND_PRIMARY)
  doc.rect(0, 0, pageWidth, 56, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('FieldVibe', margin, 26)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(180, 195, 220)
  doc.text(opts.subtitle || 'Insights report', margin, 44)

  // Title
  doc.setTextColor(...BRAND_PRIMARY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(opts.title, margin, 90)

  // Meta lines
  let y = 110
  if (opts.meta && opts.meta.length) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...TEXT_DIM)
    for (const [k, v] of opts.meta) {
      doc.text(`${k}: ${v}`, margin, y)
      y += 12
    }
    y += 6
  } else {
    y = 100
  }

  // Render each section. Use autoTable for kv & table; manual for paragraph.
  for (const sec of opts.sections) {
    if (sec.kind === 'spacer') {
      y += sec.size || 14
      continue
    }
    if (sec.kind === 'paragraph') {
      if (y > 750) { doc.addPage(); y = 50 }
      if (sec.title) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.setTextColor(...BRAND_PRIMARY)
        doc.text(sec.title, margin, y)
        y += 14
      }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(40, 40, 40)
      const lines = doc.splitTextToSize(sec.text, pageWidth - margin * 2)
      doc.text(lines, margin, y)
      y += lines.length * 12 + 8
      continue
    }
    if (sec.kind === 'kv') {
      autoTable(doc, {
        startY: y,
        head: [[sec.title, '']],
        body: sec.rows.map(([k, v]) => [k, String(v)]),
        margin: { left: margin, right: margin },
        theme: 'plain',
        styles: { font: 'helvetica', fontSize: 10, textColor: [40, 40, 40] },
        headStyles: { fillColor: HEAD_FILL, textColor: HEAD_TEXT, fontSize: 11, fontStyle: 'bold', halign: 'left' },
        columnStyles: { 0: { cellWidth: 220, fontStyle: 'bold' }, 1: { halign: 'right' } },
        alternateRowStyles: { fillColor: ROW_ALT },
      })
      y = (doc as any).lastAutoTable.finalY + 12
      continue
    }
    if (sec.kind === 'image') {
      // Compute target size that fits the column width while preserving aspect.
      const maxW = pageWidth - margin * 2
      const w = Math.min(sec.widthPt || maxW, maxW)
      // If caller didn't supply a height, attempt to read the source; jsPDF's
      // getImageProperties handles base64 data URLs.
      let h = sec.heightPt
      if (!h) {
        try {
          const props = (doc as any).getImageProperties(sec.dataUrl)
          if (props && props.width && props.height) {
            h = (props.height / props.width) * w
          }
        } catch {
          // unknown — fall back to 4:3
          h = w * 0.65
        }
      }
      // Page-break if we'd run off the bottom.
      if (y + (h || 200) > 780) { doc.addPage(); y = 50 }
      if (sec.title) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.setTextColor(...BRAND_PRIMARY)
        doc.text(sec.title, margin, y)
        y += 12
      }
      try {
        doc.addImage(sec.dataUrl, 'PNG', margin, y, w, h || 200, undefined, 'FAST')
      } catch {
        // bad data URL — skip silently rather than crash the whole PDF
      }
      y += (h || 200) + 14
      continue
    }
    if (sec.kind === 'table') {
      autoTable(doc, {
        startY: y,
        head: [sec.head],
        body: sec.rows.map(r => r.map(c => (c === null || c === undefined) ? '' : String(c))),
        margin: { left: margin, right: margin },
        styles: { font: 'helvetica', fontSize: 9, textColor: [40, 40, 40] },
        headStyles: { fillColor: HEAD_FILL, textColor: HEAD_TEXT, fontSize: 10, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: ROW_ALT },
        columnStyles: sec.columnStyles,
        didDrawPage: () => {
          // Repeat the title on subsequent pages so the report scans clean.
          // (autoTable will call this for the first page too — that's fine.)
        },
      })
      // Title above the table — autoTable doesn't natively support a section heading,
      // so we draw it as a small label just above the start.
      // (For simplicity skip rendering the section title; readers see the head row.)
      y = (doc as any).lastAutoTable.finalY + 14
      continue
    }
  }

  // Footer on every page
  const total = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT_DIM)
    const footerY = doc.internal.pageSize.getHeight() - 18
    doc.text(opts.footer || 'FieldVibe — generated automatically', margin, footerY)
    doc.text(`Page ${i} of ${total}`, pageWidth - margin, footerY, { align: 'right' })
    // Accent line
    doc.setDrawColor(...BRAND_ACCENT)
    doc.setLineWidth(0.5)
    doc.line(margin, footerY - 6, pageWidth - margin, footerY - 6)
  }

  doc.save(opts.filename)
}
