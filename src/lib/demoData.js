// In-memory data for DEMO mode (no Supabase credentials yet).
// Lets the team preview the dashboard and role-based views before the
// backend is wired. None of this persists — it resets on reload.

export const DEMO_PROFILES = [
  {
    id: 'demo-ceo',
    full_name: 'Kervin Mendiola',
    role: 'ceo',
    email: 'ceo@stateofdance.demo',
    branch: 'BGC',
    profile_photo_url: null,
    active: true,
  },
  {
    id: 'demo-coo',
    full_name: 'Bea Santos',
    role: 'coo',
    email: 'coo@stateofdance.demo',
    branch: 'Manila',
    profile_photo_url: null,
    active: true,
  },
  {
    id: 'demo-mgr',
    full_name: 'Rafael Cruz',
    role: 'admin_manager',
    email: 'manager@stateofdance.demo',
    branch: 'Quezon City',
    profile_photo_url: null,
    active: true,
  },
  {
    id: 'demo-mkt',
    full_name: 'Liza Reyes',
    role: 'marketing',
    email: 'marketing@stateofdance.demo',
    branch: 'BGC',
    profile_photo_url: null,
    active: true,
  },
  {
    id: 'demo-staff',
    full_name: 'Marco Dela Peña',
    role: 'admin_staff',
    email: 'staff@stateofdance.demo',
    branch: 'Manila',
    profile_photo_url: null,
    active: true,
  },
]

const today = () => new Date().toISOString().slice(0, 10)
const manilaToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
// The 15th of the month N months before now (YYYY-MM-15).
const monthsAgoMid = (n) => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - n)
  return d.toISOString().slice(0, 7) + '-15'
}
// One demo attendance row N days ago with given check-in/out clock times.
function demoMonthDay(userId, daysAgo, inHM, outHM) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  const wd = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  const ts = (hm) => new Date(`${wd}T${hm}:00+08:00`).toISOString()
  return [
    {
      id: `da-${userId}-${daysAgo}`,
      user_id: userId,
      work_date: wd,
      check_in_ts: ts(inHM),
      check_out_ts: ts(outHM),
      check_in_photo_url: DEMO_SELFIE,
      check_out_photo_url: DEMO_SELFIE,
    },
  ]
}
// Stand-in "selfie" for demo mode (real selfies are camera photos in a private bucket).
const DEMO_SELFIE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#3a1150"/><circle cx="60" cy="46" r="22" fill="#deb060"/><rect x="26" y="74" width="68" height="40" rx="20" fill="#deb060"/></svg>',
  )
// Monday of the current week (YYYY-MM-DD).
const weekStart = () => {
  const d = new Date()
  const day = (d.getDay() + 6) % 7 // 0 = Monday
  d.setDate(d.getDate() - day)
  return d.toISOString().slice(0, 10)
}

// Mutable in-memory stores for DEMO mode. Persist only for the session.
export const demoStore = {
  tasks: [
    {
      id: 'dt-1',
      title: 'Finalize recital run sheet',
      description: 'Lock the order of numbers with the production team.',
      assigned_to: 'demo-mgr',
      assigned_by: 'demo-ceo',
      due_date: today(),
      status: 'in_progress',
      created_at: new Date().toISOString(),
    },
    {
      id: 'dt-2',
      title: 'Call back adult-class inquiries',
      description: 'Follow up on weekend walk-ins for the adult hip-hop class.',
      assigned_to: 'demo-staff',
      assigned_by: 'demo-mgr',
      due_date: today(),
      status: 'open',
      created_at: new Date().toISOString(),
    },
    {
      id: 'dt-3',
      title: 'Ship June re-enrollment reminder post',
      description: 'Schedule the IG + FB reminder for parents.',
      assigned_to: 'demo-mkt',
      assigned_by: 'demo-coo',
      due_date: today(),
      status: 'done',
      created_at: new Date().toISOString(),
    },
  ],
  endorsements: [
    { id: 'de-mgr', user_id: 'demo-mgr', work_date: today(), completed: 'Closed 4 re-enrollments; prepped QC roster', blocked: 'Waiting on 2 medical certs', next: 'Call BGC waitlist', metric_one: 6, metric_two: 4 },
    { id: 'de-mkt', user_id: 'demo-mkt', work_date: today(), completed: 'Shipped 2 reels + 1 carousel', blocked: 'Carousel pending approval', next: 'Draft parent email', metric_one: 3, metric_two: 9 },
    { id: 'de-staff', user_id: 'demo-staff', work_date: today(), completed: 'Handled walk-ins and phone inquiries', blocked: '', next: 'Follow up on 3 trial bookings', metric_one: 11, metric_two: 5 },
  ],
  attendance: [
    {
      id: 'da-seed',
      user_id: 'demo-staff',
      work_date: manilaToday(),
      check_in_ts: new Date(Date.now() - 7200000).toISOString(),
      check_out_ts: null,
      check_in_photo_url: DEMO_SELFIE,
      check_out_photo_url: null,
    },
    // A couple of earlier days this month so the per-employee summary has data.
    ...demoMonthDay('demo-staff', 2, '09:05', '17:35'),
    ...demoMonthDay('demo-staff', 3, '09:00', '16:50'),
    ...demoMonthDay('demo-mgr', 2, '08:45', '18:10'),
  ],
  ledger: [
    // Current month
    { id: 'dl-1', entry_date: today(), type: 'income', category: 'Tuition', amount: 48500, branch: 'BGC', note: 'Enrollments', entered_by: 'demo-mgr' },
    { id: 'dl-2', entry_date: today(), type: 'income', category: 'Recital tickets', amount: 31100, branch: 'Manila', note: 'VIP + GA', entered_by: 'demo-mgr' },
    { id: 'dl-3', entry_date: today(), type: 'expense', category: 'Venue', amount: 22000, branch: 'Manila', note: 'Aliw deposit', entered_by: 'demo-ceo' },
    { id: 'dl-4', entry_date: today(), type: 'expense', category: 'Payroll', amount: 18750, branch: 'BGC', note: 'Instructors', entered_by: 'demo-ceo' },
    // Last month
    { id: 'dl-5', entry_date: monthsAgoMid(1), type: 'income', category: 'Tuition', amount: 45200, branch: 'BGC', note: '', entered_by: 'demo-mgr' },
    { id: 'dl-6', entry_date: monthsAgoMid(1), type: 'expense', category: 'Payroll', amount: 17500, branch: 'BGC', note: '', entered_by: 'demo-ceo' },
    { id: 'dl-7', entry_date: monthsAgoMid(1), type: 'expense', category: 'Marketing', amount: 6500, branch: 'Manila', note: 'Ads', entered_by: 'demo-mkt' },
    // Two months ago
    { id: 'dl-8', entry_date: monthsAgoMid(2), type: 'income', category: 'Tuition', amount: 39800, branch: 'Quezon City', note: '', entered_by: 'demo-mgr' },
    { id: 'dl-9', entry_date: monthsAgoMid(2), type: 'expense', category: 'Rent', amount: 15000, branch: 'Quezon City', note: '', entered_by: 'demo-ceo' },
  ],
  announcements: [
    {
      id: 'dan-1',
      author_id: 'demo-coo',
      author_name: 'Bea Santos',
      title: 'Recital music submissions due Friday',
      body: 'All branch leads, please upload final track lists to the shared drive by EOD Friday so production can lock the run sheet.',
      urgent: true,
      created_at: new Date().toISOString(),
    },
  ],
  approvals: [
    {
      id: 'dap-1',
      submitted_by: 'demo-mkt',
      submitter_name: 'Liza Reyes',
      item_type: 'marketing_post',
      title: 'June re-enrollment IG carousel',
      detail: 'Draft caption + 5 slides for parents. Needs sign-off before posting.',
      status: 'pending',
      created_at: new Date().toISOString(),
    },
  ],
  customers: buildDemoCustomers(),
  goals: [
    { id: 'dg-1', title: 'Recital ticket sales', target: 900, current: 311, owner: 'demo-mgr', due_date: '2026-06-28', status: 'active' },
    { id: 'dg-2', title: 'Adult enrollees (Q3)', target: 40, current: 19, owner: 'demo-mkt', due_date: '2026-09-30', status: 'active' },
    { id: 'dg-3', title: 'Re-enrollment rate', target: 85, current: 78, owner: 'demo-ceo', due_date: '2026-12-31', status: 'active' },
  ],
  benchmarks: [
    { id: 'db-1', week_start: weekStart(), metric_name: 'Enrollment count', our_value: 42, notes: '' },
    { id: 'db-2', week_start: weekStart(), metric_name: 'Re-enrollment rate', our_value: 78, notes: '%' },
    { id: 'db-3', week_start: weekStart(), metric_name: 'Adult-segment count', our_value: 19, notes: '' },
    { id: 'db-4', week_start: weekStart(), metric_name: 'Recital ticket sales', our_value: 311, notes: '' },
    { id: 'db-5', week_start: weekStart(), metric_name: 'Lead-to-enrollment rate', our_value: 24, notes: '%' },
  ],
  classes: [
    { id: 'dcl-1', name: 'Ballet', active: true },
    { id: 'dcl-2', name: 'Hip-hop', active: true },
    { id: 'dcl-3', name: 'Jazz', active: true },
    { id: 'dcl-4', name: 'Contemporary', active: true },
    { id: 'dcl-5', name: 'Adult', active: true },
  ],
  messages: [
    { id: 'dm-1', channel: 'general', sender_id: 'demo-coo', body: 'Morning team! Recital run sheet is locked — great work everyone.', attachment_url: null, created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: 'dm-2', channel: 'general', sender_id: 'demo-mkt', body: 'Posting the re-enrollment carousel once it clears approval ✅', attachment_url: null, created_at: new Date(Date.now() - 1800000).toISOString() },
    { id: 'dm-3', channel: 'general', sender_id: 'demo-mgr', body: 'BGC adult class is almost full for July.', attachment_url: null, created_at: new Date(Date.now() - 600000).toISOString() },
  ],
  calendar: [
    { id: 'dc-1', title: 'Term 2 classes begin', category: 'term', event_date: '2026-01-13', notes: '' },
    { id: 'dc-2', title: 'Recital music submission deadline', category: 'deadline', event_date: '2026-06-12', notes: 'Final track lists' },
    { id: 'dc-3', title: 'Recital — Fantasy', category: 'recital', event_date: '2026-06-28', notes: 'Aliw Theater' },
    { id: 'dc-4', title: 'Adult enrollment window', category: 'enrollment', event_date: '2026-07-01', end_date: '2026-07-31', notes: '' },
    { id: 'dc-5', title: 'Branch photoshoot', category: 'photoshoot', event_date: '2026-09-05', notes: '' },
  ],
}

// Two years of enrollment rows so the retention math has something to chew on.
function buildDemoCustomers() {
  const branches = ['BGC', 'Manila', 'Quezon City']
  const formats = ['Ballet', 'Hip-hop', 'Jazz', 'Adult']
  const rows = []
  let n = 0
  const add = (master, year, branch, format) =>
    rows.push({
      id: 'dcu-' + n++,
      master_customer_id: master,
      name: `Student ${master}`,
      branch,
      class_format: format,
      enrolled_year: year,
      recital_year: year,
      status: 'active',
    })
  // 2024 cohort of 40
  for (let i = 1; i <= 40; i++) {
    add(`C${i}`, 2024, branches[i % 3], formats[i % 4])
  }
  // 2025: ~31 of them re-enroll (≈78%) + 12 new
  for (let i = 1; i <= 31; i++) {
    add(`C${i}`, 2025, branches[i % 3], formats[i % 4])
  }
  for (let i = 41; i <= 52; i++) {
    add(`C${i}`, 2025, branches[i % 3], formats[i % 4])
  }
  return rows
}

// Headline numbers shown on the CEO home in demo mode.
export const DEMO_OVERVIEW = {
  attendance: { checkedIn: 7, team: 10 },
  pendingApprovals: 3,
  reEnrollmentRate: 0.78,
  scoreboard: [
    { metric: 'Enrollment (wk)', value: '42' },
    { metric: 'Re-enrollment rate', value: '78%' },
    { metric: 'Adult segment', value: '19' },
    { metric: 'Recital tickets', value: '311' },
    { metric: 'Lead → enroll', value: '24%' },
  ],
  goals: [
    { title: 'Recital ticket sales', current: 311, target: 900 },
    { title: 'Adult enrollees (Q3)', current: 19, target: 40 },
    { title: 'Re-enrollment rate', current: 78, target: 85 },
  ],
  announcement: {
    title: 'Recital music submissions due Friday',
    body: 'All branch leads, please upload final track lists to the shared drive by EOD Friday so the production team can lock the run sheet.',
    author: 'Bea Santos',
  },
}
