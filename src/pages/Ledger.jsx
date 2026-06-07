import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { demoStore } from '../lib/demoData'
import { can } from '../lib/roles'
import { Card, CardTitle, Field, Input, Select, Button, Badge, StatTile } from '../components/ui'

const BRANCHES = ['BGC', 'Manila', 'Quezon City']
const peso = (n) =>
  '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const manilaDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

export default function Ledger() {
  const { profile, role, isDemo } = useAuth()
  const canInput = can.inputLedger(role)
  const canEdit = can.editLedger(role)

  const [rows, setRows] = useState(() => (isSupabaseConfigured ? [] : [...demoStore.ledger]))
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [note, setNote] = useState(null)

  const fetchRows = useCallback(async () => {
    const { data, error } = await supabase
      .from('ledger')
      .select('*')
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) setNote({ tone: 'bad', msg: error.message })
    setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isSupabaseConfigured) fetchRows()
  }, [fetchRows])

  const income = rows.filter((r) => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0)
  const expense = rows.filter((r) => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0)
  const net = income - expense

  const addEntry = async (entry) => {
    if (isDemo) {
      demoStore.ledger.unshift({ ...entry, id: 'dl-' + Date.now(), entered_by: profile.id })
      setRows([...demoStore.ledger])
      setNote({ tone: 'gold', msg: 'Demo mode — not saved.' })
      return true
    }
    const { error } = await supabase.from('ledger').insert({ ...entry, entered_by: profile.id })
    if (error) {
      setNote({ tone: 'bad', msg: error.message })
      return false
    }
    setNote({ tone: 'ok', msg: 'Entry added.' })
    fetchRows()
    return true
  }

  const removeEntry = async (id) => {
    if (isDemo) {
      const idx = demoStore.ledger.findIndex((r) => r.id === id)
      if (idx >= 0) demoStore.ledger.splice(idx, 1)
      setRows([...demoStore.ledger])
      return
    }
    const { error } = await supabase.from('ledger').delete().eq('id', id)
    if (error) setNote({ tone: 'bad', msg: error.message })
    else {
      setNote({ tone: 'ok', msg: 'Entry deleted (logged in the audit trail).' })
      fetchRows()
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow mb-1">Oversight</div>
        <h1 className="text-2xl font-semibold text-ink">Ledger</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Combined income &amp; expenses across branches. Every change is recorded in a
          permanent audit trail.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Income" value={peso(income)} tone="text-ok" />
        <StatTile label="Expenses" value={peso(expense)} tone="text-bad" />
        <StatTile label="Net" value={peso(net)} tone={net >= 0 ? 'text-gold' : 'text-bad'} />
      </div>

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

      {canInput && <AddEntry onAdd={addEntry} />}

      <Card>
        <CardTitle eyebrow="All entries" title="Transactions" action={<Badge tone="neutral">{rows.length}</Badge>} />
        {loading ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-ink-soft">No entries yet.</p>
        ) : (
          <ul className="divide-y divide-white/6">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-3">
                <span
                  className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold ${
                    r.type === 'income' ? 'bg-ok/12 text-ok' : 'bg-bad/12 text-bad'
                  }`}
                >
                  {r.type === 'income' ? '+' : '−'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">
                    {r.category || (r.type === 'income' ? 'Income' : 'Expense')}
                  </div>
                  <div className="truncate text-xs text-ink-mute">
                    {r.entry_date}
                    {r.branch ? ` · ${r.branch}` : ''}
                    {r.note ? ` · ${r.note}` : ''}
                  </div>
                </div>
                <div className={`text-sm font-semibold ${r.type === 'income' ? 'text-ok' : 'text-bad'}`}>
                  {r.type === 'income' ? '+' : '−'}
                  {peso(r.amount)}
                </div>
                {canEdit && (
                  <button
                    onClick={() => removeEntry(r.id)}
                    className="ml-1 text-xs font-semibold text-ink-mute hover:text-bad"
                    aria-label="Delete entry"
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {can.viewAudit(role) && <AuditLog isDemo={isDemo} />}
    </div>
  )
}

function AddEntry({ onAdd }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    type: 'income',
    category: '',
    amount: '',
    branch: '',
    entry_date: manilaDate(),
    note: '',
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.amount || Number(form.amount) <= 0) return
    setBusy(true)
    const ok = await onAdd({
      type: form.type,
      category: form.category || null,
      amount: Number(form.amount),
      branch: form.branch || null,
      entry_date: form.entry_date,
      note: form.note || null,
    })
    setBusy(false)
    if (ok) {
      setForm({ type: 'income', category: '', amount: '', branch: '', entry_date: manilaDate(), note: '' })
      setOpen(false)
    }
  }

  if (!open) return <Button onClick={() => setOpen(true)}>+ Add entry</Button>

  return (
    <Card>
      <CardTitle eyebrow="New" title="Add ledger entry" />
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Type">
            <Select value={form.type} onChange={set('type')}>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </Select>
          </Field>
          <Field label="Amount (₱)">
            <Input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} placeholder="0.00" />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Category">
            <Input value={form.category} onChange={set('category')} placeholder="Tuition, Venue, Payroll…" />
          </Field>
          <Field label="Branch">
            <Select value={form.branch} onChange={set('branch')}>
              <option value="">All / none</option>
              {BRANCHES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Date">
            <Input type="date" value={form.entry_date} onChange={set('entry_date')} />
          </Field>
          <Field label="Note">
            <Input value={form.note} onChange={set('note')} placeholder="Optional" />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add entry'}</Button>
          <Button type="button" variant="subtle" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </form>
    </Card>
  )
}

function AuditLog({ isDemo }) {
  const [rows, setRows] = useState([])
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    if (isDemo) return
    const { data } = await supabase
      .from('ledger_audit')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(20)
    setRows(data || [])
  }, [isDemo])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && !isDemo) load()
  }, [open, load, isDemo])

  return (
    <Card className="panel-hairline">
      <CardTitle
        eyebrow="Tamper-proof"
        title="Audit trail"
        action={
          <Button variant="subtle" size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? 'Hide' : 'Show'}
          </Button>
        }
      />
      {!open ? (
        <p className="text-sm text-ink-soft">
          Every create, edit, and delete on the ledger is recorded permanently — who,
          what, and when. History can never be overwritten.
        </p>
      ) : isDemo ? (
        <p className="text-sm text-ink-soft">The live audit trail appears here once connected to Supabase.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-soft">No changes recorded yet.</p>
      ) : (
        <ul className="divide-y divide-white/6">
          {rows.map((a) => (
            <li key={a.id} className="py-2.5 text-sm">
              <div className="flex items-center justify-between">
                <Badge tone={a.action === 'delete' ? 'bad' : a.action === 'update' ? 'warn' : 'ok'}>
                  {a.action}
                </Badge>
                <span className="text-xs text-ink-mute">
                  {new Date(a.changed_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
                </span>
              </div>
              <div className="mt-1 text-xs text-ink-soft">
                {peso((a.new_value || a.old_value)?.amount)} ·{' '}
                {(a.new_value || a.old_value)?.category || '—'}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
