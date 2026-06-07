import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { roleLabel } from '../lib/roles'
import { LogoLockup, LogoMark } from './Logo'
import { Avatar, Badge } from './ui'
import { LogoutIcon, UsersIcon, MoreIcon } from './icons'
import { CORE, navSections } from './navConfig'

export default function AppShell({ children }) {
  const { profile, role, signOut, isDemo } = useAuth()
  const navigate = useNavigate()
  const canTeam = role === 'ceo' || role === 'coo'
  const sections = navSections(role)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  // Bottom nav: the four daily items + a "More" entry to the menu.
  const bottomItems = [...CORE, { to: '/menu', label: 'More', icon: MoreIcon }]

  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[260px_1fr]">
      {/* ---- Desktop sidebar ---- */}
      <aside className="sticky top-0 hidden h-[100dvh] flex-col overflow-y-auto border-r border-white/8 bg-plum-900/60 px-5 py-6 lg:flex">
        <div className="px-1">
          <LogoLockup />
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-5">
          {sections.map((section) => (
            <div key={section.title}>
              <div className="mb-1.5 px-3 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-ink-mute">
                {section.title}
              </div>
              <div className="flex flex-col gap-1">
                {section.items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink key={to} to={to} end={end} className={sideLink}>
                    <Icon width={20} height={20} />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <UserCard profile={profile} role={role} isDemo={isDemo} onSignOut={handleSignOut} />
      </aside>

      {/* ---- Main column ---- */}
      <div className="flex min-h-[100dvh] flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/8 bg-plum-900/80 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2.5">
            <LogoMark size={30} />
            <div className="font-display text-sm font-semibold tracking-wide">State of Dance</div>
          </div>
          <div className="flex items-center gap-2">
            {isDemo && <Badge tone="gold">Demo</Badge>}
            {canTeam && (
              <NavLink
                to="/team"
                aria-label="Team & permissions"
                className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-ink-soft"
              >
                <UsersIcon width={18} height={18} />
              </NavLink>
            )}
            <NavLink to="/profile" aria-label="Profile">
              <Avatar name={profile?.full_name} src={profile?.profile_photo_url} size={34} />
            </NavLink>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 lg:px-8 lg:pt-8 lg:pb-10">
          {children}
        </main>
      </div>

      {/* ---- Mobile bottom nav ---- */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex items-stretch border-t border-white/10 bg-plum-900/95 backdrop-blur lg:hidden">
        {bottomItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={bottomLink}>
            <Icon width={21} height={21} />
            <span className="text-[0.62rem] font-semibold">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function UserCard({ profile, role, isDemo, onSignOut }) {
  return (
    <div className="mt-4 rounded-2xl border border-white/8 bg-plum-950/40 p-3">
      <div className="flex items-center gap-3">
        <Avatar name={profile?.full_name} src={profile?.profile_photo_url} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink">
            {profile?.full_name || 'Member'}
          </div>
          <div className="truncate text-xs text-gold">{roleLabel(role)}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        {isDemo ? <Badge tone="gold">Demo mode</Badge> : <span />}
        <button
          onClick={onSignOut}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-mute hover:text-ink"
        >
          <LogoutIcon width={16} height={16} />
          Sign out
        </button>
      </div>
    </div>
  )
}

const sideLink = ({ isActive }) =>
  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ' +
  (isActive ? 'bg-gold/12 text-gold' : 'text-ink-soft hover:bg-white/5 hover:text-ink')

const bottomLinkBase =
  'flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition'

const bottomLink = ({ isActive }) =>
  `${bottomLinkBase} ${isActive ? 'text-gold' : 'text-ink-mute'}`
