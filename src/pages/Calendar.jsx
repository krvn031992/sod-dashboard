import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { demoStore } from '../lib/demoData'
import { can } from '../lib/roles'
import { Card, CardTitle, Field, Input, Select, Button, Badge } from '../components/ui'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const CATEGORIES = [
  { value: 'recital', label: 'Recital', tone: 'gold' },
  { value: 'enrollment', label: 'Enrollment', tone: 'ok' },
  { value: 'term', label: 'Class term', tone: 'violet' },
  { value: 'photoshoot', label: 'Photoshoot', tone: 'neutral' },
  { value: 'deadline', label: 'Deadline', tone: 'warn' },
  { value: 'other', label: 'Other', tone: 'neutral' },
]
const catTone = (c) => CATEGORIES.find((x) => x.value === c)?.tone || 'neutral'

export default function Calendar() {
  const { role, isDemo } = useAuth()
  const canEdit = can.editCalendar(role)
  const [year, setYear] = useState(new Date().getFullYear())

  const [rows, setRows] = useState(() => (isSupabaseConfigured ? [] : [...demoStore.calendar]))
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [note, setNote] = useState(null)

  const fetchRows = useCallback(async () => {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .order('event_date')
    if (error) setNote({ tone: 'bad', msg: error.message })
    setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isSupabaseConfigured) fetchRows()
  }, [fetchRows])

  const yearEvents = rows.filter((e) => new Date(e.event_date).getFullYear() === year)

  const addEvent = async (ev) => {
    if (isDemo) {
      demoStore.calendar.push({ ...ev, id: 'dc-' + Date.now() })
      setRows([...demoStore.calendar])
      setNote({ tone: 'gold', msg: 'Demo mode — not saved.' })
      return true
    }
    const { error } = await supabase.from('calendar_events').insert(ev)
    if (error) {
      setNote({ tone: 'bad', msg: error.message })
      return false
    }
    setNote({ tone: 'ok', msg: 'Event added.' })
    fetchRows()
    return true
  }

  const removeEvent = async (id) => {
    if (isDemo) {
      const i = demoStore.calendar.findIndex((e) => e.id === id)
      if (i >= 0) demoStore.calendar.splice(i, 1)
      setRows([...demoStore.calendar])
      return
    }
    const { error } = await supabase.from('calendar_events').delete().eq('id', id)
    if (error) setNote({ tone: 'bad', msg: error.message })
    else fetchRows()
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow mb-1">Strategy</div>
          <h1 className="text-2xl font-semibold text-ink">Yearly calendar</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Recitals, enrollment windows, deadlines and terms across the year.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="subtle" size="sm" onClick={() => setYear((y) => y - 1)}>‹</Button>
          <span className="font-display text-lg font-semibold text-ink">{year}</span>
          <Button variant="subtle" size="sm" onClick={() => setYear((y) => y + 1)}>›</Button>
        </div>
      </header>

      {note && <p className={noteClass(note.tone)}>{note.msg}</p>}

      {canEdit && <AddEvent onAdd={addEvent} defaultYear={year} />}

      {loading ? (
        <Card><p className="text-sm text-ink-soft">Loading…</p></Card>
      ) : yearEvents.length === 0 ? (
        <Card><p className="text-sm text-ink-soft">Nothing scheduled for {year}.</p></Card>
      ) : (
        <div className="space-y-3">
          {MONTHS.map((mName, mi) => {
            const monthEvents = yearEvents.filter((e) => new Date(e.event_date).getMonth() === mi)
            if (monthEvents.length === 0) return null
            return (
              <Card key={mName}>
                <CardTitle eyebrow={String(year)} title={monthName(mi)} />
                <ul className="divide-y divide-white/6">
                  {monthEvents.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 py-2.5">
                      <div className="w-10 text-center">
                        <div className="font-display text-lg font-semibold text-gold">
                          {new Date(e.event_date).getDate()}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-ink">{e.title}</div>
                        {e.notes && <div className="truncate text-xs text-ink-mute">{e.notes}</div>}
                      </div>
                      <Badge tone={catTone(e.category)}>
                        {CATEGORIES.find((c) => c.value === e.category)?.label || 'Event'}
                      </Badge>
                      {canEdit && (
                        <button
                          onClick={() => removeEvent(e.id)}
                          className="text-xs font-semibold text-ink-mute hover:text-bad"
                        >
                          Delete
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function monthName(mi) {
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][mi]
}

function AddEvent({ onAdd, defaultYear }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    title: '',
    category: 'recital',
    event_date: `${defaultYear}-01-01`,
    notes: '',
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title || !form.event_date) return
    setBusy(true)
    const ok = await onAdd({
      title: form.title,
      category: form.category,
      event_date: form.event_date,
      notes: form.notes || null,
    })
    setBusy(false)
    if (ok) {
      setForm({ title: '', category: 'recital', event_date: `${defaultYear}-01-01`, notes: '' })
      setOpen(false)
    }
  }

  if (!open) return <Button onClick={() => setOpen(true)}>+ Add event</Button>

  return (
    <Card>
      <CardTitle eyebrow="New" title="Add calendar event" />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title">
          <Input value={form.title} onChange={set('title')} placeholder="e.g. Recital — Fantasy" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Category">
            <Select value={form.category} onChange={set('category')}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={form.event_date} onChange={set('event_date')} />
          </Field>
        </div>
        <Field label="Notes">
          <Input value={form.notes} onChange={set('notes')} placeholder="Optional" />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add event'}</Button>
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
