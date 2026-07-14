// Test credentials come from env — never commit real credentials.
// Later stages extend this map to all 9 staff roles + 1 company portal login.
export const ROLE_CREDS: Record<string, { email?: string; password?: string }> = {
  agent: { email: process.env.E2E_AGENT_EMAIL, password: process.env.E2E_AGENT_PASSWORD },
  team_lead: { email: process.env.E2E_TEAM_LEAD_EMAIL, password: process.env.E2E_TEAM_LEAD_PASSWORD },
  general_manager: { email: process.env.E2E_GM_EMAIL, password: process.env.E2E_GM_PASSWORD },
}

export function haveCreds(role: string): boolean {
  const c = ROLE_CREDS[role]
  return Boolean(c?.email && c?.password)
}
