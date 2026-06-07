import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { demoStore } from '../lib/demoData'
import { can } from '../lib/roles'
import { Card, CardTitle, Field, Input, Button, Badge, StatTile } from '../components/ui'

// The five weekly metrics from the spec (§6.9).
const METRICS = [
  'Enrollment count',
  'Re-enrollment rate',
  'Adult-segment count',
  'Recital ticket sales',
  'Lead-to-enrollment rate',
]
const COMPETITORS = ['G-Force', 'TADS', 'Kidlat', 'Addlib', 'ACE', 'Zero Studio', 'Sky Dance Avenue', '808 Studio']

const mondayOf = (d = new Date()) => {
  const x = new Date(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x.toISOString().slice(0, 10)
}

export default function Scoreboard() {
  const { role, isDemo } = useAuth()
  const canEdit = can.editScoreboard(role)

  const [rows, setRows] = useState(() => (isSupabaseConfigured ? [] : [...demoStore.benchmarks]))
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [note, setNote] = useState(null)

  const fetchRows = useCallback(async () => {
    const { data, error } = await supabase
      .from('benchmark_metrics')
      .select('*')
      .order('week_start', { ascending: false })
    if (error) setNote({ tone: 'bad', msg: error.message })
    setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isSupabaseConfigured) fetchRows()
  }, [fetchRows])

  const weeks = [...new Set(rows.map((r) => r.week_start))].sort().reverse()
  const latestWeek = weeks[0]
  const latest = rows.filter((r) => r.week_start === latestWeek)
  const valueFor = (name) => latest.find((r) => r.metric_name === name)?.our_value

  const saveWeek = async (week_start, values) => {
    const payload = METRICS.filter((m) => values[m] !== '' && values[m] != null).map((m) => ({
      week_start,
      metric_name: m,
      our_value: Number(values[m]),
    }))
    if (isDemo) {
      payload.forEach((p) => {
        const i = demoStore.benchmarks.findIndex(
          (b) => b.week_start === p.week_start && b.metric_name === p.metric_name,
        )
        if (i >= 0) demoStore.benchmarks[i] = { ...demoStore.benchmarks[i], ...p }
        else demoStore.benchmarks.push({ ...p, id: 'db-' + Date.now() + p.metric_name })
      })
      setRows([...demoStore.benchmarks])
      setNote({ tone: 'gold', msg: 'Demo mode — not saved.' })
      return true
    }
    const { error } = await supabase
      .from('benchmark_metrics')
      .upsert(payload, { onConflict: 'week_start,metric_name' })
    if (error) {
      setNote({ tone: 'bad', msg: error.message })
      return false
    }
    setNote({ tone: 'ok', msg: 'Week saved.' })
    fetchRows()
    return true
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow mb-1">Strategy</div>
        <h1 className="text-2xl font-semibold text-ink">Weekly scoreboard</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Self-benchmarking on the five numbers that move the business.
          {latestWeek ? ` Week of ${latestWeek}.` : ''}
        </p>
      </header>

      {note && <p className={noteClass(note.tone)}>{note.msg}</p>}

      {loading ? (
        <Card><p className="text-sm text-ink-soft">Loading…</p></Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {METRICS.map((m) => (
            <StatTile key={m} label={m} value={valueFor(m) ?? '—'} />
          ))}
        </div>
      )}

      {canEdit && <EnterWeek onSave={saveWeek} latest={latest} latestWeek={latestWeek} />}

      {weeks.length > 1 && (
        <Card>
          <CardTitle eyebrow="History" title="Past weeks" />
          <div className="space-y-3">
            {weeks.slice(1, 6).map((w) => (
              <div key={w} className="rounded-xl border border-white/8 bg-plum-950/40 p-3">
                <div className="mb-1 text-xs font-semibold text-gold">{w}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
                  {rows
                    .filter((r) => r.week_start === w)
                    .map((r) => (
                      <span key={r.id}>
                        {r.metric_name}: <span className="font-semibold text-ink">{r.our_value}</span>
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="panel-hairline">
        <CardTitle eyebrow="Context only" title="Local studios we watch" />
        <div className="flex flex-wrap gap-2">
          {COMPETITORS.map((c) => (
            <Badge key={c} tone="neutral">{c}</Badge>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-mute">
          Entered manually for context — not auto-tracked. The scoreboard benchmarks us
          against ourselves week to week.
        </p>
      </Card>
    </div>
  )
}

function EnterWeek({ onSave, latest, latestWeek }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [week, setWeek] = useState(mondayOf())
  const [values, setValues] = useState(() => Object.fromEntries(METRICS.map((m) => [m, ''])))

  // Prefill with the latest week's numbers when opening.
  const openForm = () => {
    const prefill = Object.fromEntries(
      METRICS.map((m) => [m, latest.find((r) => r.metric_name === m)?.our_value ?? '']),
    )
    setValues(prefill)
    setWeek(latestWeek || mondayOf())
    setOpen(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const ok = await onSave(week, values)
    setBusy(false)
    if (ok) setOpen(false)
  }

  if (!open) return <Button onClick={openForm}>+ Enter weekly numbers</Button>

  return (
    <Card>
      <CardTitle eyebrow="Update" title="Enter weekly numbers" />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Week starting (Monday)">
          <Input type="date" value={week} onChange={(e) => setWeek(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {METRICS.map((m) => (
            <Field key={m} label={m}>
              <Input
                type="number"
                step="0.01"
                value={values[m]}
                onChange={(e) => setValues((v) => ({ ...v, [m]: e.target.value }))}
                placeholder="0"
              />
            </Field>
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save week'}</Button>
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
