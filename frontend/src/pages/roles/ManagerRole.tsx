import { Briefcase } from 'lucide-react'
import RoleGuide, { type RoleGuideContent } from './RoleGuide'

const CONTENT: RoleGuideContent = {
  role: 'Manager',
  icon: Briefcase,
  purpose:
    'Managers oversee team leads across one or more field operations companies, make sure escalations are handled quickly, and track org-wide performance metrics.',
  tasks: [
    'Monitor team lead activity (see the "Active Today" KPI on your Manager Teams tab).',
    'Follow up on escalated agents once Hour 1 has passed (see the Escalation Report).',
    'Review manager-level KPIs (see your Manager Teams tab).',
  ],
  links: [
    { label: 'Your team leads’ roster', hint: 'Manager Teams tab', to: '/agent/teams' },
    { label: 'Active Today KPI', hint: 'Top of the Manager Teams tab', to: '/agent/teams' },
    { label: 'Escalation report', hint: 'Reports menu → Escalations' },
    { label: 'Company toggles', hint: 'Company selector buttons — filter by Goldrush or Stellr' },
  ],
}

export default function ManagerRole() {
  return <RoleGuide variant="dark" {...CONTENT} />
}
