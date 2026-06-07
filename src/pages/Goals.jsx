import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { demoStore, DEMO_PROFILES } from '../lib/demoData'
import { can } from '../lib/roles'
import { Card, CardTitle, Field, Input, Select, Button, Badge, Progress } from '../components/ui'

export default function Goals() {
  const { role, isDemo } = useAuth()
  const canEdit = can.editGoals(role)

  const [rows, setRows] = useState(() => (isSupabaseConfigured ? [] : [...demoStore.goals]))
  const [people, setPeople] = useState(isSupabaseConfigured ? [] : DEMO_PROFILES)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [note, setNote] = useState(null)

  const fetchRows = useCallback(async () => {
    const [{ data: g, error }, { data: p }] = await Promise.all([
      supabase.from('goals').select('*, owner_profile:owner (full_name)').order('created_at'),
      supabase.from('profiles').select('id, full_name').order('full_name'),
    ])
    if (error) setNote({ tone: 'bad', msg: error.message })
    setRows(g || [])
    setPeople(p || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isSupabaseConfigured) fetchRows()
  }, [fetchRows])

  const ownerName = (gl) =>
    gl.owner_profile?.full_name ||
    people.find((p) => p.id === gl.owner)?.full_name ||
    null

  const addGoal = async (g) => {
    if (isDemo) {
      demoStore.goals.push({ ...g, id: 'dg-' + Date.now() })
      setRows([...demoStore.goals])
      setNote({ tone: 'gold', msg: 'Demo mode — not saved.' })
      return true
    }
    const { error } = await supabase.from('goals').insert(g)
    if (error) {
      setNote({ tone: 'bad', msg: error.message })
      return false
    }
    setNote({ tone: 'ok', msg: 'Goal added.' })
    fetchRows()
    return true
  }

  const updateGoal = async (id, changes) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...changes } : r)))
    if (isDemo) {
      const g = demoStore.goals.find((x) => x.id === id)
      if (g) Object.assign(g, changes)
      return
    }
    const { error } = await supabase.from('goals').update(changes).eq('id', id)
    if (error) {
      setNote({ tone: 'bad', msg: error.message })
      fetchRows()
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow mb-1">Strategy</div>
        <h1 className="text-2xl font-semibold text-ink">Goal board</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {canEdit ? 'Company goals with owners and progress.' : 'Where the company is headed.'}
        </p>
      </header>

      {note && <p className={noteClass(note.tone)}>{note.msg}</p>}

      {canEdit && <AddGoal people={people} onAdd={addGoal} />}

      {loading ? (
        <Card><p className="text-sm text-ink-soft">Loading…</p></Card>
      ) : rows.length === 0 ? (
        <Card><p className="text-sm text-ink-soft">No goals yet.</p></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((g) => {
            const pctDone = g.target ? Math.round((Number(g.current) / Number(g.target)) * 100) : 0
            return (
              <Card key={g.id}>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-ink">{g.title}</h3>
                    <div className="mt-0.5 text-xs text-ink-mute">
                      {ownerName(g) ? `Owner: ${ownerName(g)}` : 'Unassigned'}
                      {g.due_date ? ` · due ${g.due_date}` : ''}
                    </div>
                  </div>
                  <Badge tone={g.status === 'done' ? 'ok' : g.status === 'paused' ? 'neutral' : 'gold'}>
                    {pctDone}%
                  </Badge>
                </div>
                <Progress value={Number(g.current)} max={Number(g.target) || 100} />
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-ink-soft">
                    {g.current} <span className="text-ink-mute">/ {g.target}</span>
                  </span>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        defaultValue={g.current}
                        onBlur={(e) => updateGoal(g.id, { current: Number(e.target.value) })}
                        className="w-24 rounded-lg border border-white/10 bg-plum-950/50 px-2 py-1 text-sm text-ink focus:border-gold/60 focus:outline-none"
                        aria-label={`Current value for ${g.title}`}
                      />
                      <Select
                        value={g.status}
                        onChange={(e) => updateGoal(g.id, { status: e.target.value })}
                        className="text-sm"
                        aria-label={`Status for ${g.title}`}
                      >
                        <option value="active">Active</option>
                        <option value="done">Done</option>
                        <option value="paused">Paused</option>
                      </Select>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AddGoal({ people, onAdd }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ title: '', target: '', current: '', owner: '', due_date: '' })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title) return
    setBusy(true)
    const ok = await onAdd({
      title: form.title,
      target: form.target ? Number(form.target) : null,
      current: form.current ? Number(form.current) : 0,
      owner: form.owner || null,
      due_date: form.due_date || null,
      status: 'active',
    })
    setBusy(false)
    if (ok) {
      setForm({ title: '', target: '', current: '', owner: '', due_date: '' })
      setOpen(false)
    }
  }

  if (!open) return <Button onClick={() => setOpen(true)}>+ Add goal</Button>

  return (
    <Card>
      <CardTitle eyebrow="New" title="Add a goal" />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title">
          <Input value={form.title} onChange={set('title')} placeholder="e.g. Recital ticket sales" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Target">
            <Input type="number" value={form.target} onChange={set('target')} placeholder="900" />
          </Field>
          <Field label="Current">
            <Input type="number" value={form.current} onChange={set('current')} placeholder="0" />
          </Field>
          <Field label="Due date">
            <Input type="date" value={form.due_date} onChange={set('due_date')} />
          </Field>
        </div>
        <Field label="Owner">
          <Select value={form.owner} onChange={set('owner')}>
            <option value="">Unassigned</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add goal'}</Button>
          <Button type="button" variant="subtle" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </form>
    </Card>
  )
}

function noteClass(tone) {
  return `rounded-lg border px-3 py-2 text-sm ${
    tone === 'ok'
      ? 'border-ok/30 bg-ok/10 text-ok'
      : tone === 'bad'
        ? 'border-bad/30 bg-bad/10 text-bad'
        : 'border-gold/30 bg-gold/10 text-gold'
  }`
}
