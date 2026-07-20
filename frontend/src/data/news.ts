// Team news / announcements shown in the home-screen News widget.
// To post a new item, add it to the TOP of this array (newest first). `id` must be
// unique and stable — the widget uses it to track which items a user has already read.
export interface NewsItem {
  id: string
  title: string
  date: string // YYYY-MM-DD
  body: string // plain text; blank lines separate paragraphs
}

export const NEWS_ITEMS: NewsItem[] = [
  {
    id: 'qr-step-2026-07',
    title: 'New QR Code Step Tutorial',
    date: '2026-07-21',
    body: `Hey team! 👋 A few fresh changes to make your visits smoother:

📱 New QR Code step
On some visits you'll now see a QR code appear. Just ask the customer to scan it with their phone camera — quick, easy, done. That's the whole trick. No extra admin for you.

⏰ Visits are now same-time only
Visits can no longer be completed after hours. Wrap each one up right there on the spot while you're still with the customer. Do it now, thank yourself later. 😄

📸 Screenshots still welcome
You can still upload a saved screenshot for the Goldrush capture — keep doing your thing, nothing changes there.

Questions? Give your team lead a shout. Happy selling! 🚀`,
  },
]
