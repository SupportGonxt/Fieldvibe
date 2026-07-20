import { useEffect, useMemo, useState } from 'react'
import { Megaphone, ChevronRight, X } from 'lucide-react'
import { NEWS_ITEMS } from '../../data/news'

const READ_KEY = 'news_read_ids_v1'

function loadReadIds(): string[] {
  try {
    const raw = localStorage.getItem(READ_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Home-screen news/announcements widget. Shows the latest headline as a tappable
// card; tapping opens the full news feed. Unread items (by id, tracked in
// localStorage) surface a dot so a new post gets noticed once.
export default function NewsWidget() {
  const [open, setOpen] = useState(false)
  const [readIds, setReadIds] = useState<string[]>(loadReadIds)

  const latest = NEWS_ITEMS[0]
  const unreadCount = useMemo(
    () => NEWS_ITEMS.filter((n) => !readIds.includes(n.id)).length,
    [readIds],
  )

  // Mark everything read once the feed is opened.
  useEffect(() => {
    if (!open) return
    const allIds = NEWS_ITEMS.map((n) => n.id)
    setReadIds(allIds)
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(allIds))
    } catch { /* ignore */ }
  }, [open])

  // Close the modal on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!latest) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Open news: ${latest.title}`}
        className="group flex w-full items-center gap-3 rounded-2xl border border-token bg-primary/10 p-3.5 text-left transition hover:bg-primary/15 focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
          <Megaphone className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-bg" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-primary">News</span>
          <span className="block truncate text-sm font-semibold text-token">{latest.title}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-token-faint transition group-hover:text-primary" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-3 pb-3 pt-16 sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="News"
        >
          <div
            className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl border border-token bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-token px-4 py-3">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-token">What&apos;s new</h2>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1 text-token-faint hover:text-token">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-4 py-4">
              {NEWS_ITEMS.map((item) => (
                <article key={item.id} className="mb-5 last:mb-0">
                  <h3 className="text-base font-bold text-token">{item.title}</h3>
                  <p className="mb-2 text-[11px] text-token-faint">
                    {new Date(item.date + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  {item.body.split('\n\n').map((para, i) => (
                    <p key={i} className="mb-2 whitespace-pre-line text-sm leading-relaxed text-token/80">{para}</p>
                  ))}
                </article>
              ))}
            </div>

            <div className="border-t border-token px-4 py-3">
              <button
                onClick={() => setOpen(false)}
                className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-on-primary transition hover:opacity-90"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
