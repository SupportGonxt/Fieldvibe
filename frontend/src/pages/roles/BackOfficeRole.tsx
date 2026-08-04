import { Headphones } from 'lucide-react'
import RoleGuide, { type RoleGuideContent } from './RoleGuide'

const CONTENT: RoleGuideContent = {
  role: 'Back Office',
  icon: Headphones,
  purpose:
    'Back office handles reconciliation, reviews, and final escalation action — closing gaps in ID uploads, validating commissions, and reaching out to non-responding agents or teams.',
  tasks: [
    'Review the reconciliation queues (unmatched deposits, photos pending, KYC pending).',
    'Action any escalated rows once Hour 3 has passed (see the Escalation Report).',
    'Make outbound contact calls for final escalations (see the Back Office Call List).',
  ],
  links: [
    { label: 'Call list', hint: 'Back Office home → Call List', to: '/agent/call-list' },
    { label: 'Reconciliation', hint: 'Back Office → Reconcile tab', to: '/agent/reconcile' },
    { label: 'Escalation report', hint: 'Reports menu → Escalations' },
    { label: 'Company toggles', hint: 'Company selector buttons — filter by Goldrush or Stellr' },
  ],
}

export default function BackOfficeRole() {
  return <RoleGuide variant="dark" {...CONTENT} />
}
