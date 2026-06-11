import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { demoStore, DEMO_PROFILES } from '../lib/demoData'
import { can } from '../lib/roles'
import { Card, CardTitle, Field, Input, Select, Button, Badge, Avatar } from '../components/ui'

const BRANCHES = ['BGC', 'Manila', 'Quezon City']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const manilaDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
const thisMonth = () => manilaDate().slice(0, 7)
const monthLabel = (m) =>
  new Date(m + '-01T00:00:00').toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
const dayLabel = (d) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })
const genId = (p) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1000)}`

export default function Schedule() {
  const { profile, role, isDemo } = useAuth()
  const canManage = can.manageSchedule(role)

  const [month, setMonth] = useState(thisMonth())
  const [shifts, setShifts] = useState([])
  const [people, setPeople] = useState(isSupabaseConfigured ? [] : DEMO_PROFILES)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const today = manilaDate()
  const [selected, setSelected] = useState(today.slice(0, 7) === thisMonth() ? today : null)
  const [note, setNote] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const start = `${month}-01`
    const end = `${month}-31`
    if (isDemo) {
      const nameOf = Object.fromEntries(DEMO_PROFILES.map((p) => [p.id, p]))
      setShifts(
        demoStore.schedules
          .filter((s) => s.work_date >= start && s.work_date <= end)
          .map((s) => ({ ...s, profiles: nameOf[s.user_id] })),
      )
      setPeople(DEMO_PROFILES)
      setLoading(false)
      return
    }
    const [{ data: sch }, { data: profs }] = await Promise.all([
      supabase
        .from('schedules')
        .select('*, profiles:user_id (full_name, branch)')
        .gte('work_date', start)
        .lte('work_date', end)
        .order('work_date'),
      supabase.from('profiles').select('id, full_name, active').order('full_name'),
    ])
    setShifts(sch || [])
    setPeople((profs || []).filter((p) => p.active))
    setLoading(false)
  }, [isDemo, month])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  // Group shifts by date.
  const byDate = {}
  for (const s of shifts) (byDate[s.work_date] ??= []).push(s)

  // Build calendar cells (Sunday-start).
  const first = new Date(month + '-01T00:00:00')
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < first.getDay(); i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`)
  while (cells.length % 7 !== 0) cells.push(null)

  const myShifts = shifts
    .filter((s) => s.user_id === profile.id)
    .sort((a, b) => a.work_date.localeCompare(b.work_date))

  const addShift = async (values) => {
    if (isDemo) {
      demoStore.schedules.push({ ...values, id: genId('ds') })
      load()
      setNote({ tone: 'gold', msg: 'Demo mode — not saved.' })
      return true
    }
    const { error } = await supabase.from('schedules').insert({ ...values, created_by: profile.id })
    if (error) {
      setNote({ tone: 'bad', msg: error.message })
      return false
    }
    setNote({ tone: 'ok', msg: 'Shift added.' })
    load()
    return true
  }

  const removeShift = async (id) => {
    if (isDemo) {
      const i = demoStore.schedules.findIndex((s) => s.id === id)
      if (i >= 0) demoStore.schedules.splice(i, 1)
      load()
      return
    }
    const { error } = await supabase.from('schedules').delete().eq('id', id)
    if (error) setNote({ tone: 'bad', msg: error.message })
    else load()
  }

  const shiftMonth = (delta) => {
    const d = new Date(month + '-01T00:00:00')
    d.setMonth(d.getMonth() + delta)
    setMonth(d.toISOString().slice(0, 7))
    setSelected(null)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow mb-1">Daily ops</div>
          <h1 className="text-2xl font-semibold text-ink">Schedule</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {canManage ? 'Set who is on duty each day.' : 'Your shifts and who is on duty this month.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="subtle" size="sm" onClick={() => shiftMonth(-1)}>‹</Button>
          <span className="font-display text-base font-semibold text-ink">{monthLabel(month)}</span>
          <Button variant="subtle" size="sm" onClick={() => shiftMonth(1)}>›</Button>
        </div>
      </header>

      {note && <p className={noteClass(note.tone)}>{note.msg}</p>}

      {/* My shifts */}
      <Card>
        <CardTitle eyebrow="You" title="My shifts this month" action={<Badge tone="gold">{myShifts.length}</Badge>} />
        {myShifts.length === 0 ? (
          <p className="text-sm text-ink-soft">No shifts assigned to you this month.</p>
        ) : (
          <ul className="divide-y divide-white/6">
            {myShifts.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm font-semibold text-ink">{dayLabel(s.work_date)}</span>
                <span className="text-sm text-gold">
                  {s.shift || 'On duty'}
                  {s.branch ? <span className="text-ink-mute"> · {s.branch}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Calendar */}
      <Card>
        <CardTitle eyebrow={monthLabel(month)} title="Who's on duty" />
        {loading ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : (
          <>
            <div className="mb-1 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1 text-center text-[0.62rem] font-semibold uppercase tracking-wider text-ink-mute">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((date, i) => {
                if (!date) return <div key={`e${i}`} />
                const list = byDate[date] || []
                const mine = list.some((s) => s.user_id === profile.id)
                const isToday = date === today
                const isSel = date === selected
                return (
                  <button
                    key={date}
                    onClick={() => setSelected(date)}
                    className={`flex min-h-[58px] flex-col gap-1 rounded-lg border p-1.5 text-left transition ${
                      isSel
                        ? 'border-gold/60 bg-gold/10'
                        : 'border-white/8 hover:border-gold/40'
                    }`}
                  >
                    <span
                      className={`text-xs font-semibold ${
                        isToday ? 'text-gold' : 'text-ink-soft'
                      }`}
                    >
                      {Number(date.slice(-2))}
                    </span>
                    <span className="flex flex-wrap gap-0.5">
                      {list.slice(0, 4).map((s) => (
                        <span
                          key={s.id}
                          className={`h-1.5 w-1.5 rounded-full ${
                            s.user_id === profile.id ? 'bg-gold' : 'bg-violet'
                          }`}
                        />
                      ))}
                    </span>
                    {mine && <span className="mt-auto text-[0.55rem] font-semibold text-gold">You</span>}
                  </button>
                )
              })}
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-ink-soft">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gold" /> You</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet" /> Others on duty</span>
            </div>
          </>
        )}
      </Card>

      {/* Selected day detail */}
      {selected && (
        <DayDetail
          date={selected}
          list={byDate[selected] || []}
          myId={profile.id}
          canManage={canManage}
          people={people}
          onAdd={addShift}
          onRemove={removeShift}
        />
      )}
    </div>
  )
}

function DayDetail({ date, list, myId, canManage, people, onAdd, onRemove }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ user_id: '', shift: '9:00 AM – 6:00 PM', branch: '', note: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.user_id) return
    setBusy(true)
    const ok = await onAdd({
      user_id: form.user_id,
      work_date: date,
      shift: form.shift || null,
      branch: form.branch || null,
      note: form.note || null,
    })
    setBusy(false)
    if (ok) {
      setForm({ user_id: '', shift: '9:00 AM – 6:00 PM', branch: '', note: '' })
      setOpen(false)
    }
  }

  return (
    <Card>
      <CardTitle
        eyebrow="On duty"
        title={dayLabel(date)}
        action={canManage && !open ? <Button size="sm" onClick={() => setOpen(true)}>+ Add</Button> : null}
      />

      {canManage && open && (
        <form onSubmit={submit} className="mb-4 space-y-3 rounded-2xl border border-white/8 bg-plum-950/40 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Employee">
              <Select value={form.user_id} onChange={set('user_id')}>
                <option value="">— Select —</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                ))}
              </Select>
            </Field>
            <Field label="Shift">
              <Input value={form.shift} onChange={set('shift')} placeholder="9:00 AM – 6:00 PM, Off…" />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Branch">
              <Select value={form.branch} onChange={set('branch')}>
                <option value="">None</option>
                {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
              </Select>
            </Field>
            <Field label="Note">
              <Input value={form.note} onChange={set('note')} placeholder="Optional" />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy}>{busy ? 'Adding…' : 'Add shift'}</Button>
            <Button type="button" variant="subtle" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-ink-soft">No one scheduled this day.</p>
      ) : (
        <ul className="divide-y divide-white/6">
          {list.map((s) => (
            <li key={s.id} className={`flex items-center gap-3 py-2.5 ${s.user_id === myId ? 'rounded-lg bg-gold/5 px-2' : ''}`}>
              <Avatar name={s.profiles?.full_name} size={34} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">
                  {s.profiles?.full_name || 'Member'}
                  {s.user_id === myId && <span className="ml-2 text-xs text-gold">You</span>}
                </div>
                <div className="text-xs text-ink-mute">
                  {s.shift || 'On duty'}{s.branch ? ` · ${s.branch}` : ''}{s.note ? ` · ${s.note}` : ''}
                </div>
              </div>
              {canManage && (
                <button onClick={() => onRemove(s.id)} className="text-xs font-semibold text-ink-mute hover:text-bad">
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
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
