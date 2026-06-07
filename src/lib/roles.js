// Role definitions + capability matrix (mirrors §4 of the build spec and the
// RLS policies in supabase/migrations). The UI hides what a role can't do;
// Supabase RLS is the real enforcement. Keep the two in sync.

export const ROLES = {
  ceo: { label: 'CEO', tier: 1 },
  coo: { label: 'COO', tier: 2 },
  admin_manager: { label: 'Admin Manager', tier: 3 },
  admin_staff: { label: 'Admin Staff', tier: 3 },
  marketing: { label: 'Marketing', tier: 3 },
}

export const roleLabel = (role) => ROLES[role]?.label ?? 'Member'

const MANAGER_PLUS = ['ceo', 'coo', 'admin_manager']

// The two role-tied numbers each role logs in the daily endorsement (spec §6.4).
const METRICS = {
  ceo: ['Decisions made', 'Blockers cleared'],
  coo: ['Decisions made', 'Blockers cleared'],
  admin_manager: ['Enrollments', 'Re-enrollments'],
  admin_staff: ['Inquiries handled', 'Follow-ups'],
  marketing: ['Content shipped', 'Leads'],
}

export const roleMetrics = (role) => METRICS[role] ?? ['Metric one', 'Metric two']

// Capability checks used for UI gating.
export const can = {
  manageUsers: (r) => r === 'ceo',
  addStaff: (r) => r === 'ceo' || r === 'coo', // COO may add, CEO manages everything
  editAnyProfile: (r) => r === 'ceo',
  viewLedger: (r) => MANAGER_PLUS.includes(r),
  inputLedger: (r) => r === 'ceo' || r === 'admin_manager',
  editLedger: (r) => r === 'ceo', // edit/delete existing entries
  viewAudit: (r) => MANAGER_PLUS.includes(r),
  assignTasks: (r) => MANAGER_PLUS.includes(r),
  viewAllTasks: (r) => MANAGER_PLUS.includes(r),
  viewAllEndorsements: (r) => MANAGER_PLUS.includes(r),
  viewAllAttendance: (r) => MANAGER_PLUS.includes(r),
  postAnnouncements: (r) => r === 'ceo' || r === 'coo',
  sendReminder: (r) => r === 'ceo' || r === 'coo',
  editGoals: (r) => r === 'ceo' || r === 'coo',
  editScoreboard: (r) => r === 'ceo' || r === 'coo',
  editCalendar: (r) => r === 'ceo' || r === 'coo',
  inputCustomers: (r) => r === 'ceo' || r === 'admin_manager',
  manageClasses: (r) => r === 'ceo' || r === 'coo' || r === 'admin_manager',
  approveItems: (r) => r === 'ceo',
  viewRetention: (r) => MANAGER_PLUS.includes(r),
}
