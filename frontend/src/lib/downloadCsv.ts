// Phone-friendly CSV export for the PWA. Blob URL + <a download> works in
// mobile Safari/Chrome standalone PWAs where window.open/href navigation
// with an Authorization header does not.
// Auth rides on apiClient's request interceptor (Bearer token + tenant header).
import { apiClient } from '../services/api.service'

function saveBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

/** Fetch an existing CSV endpoint with auth and save it on-device. */
export async function downloadCsv(path: string, filename: string): Promise<void> {
  const res = await apiClient.get(path, { responseType: 'blob' })
  saveBlob(new Blob([res.data], { type: 'text/csv;charset=utf-8' }), filename)
}

type Cell = string | number | null | undefined

/** Pure rows -> CSV text (BOM for Excel), same escaping rule as the backend exports. */
export function rowsToCsv(headers: string[], rows: Cell[][]): string {
  const esc = (v: Cell) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '\uFEFF' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n')
}

/** Save already-fetched JSON rows as CSV — reuses the view's existing endpoint, no server round-trip. */
export function saveRowsAsCsv(headers: string[], rows: Cell[][], filename: string): void {
  saveBlob(new Blob([rowsToCsv(headers, rows)], { type: 'text/csv;charset=utf-8' }), filename)
}
