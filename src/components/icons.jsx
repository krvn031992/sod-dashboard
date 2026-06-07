// Minimal line icons (stroke = currentColor). No emoji in UI per brand guidelines.
const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export const HomeIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </svg>
)

export const UsersIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.5a3 3 0 0 1 0 5.8" />
    <path d="M17 14.4A5.5 5.5 0 0 1 20.5 20" />
  </svg>
)

export const UserIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </svg>
)

export const LogoutIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 12H3" />
    <path d="m6 8-4 4 4 4" />
  </svg>
)

export const ClockIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
)

export const ClipboardIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <path d="M9 4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6H9z" />
    <path d="M9 11h6M9 15h4" />
  </svg>
)

export const CheckSquareIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M9.5 12.5l2 2 4-4.5" />
    <rect x="4" y="4" width="16" height="16" rx="3" />
  </svg>
)

export const LedgerIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="4" y="3.5" width="16" height="17" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </svg>
)

export const ApprovalIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3l2.4 1.6 2.8-.3 1.2 2.6 2.4 1.5-.6 2.8.6 2.8-2.4 1.5-1.2 2.6-2.8-.3L12 21l-2.4-1.6-2.8.3-1.2-2.6L3.2 15.6 3.8 12.8 3.2 10l2.4-1.5L6.8 5.9l2.8.3z" />
    <path d="M9.5 12l1.8 1.8L15 9.8" />
  </svg>
)

export const MegaphoneIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 10v4a1 1 0 0 0 1 1h2l8 4V5L7 9H5a1 1 0 0 0-1 1z" />
    <path d="M18 9a3 3 0 0 1 0 6" />
  </svg>
)

export const RetentionIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 18V6M4 18h16" />
    <path d="M7 15l3.5-4 3 2.5L20 7" />
  </svg>
)

export const ScoreboardIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="4" y="11" width="3.5" height="9" rx="1" />
    <rect x="10.25" y="6" width="3.5" height="14" rx="1" />
    <rect x="16.5" y="9" width="3.5" height="11" rx="1" />
  </svg>
)

export const TargetIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4.4" />
    <circle cx="12" cy="12" r="1" />
  </svg>
)

export const CalendarIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="5" width="17" height="16" rx="2" />
    <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
  </svg>
)

export const ChatIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 5.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H9l-4 3.5V17H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z" />
    <path d="M8 10h8M8 13h5" />
  </svg>
)

export const MoreIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="6" cy="12" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="18" cy="12" r="1.4" />
  </svg>
)

export const SparkIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18" opacity="0.55" />
  </svg>
)
