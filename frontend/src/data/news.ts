// Team news / announcements shown in the home-screen News widget.
// To post a new item, add it to the TOP of this array (newest first). `id` must be
// unique and stable — the widget uses it to track which items a user has already read.
export interface NewsItem {
  id: string
  title: string
  date: string // YYYY-MM-DD
  body: string // plain text; blank lines separate paragraphs
  roles?: string[] // omit = everyone; otherwise only these roles see the item
}

export const NEWS_ITEMS: NewsItem[] = [
  {
    id: 'in-app-calls-2026-07',
    title: 'New: Call your agents from FieldVibe',
    date: '2026-07-22',
    roles: ['team_lead', 'manager', 'backoffice_admin', 'admin', 'general_manager', 'super_admin'],
    body: `Hey team! 📞 You can now call your field agents straight from FieldVibe.

🔎 Where to find it
Look for the Call button on any agent row — in the Agents call list (back office), on your team screens, or in the Team Cockpit on the web dashboard (Field Operations → Team Cockpit).

📲 How it works
Tap Call and the agent's FieldVibe app rings like a real phone call, for up to a minute. If they answer, you talk right there in the app over data — no airtime used.

☎️ No answer? We dial for you
If they don't pick up or they're offline, your phone's dialer opens automatically with their number already typed in — just press call to reach them over the normal phone network instead.

🎯 Everything counts
Every call attempt is logged in your call history and counts toward your daily call target.

Tip: the phone fallback dials the number saved on the agent's profile, so make sure your agents' numbers are up to date.`,
  },
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
