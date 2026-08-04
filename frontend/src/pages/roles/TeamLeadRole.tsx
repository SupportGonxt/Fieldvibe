import { UserCheck } from 'lucide-react'
import RoleGuide, { type RoleGuideContent } from './RoleGuide'

const CONTENT: RoleGuideContent = {
  role: 'Team Lead',
  icon: UserCheck,
  purpose:
    'Team leads oversee daily field agent performance, make sure agents are checking in on their assigned visits, and escalate issues to managers when agents fall silent for too long.',
  tasks: [
    'Check who hasn’t logged a visit today (see the "Active Today" KPI on your Team tab).',
    'Action any escalation nudges within the hour (see the Escalation Report).',
    'Review your team’s performance (see the Team Performance section on your Team tab).',
  ],
  links: [
    { label: 'Your team’s roster', hint: 'Team tab', to: '/agent/team' },
    { label: 'Active Today KPI', hint: 'Top of the Team tab', to: '/agent/team' },
    { label: 'Escalation report', hint: 'Reports menu → Escalations' },
    { label: 'Performance data', hint: 'Team tab → Performance', to: '/agent/team' },
  ],
}

export default function TeamLeadRole() {
  return <RoleGuide variant="dark" {...CONTENT} />
}
