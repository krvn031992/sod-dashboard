import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { demoStore } from '../lib/demoData'
import { can } from '../lib/roles'
import { yearOverYear, latestBreakdown, pct } from '../lib/retention'
import { Card, CardTitle, Field, Input, Select, Button, StatTile, Progress } from '../components/ui'

const BRANCHES = ['BGC', 'Manila', 'Quezon City']

export default function Retention() {
  const { role, isDemo } = useAuth()
  const canInput = can.inputCustomers(role)

  const [rows, setRows] = useState(() => (isSupabaseConfigured ? [] : [...demoStore.customers]))
  const [formats, setFormats] = useState(() =>
    isSupabaseConfigured ? [] : demoStore.classes.filter((c) => c.active).map((c) => c.name),
  )
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [note, setNote] = useState(null)

  const fetchRows = useCallback(async () => {
    const [{ data, error }, { data: cls }] = await Promise.all([
      supabase.from('customers').select('*'),
      supabase.from('class_offerings').select('name').eq('active', true).order('name'),
    ])
    if (error) setNote({ tone: 'bad', msg: error.message })
    setRows(data || [])
    setFormats((cls || []).map((c) => c.name))
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isSupabaseConfigured) fetchRows()
  }, [fetchRows])

  const yoy = yearOverYear(rows)
  const latest = yoy[yoy.length - 1]
  const byBranch = latestBreakdown(rows, 'branch')
  const byFormat = latestBreakdown(rows, 'class_format')

  const addCustomer = async (c) => {
    if (isDemo) {
      demoStore.customers.push({ ...c, id: 'dcu-' + Date.now() })
      setRows([...demoStore.customers])
      setNote({ tone: 'gold', msg: 'Demo mode — not saved.' })
      return true
    }
    const { error } = await supabase.from('customers').insert(c)
    if (error) {
      setNote({ tone: 'bad', msg: error.message })
      return false
    }
    setNote({ tone: 'ok', msg: 'Customer record added.' })
    fetchRows()
    return true
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow mb-1">Strategy</div>
        <h1 className="text-2xl font-semibold text-ink">Retention</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Re-enrollment rate by branch and class format, year over year — the signal for
          whether the second show and adult-funnel push are working.
        </p>
      </header>

      {note && (
        <p className={noteClass(note.tone)}>{note.msg}</p>
      )}

      {loading ? (
        <Card><p className="text-sm text-ink-soft">Loading…</p></Card>
      ) : rows.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-soft">
            No customer records yet. {canInput ? 'Add enrollment records below to see retention.' : ''}
          </p>
        </Card>
      ) : (
        <>
          {/* Headline */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile
              label={latest ? `Re-enroll ${latest.prevYear}→${latest.year}` : 'Re-enrollment'}
              value={pct(latest?.rate)}
              tone="text-gold"
            />
            <StatTile label="Retained" value={latest ? `${latest.retained}/${latest.base}` : '—'} />
            <StatTile label="Records" value={rows.length} />
          </div>

          {/* Year over year */}
          {yoy.length > 0 && (
            <Card>
              <CardTitle eyebrow="Trend" title="Year over year" />
              <div className="space-y-4">
                {yoy.map((y) => (
                  <div key={y.year}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="text-ink-soft">{y.prevYear} → {y.year}</span>
                      <span className="font-semibold text-ink">
                        {pct(y.rate)}
                        <span className="text-ink-mute"> · {y.retained}/{y.base}</span>
                      </span>
                    </div>
                    <Progress value={(y.rate || 0) * 100} max={100} />
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <BreakdownCard title="By branch" data={byBranch} />
            <BreakdownCard title="By class format" data={byFormat} />
          </div>
        </>
      )}

      {canInput && <AddCustomer onAdd={addCustomer} formats={formats} />}
    </div>
  )
}

function BreakdownCard({ title, data }) {
  return (
    <Card>
      <CardTitle
        eyebrow={data.prevYear ? `${data.prevYear} → ${data.year}` : 'Latest'}
        title={title}
      />
      {data.rows.length === 0 ? (
        <p className="text-sm text-ink-soft">Need two years of data to compare.</p>
      ) : (
        <ul className="space-y-3">
          {data.rows.map((r) => (
            <li key={r.group}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-ink-soft">{r.group}</span>
                <span className="font-semibold text-ink">
                  {pct(r.rate)}
                  <span className="text-ink-mute"> · {r.retained}/{r.base}</span>
                </span>
              </div>
              <Progress value={(r.rate || 0) * 100} max={100} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function AddCustomer({ onAdd, formats }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const thisYear = new Date().getFullYear()
  const classList = formats && formats.length ? formats : ['Ballet']
  const [form, setForm] = useState({
    master_customer_id: '',
    name: '',
    branch: 'BGC',
    class_format: classList[0],
    enrolled_year: String(thisYear),
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.master_customer_id || !form.enrolled_year) return
    setBusy(true)
    const ok = await onAdd({
      master_customer_id: form.master_customer_id.trim(),
      name: form.name || null,
      branch: form.branch || null,
      class_format: form.class_format || null,
      enrolled_year: Number(form.enrolled_year),
      recital_year: Number(form.enrolled_year),
      status: 'active',
    })
    setBusy(false)
    if (ok) setForm((f) => ({ ...f, master_customer_id: '', name: '' }))
  }

  if (!open) return <Button variant="ghost" onClick={() => setOpen(true)}>+ Add enrollment record</Button>

  return (
    <Card>
      <CardTitle eyebrow="Data entry" title="Add enrollment record" />
      <p className="mb-4 text-xs text-ink-mute">
        Use the same Customer ID across years for the same person so re-enrollment counts.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Customer ID" hint="e.g. a master ID from your records">
            <Input value={form.master_customer_id} onChange={set('master_customer_id')} placeholder="C-1024" />
          </Field>
          <Field label="Name">
            <Input value={form.name} onChange={set('name')} placeholder="Optional" />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Branch">
            <Select value={form.branch} onChange={set('branch')}>
              {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
            </Select>
          </Field>
          <Field label="Class format">
            <Select value={form.class_format} onChange={set('class_format')}>
              {classList.map((f) => <option key={f} value={f}>{f}</option>)}
            </Select>
          </Field>
          <Field label="Enrolled year">
            <Input type="number" value={form.enrolled_year} onChange={set('enrolled_year')} />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add record'}</Button>
          <Button type="button" variant="subtle" onClick={() => setOpen(false)}>Close</Button>
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
