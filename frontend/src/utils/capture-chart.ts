import html2canvas from 'html2canvas'

/**
 * Snapshot a DOM element (typically a chart container) into a PNG data URL.
 * Returns null if the element is missing or capture fails — callers must
 * tolerate a missing image rather than blocking the export.
 */
export async function captureElementToPng(el: HTMLElement | null, opts?: { scale?: number; backgroundColor?: string }): Promise<string | null> {
  if (!el) return null
  try {
    const canvas = await html2canvas(el, {
      scale: opts?.scale ?? 2,                  // 2x for crisp PDFs
      backgroundColor: opts?.backgroundColor ?? '#ffffff',
      useCORS: true,
      logging: false,
      // svg embedded inside (recharts) is captured fine when foreignObject is allowed.
      foreignObjectRendering: false,
    })
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

/**
 * Capture a list of {key, el} pairs in parallel into a {key: dataUrl|null} map.
 * Use stable keys (e.g. 'visits-over-time') so the PDF builder can pick them up.
 */
export async function captureCharts(refs: Array<{ key: string; el: HTMLElement | null }>): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {}
  await Promise.all(refs.map(async ({ key, el }) => {
    out[key] = await captureElementToPng(el)
  }))
  return out
}
