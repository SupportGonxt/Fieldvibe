import { Building2 } from 'lucide-react'
import RoleGuide, { type RoleGuideContent } from './RoleGuide'

const CONTENT: RoleGuideContent = {
  role: 'General Manager',
  icon: Building2,
  purpose:
    'General Managers oversee all field operations across all companies, serve as the final escalation authority, and make sure critical issues are resolved across the organization.',
  tasks: [
    'Monitor high-level escalation notifications (see the Escalation Report).',
    'Make sure back office and admin have actioned critical escalations.',
    'Review cross-company performance and KPIs (see the GM Overview).',
  ],
  links: [
    { label: 'General manager overview', hint: 'GM Overview', to: '/dashboard/gm' },
    { label: 'Escalation report', hint: 'Reports menu → Escalations' },
    { label: 'Final fallback notifications', hint: 'Notification Center' },
    { label: 'Cross-company view', hint: 'Company selector — view Goldrush, Stellr, or All' },
  ],
}

export default function GeneralManagerRole() {
  return <RoleGuide variant="light" {...CONTENT} />
}
