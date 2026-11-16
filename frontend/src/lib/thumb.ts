// Ask the API for a resized WebP thumbnail. Only our own upload URLs support `?w=`;
// data: URIs and third-party URLs pass through unchanged.
export function thumb(url: string | null | undefined, w: number): string | undefined {
  if (!url || !url.includes('/api/uploads/') || url.startsWith('data:')) return url || undefined
  return url + (url.includes('?') ? '&' : '?') + 'w=' + w
}
