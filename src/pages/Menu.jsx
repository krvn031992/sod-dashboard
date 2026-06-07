import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { roleLabel } from '../lib/roles'
import { navSections } from '../components/navConfig'
import { Avatar, Button } from '../components/ui'
import { LogoutIcon } from '../components/icons'

// Mobile-only hub reached from the bottom-bar "More" tab. Lists every section
// the current role can access, grouped.
export default function Menu() {
  const { profile, role, signOut } = useAuth()
  const navigate = useNavigate()
  const sections = navSections(role)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="space-y-6">
      <div className="panel flex items-center gap-3 p-4">
        <Avatar name={profile?.full_name} src={profile?.profile_photo_url} size={48} />
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink">{profile?.full_name || 'Member'}</div>
          <div className="text-xs text-gold">{roleLabel(role)}</div>
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.title}>
          <div className="eyebrow mb-2">{section.title}</div>
          <div className="grid grid-cols-2 gap-3">
            {section.items.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="panel flex items-center gap-3 p-4 transition hover:border-gold/40"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/12 text-gold">
                  <Icon width={20} height={20} />
                </span>
                <span className="text-sm font-semibold text-ink">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <Button variant="subtle" size="block" onClick={handleSignOut}>
        <LogoutIcon width={18} height={18} />
        Sign out
      </Button>
    </div>
  )
}
