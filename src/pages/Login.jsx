import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogoMark } from '../components/Logo'
import { Button, Field, Input } from '../components/ui'
import { DEMO_PROFILES } from '../lib/demoData'
import { roleLabel } from '../lib/roles'

export default function Login() {
  const { signIn, signInDemo, isDemo } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await signIn(email, password)
    setBusy(false)
    if (error) setError(error.message)
    else navigate('/')
  }

  const enterDemo = (role) => {
    signInDemo(role)
    navigate('/')
  }

  return (
    <div className="grid min-h-[100dvh] place-items-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoMark size={64} />
          <h1 className="mt-4 font-display text-2xl font-semibold text-ink">
            State of Dance
          </h1>
          <p className="mt-1 text-sm text-ink-soft">Internal Operating Dashboard</p>
        </div>

        <div className="panel p-6">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@stateofdance.com"
                required
                disabled={isDemo}
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isDemo}
              />
            </Field>

            {error && (
              <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">
                {error}
              </p>
            )}

            <Button type="submit" size="block" disabled={busy || isDemo}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          {isDemo && (
            <div className="mt-6 border-t border-white/8 pt-5">
              <p className="text-center text-xs font-semibold uppercase tracking-wider text-gold">
                Demo mode — no backend connected
              </p>
              <p className="mt-1 text-center text-xs text-ink-soft">
                Preview the dashboard as any role. Add Supabase keys in{' '}
                <code className="text-ink">.env.local</code> to enable real login.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2">
                {DEMO_PROFILES.map((p) => (
                  <button
                    key={p.role}
                    onClick={() => enterDemo(p.role)}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-plum-950/40 px-4 py-3 text-left transition hover:border-gold/40 hover:bg-gold/5"
                  >
                    <span className="text-sm font-semibold text-ink">{p.full_name}</span>
                    <span className="text-xs font-semibold text-gold">
                      {roleLabel(p.role)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-ink-mute">
          Authorized team access only. Logged-out sessions see nothing.
        </p>
      </div>
    </div>
  )
}
