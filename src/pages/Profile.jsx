import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { roleLabel } from '../lib/roles'
import { Card, CardTitle, Field, Input, Select, Button, Avatar, Badge } from '../components/ui'

const BRANCHES = ['BGC', 'Manila', 'Quezon City']

export default function Profile() {
  const { profile, role, isDemo, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [branch, setBranch] = useState(profile?.branch || '')
  const [photoUrl, setPhotoUrl] = useState(profile?.profile_photo_url || '')
  const [status, setStatus] = useState(null) // {tone, msg}
  const [busy, setBusy] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    setStatus(null)

    if (isDemo) {
      setStatus({ tone: 'gold', msg: 'Demo mode — changes are not saved. Connect Supabase to persist.' })
      return
    }

    setBusy(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, branch, profile_photo_url: photoUrl || null })
      .eq('id', profile.id)
    setBusy(false)

    if (error) setStatus({ tone: 'bad', msg: error.message })
    else {
      await refreshProfile()
      setStatus({ tone: 'ok', msg: 'Profile updated.' })
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <div className="eyebrow mb-1">Account</div>
        <h1 className="text-2xl font-semibold text-ink">My profile</h1>
      </header>

      <Card>
        <div className="flex items-center gap-4">
          <Avatar name={fullName} src={photoUrl} size={64} />
          <div>
            <div className="text-lg font-semibold text-ink">{fullName || 'Member'}</div>
            <div className="mt-0.5 flex items-center gap-2">
              <Badge tone="gold">{roleLabel(role)}</Badge>
              {branch && <Badge tone="neutral">{branch}</Badge>}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle eyebrow="Editable" title="Details" />
        <form onSubmit={save} className="space-y-4">
          <Field label="Full name" htmlFor="fullName">
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </Field>

          <Field label="Branch" htmlFor="branch">
            <Select id="branch" value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">— Select branch —</option>
              {BRANCHES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Profile photo URL"
            htmlFor="photoUrl"
            hint="Phase 1 accepts a link. Direct upload to Supabase Storage lands in a later phase."
          >
            <Input
              id="photoUrl"
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://…"
            />
          </Field>

          <Field label="Email">
            <Input value={profile?.email || ''} disabled />
          </Field>

          <Field label="Role">
            <Input value={roleLabel(role)} disabled />
          </Field>
          <p className="-mt-2 text-xs text-ink-mute">
            Role, email, and active status can only be changed by the CEO.
          </p>

          {status && (
            <p
              className={`rounded-lg border px-3 py-2 text-sm ${
                status.tone === 'ok'
                  ? 'border-ok/30 bg-ok/10 text-ok'
                  : status.tone === 'bad'
                    ? 'border-bad/30 bg-bad/10 text-bad'
                    : 'border-gold/30 bg-gold/10 text-gold'
              }`}
            >
              {status.msg}
            </p>
          )}

          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </Card>

      <ChangePassword isDemo={isDemo} />

      <Card className="panel-hairline">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink">Session</div>
            <div className="text-xs text-ink-mute">Sign out of this device.</div>
          </div>
          <Button
            variant="subtle"
            onClick={async () => {
              await signOut()
              navigate('/login')
            }}
          >
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  )
}

function ChangePassword({ isDemo }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setStatus(null)
    if (pw.length < 6) {
      setStatus({ tone: 'bad', msg: 'Password must be at least 6 characters.' })
      return
    }
    if (pw !== pw2) {
      setStatus({ tone: 'bad', msg: 'The two passwords do not match.' })
      return
    }
    if (isDemo) {
      setStatus({ tone: 'gold', msg: 'Demo mode — password change is disabled.' })
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) setStatus({ tone: 'bad', msg: error.message })
    else {
      setStatus({ tone: 'ok', msg: 'Password updated.' })
      setPw('')
      setPw2('')
    }
  }

  return (
    <Card>
      <CardTitle eyebrow="Security" title="Change my password" />
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password">
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 6 characters"
          />
        </Field>
        <Field label="Confirm new password">
          <Input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        {status && (
          <p
            className={`rounded-lg border px-3 py-2 text-sm ${
              status.tone === 'ok'
                ? 'border-ok/30 bg-ok/10 text-ok'
                : status.tone === 'bad'
                  ? 'border-bad/30 bg-bad/10 text-bad'
                  : 'border-gold/30 bg-gold/10 text-gold'
            }`}
          >
            {status.msg}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </Card>
  )
}
