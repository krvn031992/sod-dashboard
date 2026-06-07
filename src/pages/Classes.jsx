import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { demoStore } from '../lib/demoData'
import { can } from '../lib/roles'
import { Card, CardTitle, Input, Button, Badge } from '../components/ui'

export default function Classes() {
  const { role, isDemo } = useAuth()
  const canManage = can.manageClasses(role)

  const [rows, setRows] = useState(() => (isSupabaseConfigured ? [] : [...demoStore.classes]))
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)

  const fetchRows = useCallback(async () => {
    const { data, error } = await supabase.from('class_offerings').select('*').order('name')
    if (error) setNote({ tone: 'bad', msg: error.message })
    setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isSupabaseConfigured) fetchRows()
  }, [fetchRows])

  const add = async (e) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    if (isDemo) {
      demoStore.classes.push({ id: 'dcl-' + Date.now(), name, active: true })
      setRows([...demoStore.classes])
      setNewName('')
      setBusy(false)
      setNote({ tone: 'gold', msg: 'Demo mode — not saved.' })
      return
    }
    const { error } = await supabase.from('class_offerings').insert({ name })
    setBusy(false)
    if (error) setNote({ tone: 'bad', msg: error.message.includes('duplicate') ? 'That class already exists.' : error.message })
    else {
      setNewName('')
      setNote({ tone: 'ok', msg: 'Class added.' })
      fetchRows()
    }
  }

  const rename = async (id, name) => {
    const clean = name.trim()
    if (!clean) return
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, name: clean } : r)))
    if (isDemo) {
      const c = demoStore.classes.find((x) => x.id === id)
      if (c) c.name = clean
      return
    }
    const { error } = await supabase.from('class_offerings').update({ name: clean }).eq('id', id)
    if (error) { setNote({ tone: 'bad', msg: error.message }); fetchRows() }
  }

  const toggle = async (row) => {
    const active = !row.active
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, active } : r)))
    if (isDemo) {
      const c = demoStore.classes.find((x) => x.id === row.id)
      if (c) c.active = active
      return
    }
    const { error } = await supabase.from('class_offerings').update({ active }).eq('id', row.id)
    if (error) { setNote({ tone: 'bad', msg: error.message }); fetchRows() }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <div className="eyebrow mb-1">Setup</div>
        <h1 className="text-2xl font-semibold text-ink">Classes</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Your studio's class offerings. These feed the class dropdowns (e.g. enrollment
          records and retention).
        </p>
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

      {canManage && (
        <Card>
          <CardTitle eyebrow="New" title="Add a class" />
          <form onSubmit={add} className="flex gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Breaking, K-pop, Tap" />
            <Button type="submit" disabled={busy} className="shrink-0">Add</Button>
          </form>
        </Card>
      )}

      {loading ? (
        <Card><p className="text-sm text-ink-soft">Loading…</p></Card>
      ) : rows.length === 0 ? (
        <Card><p className="text-sm text-ink-soft">No classes yet.</p></Card>
      ) : (
        <Card>
          <CardTitle eyebrow="All" title="Class list" action={<Badge tone="neutral">{rows.length}</Badge>} />
          <ul className="divide-y divide-white/6">
            {rows.map((c) => (
              <li key={c.id} className={`flex items-center gap-3 py-2.5 ${c.active ? '' : 'opacity-50'}`}>
                {canManage ? (
                  <input
                    defaultValue={c.name}
                    onBlur={(e) => e.target.value.trim() !== c.name && rename(c.id, e.target.value)}
                    className="flex-1 rounded-lg border border-transparent bg-transparent px-1 py-0.5 font-semibold text-ink hover:border-white/10 focus:border-gold/50 focus:bg-plum-950/50 focus:outline-none"
                    aria-label={`Rename ${c.name}`}
                  />
                ) : (
                  <span className="flex-1 px-1 font-semibold text-ink">{c.name}</span>
                )}
                {!c.active && <Badge tone="neutral">Hidden</Badge>}
                {canManage && (
                  <Button variant="subtle" size="sm" onClick={() => toggle(c)}>
                    {c.active ? 'Hide' : 'Show'}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {canManage && (
            <p className="mt-3 text-xs text-ink-mute">
              Click a name to rename it. "Hide" keeps a class out of new dropdowns without
              deleting its history.
            </p>
          )}
        </Card>
      )}
    </div>
  )
}
