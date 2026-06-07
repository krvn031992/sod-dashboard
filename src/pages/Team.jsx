import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { ROLES, roleLabel, can } from '../lib/roles'
import { DEMO_PROFILES } from '../lib/demoData'
import { Card, CardTitle, Avatar, Badge, Select, Button, Field, Input } from '../components/ui'

const BRANCHES = ['BGC', 'Manila', 'Quezon City']

// Read an error message out of a functions.invoke result.
async function invokeError(error, data) {
  if (error) {
    let msg = error.message
    try {
      const ctx = await error.context?.json?.()
      if (ctx?.error) msg = ctx.error
    } catch {
      // keep generic message
    }
    return msg
  }
  if (data?.error) return data.error
  return null
}

// Readable temporary password the CEO/COO can hand over.
function tempPassword() {
  const words = ['Dance', 'Stage', 'Recital', 'Spotlight', 'Encore', 'Rhythm']
  const w = words[Math.floor(Math.random() * words.length)]
  return `${w}-${Math.floor(1000 + Math.random() * 9000)}`
}

export default function Team() {
  const { profile, role, isDemo } = useAuth()
  const isCeo = role === 'ceo'
  const canAdd = can.addStaff(role)

  const [rows, setRows] = useState(() =>
    isSupabaseConfigured ? [] : DEMO_PROFILES.map((p) => ({ ...p })),
  )
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [savingId, setSavingId] = useState(null)
  const [note, setNote] = useState(null)

  const fetchRows = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name')
    if (error) setNote({ tone: 'bad', msg: error.message })
    setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isSupabaseConfigured) fetchRows()
  }, [fetchRows])

  const editLocal = (id, changes) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...changes } : r)))

  const patch = async (id, changes) => {
    editLocal(id, changes)
    if (isDemo) {
      setNote({ tone: 'gold', msg: 'Demo mode — changes are not saved.' })
      return
    }
    setSavingId(id)
    const { error } = await supabase.from('profiles').update(changes).eq('id', id)
    setSavingId(null)
    if (error) {
      setNote({ tone: 'bad', msg: error.message })
      fetchRows()
    } else {
      setNote({ tone: 'ok', msg: 'Saved.' })
    }
  }

  const removeMember = async (member) => {
    if (isDemo) {
      setNote({ tone: 'gold', msg: 'Demo mode — deletion is disabled.' })
      return
    }
    setSavingId(member.id)
    const { data, error } = await supabase.functions.invoke('manage-staff', {
      body: { action: 'delete', user_id: member.id },
    })
    setSavingId(null)
    const errMsg = await invokeError(error, data)
    if (errMsg) {
      setNote({ tone: 'bad', msg: errMsg })
    } else {
      setRows((rs) => rs.filter((r) => r.id !== member.id))
      setNote({ tone: 'ok', msg: `Removed ${member.full_name || member.email}.` })
    }
  }

  const setPassword = async (member, password) => {
    if (isDemo) {
      setNote({ tone: 'gold', msg: 'Demo mode — password reset is disabled.' })
      return false
    }
    setSavingId(member.id)
    const { data, error } = await supabase.functions.invoke('manage-staff', {
      body: { action: 'set_password', user_id: member.id, password },
    })
    setSavingId(null)
    const errMsg = await invokeError(error, data)
    if (errMsg) {
      setNote({ tone: 'bad', msg: errMsg })
      return false
    }
    setNote({
      tone: 'ok',
      msg: `New password for ${member.full_name || member.email}: ${password} — give it to them.`,
    })
    return true
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow mb-1">{isCeo ? 'CEO controls' : 'COO controls'}</div>
          <h1 className="text-2xl font-semibold text-ink">Team &amp; permissions</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {isCeo
              ? 'Add people, set roles and branches, reset passwords, or remove access.'
              : 'Add staff to the team. Roles and removals are handled by the CEO.'}
          </p>
        </div>
        <Badge tone="neutral">{rows.length} members</Badge>
      </header>

      {note && (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            note.tone === 'ok'
              ? 'border-ok/30 bg-ok/10 text-ok'
              : note.tone === 'bad'
                ? 'border-bad/30 bg-bad/10 text-bad'
                : 'border-gold/30 bg-gold/10 text-gold'
          }`}
        >
          {note.msg}
        </p>
      )}

      {canAdd && (
        <AddStaff isCeo={isCeo} isDemo={isDemo} onAdded={fetchRows} setNote={setNote} />
      )}

      {loading ? (
        <Card>
          <p className="text-sm text-ink-soft">Loading team…</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              canManage={isCeo}
              isSelf={m.id === profile.id}
              saving={savingId === m.id}
              onEditLocal={editLocal}
              onPatch={patch}
              onDelete={removeMember}
              onSetPassword={setPassword}
            />
          ))}
        </div>
      )}

      <Card className="panel-hairline">
        <p className="text-sm text-ink-soft">
          {isCeo
            ? 'Add staff with the button above — logins are created instantly. Give each person the temporary password you set; they can change it after signing in. Removing a member deletes their login and data.'
            : 'New logins you create appear here. The CEO sets roles, resets passwords, and removes access.'}
        </p>
      </Card>
    </div>
  )
}

function MemberCard({ member: m, canManage, isSelf, saving, onEditLocal, onPatch, onDelete, onSetPassword }) {
  const [pwOpen, setPwOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  return (
    <Card className={`p-4 ${m.active ? '' : 'opacity-60'}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={m.full_name} src={m.profile_photo_url} size={44} />
          <div className="min-w-0 flex-1">
            {canManage ? (
              <input
                aria-label={`Name for ${m.email}`}
                value={m.full_name || ''}
                placeholder="Add name"
                onChange={(e) => onEditLocal(m.id, { full_name: e.target.value })}
                onBlur={(e) => onPatch(m.id, { full_name: e.target.value.trim() })}
                disabled={saving}
                className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 font-semibold text-ink hover:border-white/10 focus:border-gold/50 focus:bg-plum-950/50 focus:outline-none"
              />
            ) : (
              <div className="px-1 font-semibold text-ink">{m.full_name || 'Unnamed'}</div>
            )}
            <div className="truncate px-1 text-xs text-ink-mute">{m.email}</div>
          </div>
        </div>

        {canManage ? (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
            <Select
              aria-label={`Role for ${m.full_name}`}
              value={m.role}
              onChange={(e) => onPatch(m.id, { role: e.target.value })}
              disabled={saving}
              className="text-sm"
            >
              {Object.keys(ROLES).map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </Select>

            <Select
              aria-label={`Branch for ${m.full_name}`}
              value={m.branch || ''}
              onChange={(e) => onPatch(m.id, { branch: e.target.value || null })}
              disabled={saving}
              className="text-sm"
            >
              <option value="">No branch</option>
              {BRANCHES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>

            <Button
              variant={m.active ? 'subtle' : 'ghost'}
              size="sm"
              onClick={() => onPatch(m.id, { active: !m.active })}
              disabled={saving}
            >
              {m.active ? 'Deactivate' : 'Reactivate'}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Badge tone="gold">{roleLabel(m.role)}</Badge>
            {m.branch && <Badge tone="neutral">{m.branch}</Badge>}
          </div>
        )}
      </div>

      {/* CEO-only: reset password / remove */}
      {canManage && (
        <div className="mt-3 border-t border-white/6 pt-3">
          {!pwOpen && !confirmDel && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="subtle"
                size="sm"
                onClick={() => {
                  setPw(tempPassword())
                  setPwOpen(true)
                }}
                disabled={saving}
              >
                Reset password
              </Button>
              {!isSelf && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setConfirmDel(true)}
                  disabled={saving}
                >
                  Remove
                </Button>
              )}
            </div>
          )}

          {pwOpen && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[180px]">
                <Field label="New temporary password">
                  <Input value={pw} onChange={(e) => setPw(e.target.value)} />
                </Field>
              </div>
              <Button
                size="sm"
                disabled={saving}
                onClick={async () => {
                  const ok = await onSetPassword(m, pw)
                  if (ok) setPwOpen(false)
                }}
              >
                Save password
              </Button>
              <Button variant="subtle" size="sm" onClick={() => setPwOpen(false)}>
                Cancel
              </Button>
            </div>
          )}

          {confirmDel && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink-soft">
                Remove {m.full_name || m.email}? This deletes their login and data.
              </span>
              <Button
                variant="danger"
                size="sm"
                disabled={saving}
                onClick={() => onDelete(m)}
              >
                {saving ? 'Removing…' : 'Yes, remove'}
              </Button>
              <Button variant="subtle" size="sm" onClick={() => setConfirmDel(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function AddStaff({ isCeo, isDemo, onAdded, setNote }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: tempPassword(),
    role: 'admin_staff',
    branch: '',
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setNote(null)
    if (!form.email || !form.password) {
      setNote({ tone: 'bad', msg: 'Email and password are required.' })
      return
    }
    setBusy(true)

    if (isDemo) {
      setBusy(false)
      setNote({ tone: 'gold', msg: 'Demo mode — staff creation is disabled. Connect Supabase to add real logins.' })
      return
    }

    const { data, error } = await supabase.functions.invoke('manage-staff', {
      body: {
        action: 'create',
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        role: form.role,
        branch: form.branch || null,
      },
    })

    const errMsg = await invokeError(error, data)
    setBusy(false)
    if (errMsg) {
      setNote({ tone: 'bad', msg: errMsg })
      return
    }

    setNote({
      tone: 'ok',
      msg: `Added ${form.email}. Temporary password: ${form.password} — give this to them to sign in.`,
    })
    setForm({ full_name: '', email: '', password: tempPassword(), role: 'admin_staff', branch: '' })
    setOpen(false)
    onAdded()
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>+ Add staff</Button>
  }

  // COO can add anyone except a CEO.
  const roleKeys = isCeo ? Object.keys(ROLES) : Object.keys(ROLES).filter((r) => r !== 'ceo')

  return (
    <Card>
      <CardTitle eyebrow="New login" title="Add a staff member" />
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Full name">
            <Input value={form.full_name} onChange={set('full_name')} placeholder="Maria Santos" />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="maria@stateofdance.com"
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Role">
            <Select value={form.role} onChange={set('role')}>
              {roleKeys.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Branch">
            <Select value={form.branch} onChange={set('branch')}>
              <option value="">No branch</option>
              {BRANCHES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Temporary password" hint="Share this with them.">
            <Input value={form.password} onChange={set('password')} />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? 'Adding…' : 'Create login'}
          </Button>
          <Button type="button" variant="subtle" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )
}
