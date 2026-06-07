import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { DEMO_PROFILES } from '../lib/demoData'

const AuthContext = createContext(null)

// In demo mode, restore a previously chosen identity synchronously so we never
// have to setState inside an effect just to bootstrap.
function initialDemo() {
  if (isSupabaseConfigured) return { session: null, profile: null }
  const saved = sessionStorage.getItem('sod_demo_role')
  const p = saved ? DEMO_PROFILES.find((x) => x.role === saved) : null
  return p
    ? { session: { user: { id: p.id, email: p.email } }, profile: p }
    : { session: null, profile: null }
}

export function AuthProvider({ children }) {
  const seed = initialDemo()
  const [session, setSession] = useState(seed.session)
  const [profile, setProfile] = useState(seed.profile)
  // Live mode starts in a loading state until getSession resolves; demo is ready.
  const [loading, setLoading] = useState(isSupabaseConfigured)

  // ---- Profile fetch (live mode) ----
  const loadProfile = useCallback(async (userId) => {
    if (!userId) return setProfile(null)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) {
      console.error('Failed to load profile:', error.message)
      setProfile(null)
    } else {
      setProfile(data)
    }
  }, [])

  // ---- Bootstrap (live mode only; demo is seeded synchronously above) ----
  useEffect(() => {
    if (!isSupabaseConfigured) return

    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session?.user) await loadProfile(data.session.user.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      if (newSession?.user) await loadProfile(newSession.user.id)
      else setProfile(null)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  // ---- Actions ----
  const signIn = useCallback(async (email, password) => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Demo mode: use the role buttons to preview.' } }
    }
    return supabase.auth.signInWithPassword({ email, password })
  }, [])

  // Demo-only: assume a role to preview the app.
  const signInDemo = useCallback((role) => {
    const p = DEMO_PROFILES.find((x) => x.role === role)
    if (!p) return
    sessionStorage.setItem('sod_demo_role', role)
    setProfile(p)
    setSession({ user: { id: p.id, email: p.email } })
  }, [])

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) {
      sessionStorage.removeItem('sod_demo_role')
      setProfile(null)
      setSession(null)
      return
    }
    await supabase.auth.signOut()
  }, [])

  const value = useMemo(
    () => ({
      session,
      profile,
      role: profile?.role ?? null,
      loading,
      isDemo: !isSupabaseConfigured,
      signIn,
      signInDemo,
      signOut,
      refreshProfile: () => session?.user && loadProfile(session.user.id),
    }),
    [session, profile, loading, signIn, signInDemo, signOut, loadProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
