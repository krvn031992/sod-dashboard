import { can } from '../lib/roles'
import {
  HomeIcon,
  ClockIcon,
  ClipboardIcon,
  CheckSquareIcon,
  LedgerIcon,
  ApprovalIcon,
  MegaphoneIcon,
  UsersIcon,
  UserIcon,
  RetentionIcon,
  ScoreboardIcon,
  TargetIcon,
  CalendarIcon,
  ChatIcon,
  ClassesIcon,
  ScheduleIcon,
} from './icons'

// The four daily-ops items shown in the mobile bottom bar.
export const CORE = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/attendance', label: 'Attendance', icon: ClockIcon },
  { to: '/endorsement', label: 'Endorse', icon: ClipboardIcon },
  { to: '/tasks', label: 'Tasks', icon: CheckSquareIcon },
]

// Full grouped navigation, role-gated. Used by the desktop sidebar and the
// mobile "More" menu.
export function navSections(role) {
  const sections = [
    {
      title: 'Daily',
      items: [...CORE, { to: '/schedule', label: 'Schedule', icon: ScheduleIcon }],
    },
    {
      title: 'Comms',
      items: [
        { to: '/announcements', label: 'Announcements', icon: MegaphoneIcon },
        { to: '/chat', label: 'Chat', icon: ChatIcon },
      ],
    },
    {
      title: 'Oversight',
      items: [
        { to: '/approvals', label: 'Approvals', icon: ApprovalIcon },
        ...(can.viewLedger(role) ? [{ to: '/ledger', label: 'Ledger', icon: LedgerIcon }] : []),
      ],
    },
    {
      title: 'Strategy',
      items: [
        ...(can.viewRetention(role)
          ? [{ to: '/retention', label: 'Retention', icon: RetentionIcon }]
          : []),
        { to: '/scoreboard', label: 'Scoreboard', icon: ScoreboardIcon },
        { to: '/goals', label: 'Goals', icon: TargetIcon },
        { to: '/calendar', label: 'Calendar', icon: CalendarIcon },
        ...(can.manageClasses(role)
          ? [{ to: '/classes', label: 'Classes', icon: ClassesIcon }]
          : []),
      ],
    },
    {
      title: 'Account',
      items: [
        ...(role === 'ceo' || role === 'coo'
          ? [{ to: '/team', label: 'Team', icon: UsersIcon }]
          : []),
        { to: '/profile', label: 'Profile', icon: UserIcon },
      ],
    },
  ]
  return sections.filter((s) => s.items.length > 0)
}
