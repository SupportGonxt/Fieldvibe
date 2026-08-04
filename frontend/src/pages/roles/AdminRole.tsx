import { Shield } from 'lucide-react'
import RoleGuide, { type RoleGuideContent } from './RoleGuide'

const CONTENT: RoleGuideContent = {
  role: 'Admin',
  icon: Shield,
  purpose:
    'Admins manage the entire FieldVibe tenant — settings, roles, user management, and tenant-wide visibility into all field operations across all companies.',
  tasks: [
    'Monitor tenant-wide activity (see the "Active Today" KPI on the Admin Dashboard).',
    'Review escalations requiring action (see the Escalation Report).',
    'Manage user roles, company assignments, and system settings (see the Admin Dashboard).',
  ],
  links: [
    { label: 'Tenant dashboard', hint: 'Admin Dashboard', to: '/admin/dashboard' },
    { label: 'Active Today KPI', hint: 'Top of the Admin Dashboard', to: '/admin/dashboard' },
    { label: 'Escalation report', hint: 'Reports menu → Escalations' },
    { label: 'User management', hint: 'Admin Dashboard → Users', to: '/admin/users' },
    { label: 'Company toggles', hint: 'Company selector buttons — view Goldrush, Stellr, or All' },
  ],
}

export default function AdminRole() {
  return <RoleGuide variant="light" {...CONTENT} />
}
