/**
 * Guard for hashed build assets: a missing /assets/* file must be a 404,
 * never the SPA fallback.
 *
 * Without this, the `_redirects` catch-all (`/* /index.html 200`) answers a
 * missing chunk URL with index.html + 200, and `_headers` attaches this
 * path's `max-age=31536000, immutable` to that HTML. Verified live on
 * 2026-07-16: the Cloudflare edge then caches the HTML under the .js URL
 * (Cf-Cache-Status: HIT), so every browser in the colo gets text/html for a
 * module script — "Failed to load module script: ... MIME type of
 * 'text/html'" — and each browser pins it for a year with no revalidation.
 * Chunk URLs go missing on every deploy (old shells requesting purged
 * chunks; edges serving two builds during propagation), so this is a
 * recurring poison source, not a one-off.
 *
 * A 404 with no-store is safe end to end: nothing caches it, and the client
 * recovers via lazyWithRetry's one-shot reload (App.tsx).
 */
export async function onRequest(context) {
  const response = await context.next()
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('text/html')) {
    return new Response('asset not found', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
    })
  }
  return response
}
