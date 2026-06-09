import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { demoStore } from '../lib/demoData'
import { can } from '../lib/roles'
import { downloadCsv } from '../lib/csv'
import { Card, CardTitle, Field, Input, Select, Button, Badge, StatTile } from '../components/ui'

const BRANCHES = ['BGC', 'Manila', 'Quezon City']
const peso = (n) =>
  '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const manilaDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
const ym = (d) => (d || '').slice(0, 7)
const thisMonth = () => manilaDate().slice(0, 7)
const monthLabel = (m) =>
  new Date(m + '-01T00:00:00').toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
const monthShort = (m) =>
  new Date(m + '-01T00:00:00').toLocaleDateString('en-PH', { month: 'short' })

export default function Ledger() {
  const { profile, role, isDemo } = useAuth()
  const canInput = can.inputLedger(role)
  const canEdit = can.editLedger(role)

  const [rows, setRows] = useState(() => (isSupabaseConfigured ? [] : [...demoStore.ledger]))
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [month, setMonth] = useState(thisMonth())
  const [form, setForm] = useState(null) // 'add' | entryObject | null
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

  // Monthly aggregates for the graph.
  const monthly = {}
  for (const r of rows) {
    const m = ym(r.entry_date)
    const agg = (monthly[m] ??= { income: 0, expense: 0 })
    if (r.type === 'income') agg.income += Number(r.amount)
    else agg.expense += Number(r.amount)
  }
  const allMonths = Object.keys(monthly).sort()
  const graphMonths = allMonths.slice(-6)

  const monthEntries = rows.filter((r) => ym(r.entry_date) === month)
  const income = monthEntries.filter((r) => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0)
  const expense = monthEntries.filter((r) => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0)
  const net = income - expense

  const saveEntry = async (values, editingId) => {
    if (isDemo) {
      if (editingId) {
        const i = demoStore.ledger.findIndex((r) => r.id === editingId)
        if (i >= 0) demoStore.ledger[i] = { ...demoStore.ledger[i], ...values }
      } else {
        demoStore.ledger.unshift({ ...values, id: 'dl-' + Date.now(), entered_by: profile.id })
      }
      setRows([...demoStore.ledger])
      setForm(null)
      setNote({ tone: 'gold', msg: 'Demo mode — not saved.' })
      return
    }
    const res = editingId
      ? await supabase.from('ledger').update(values).eq('id', editingId)
      : await supabase.from('ledger').insert({ ...values, entered_by: profile.id })
    if (res.error) {
      setNote({ tone: 'bad', msg: res.error.message })
      return
    }
    setForm(null)
    setNote({ tone: 'ok', msg: editingId ? 'Entry updated (logged in history).' : 'Entry added.' })
    fetchRows()
  }

  const removeEntry = async (id) => {
    if (isDemo) {
      const i = demoStore.ledger.findIndex((r) => r.id === id)
      if (i >= 0) demoStore.ledger.splice(i, 1)
      setRows([...demoStore.ledger])
      return
    }
    const { error } = await supabase.from('ledger').delete().eq('id', id)
    if (error) setNote({ tone: 'bad', msg: error.message })
    else {
      setNote({ tone: 'ok', msg: 'Entry deleted (logged in history).' })
      fetchRows()
    }
  }

  const exportCsv = async () => {
    setNote(null)
    if (monthEntries.length === 0) {
      setNote({ tone: 'gold', msg: 'No entries this month — nothing to export.' })
      return
    }
    const out = [['Date', 'Type', 'Category', 'Amount', 'Branch', 'Note']]
    monthEntries
      .slice()
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
      .forEach((r) =>
        out.push([r.entry_date, r.type, r.category || '', Number(r.amount).toFixed(2), r.branch || '', r.note || '']),
      )
    out.push([])
    out.push(['', '', 'Income', income.toFixed(2)])
    out.push(['', '', 'Expenses', expense.toFixed(2)])
    out.push(['', '', 'Net', net.toFixed(2)])
    await downloadCsv(`ledger-${month}.csv`, out)
  }

  const shiftMonth = (delta) => {
    const d = new Date(month + '-01T00:00:00')
    d.setMonth(d.getMonth() + delta)
    setMonth(d.toISOString().slice(0, 7))
  }
  const isThisMonth = month === thisMonth()

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow mb-1">Oversight</div>
        <h1 className="text-2xl font-semibold text-ink">Ledger</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Income &amp; expenses by month. Every change is recorded in a permanent history.
        </p>
      </header>

      {/* Monthly graph */}
      {graphMonths.length > 0 && (
        <Card>
          <CardTitle eyebrow="Trend" title="Income vs expense by month" />
          <MonthlyChart monthly={monthly} months={graphMonths} selected={month} onSelect={setMonth} />
          <div className="mt-3 flex items-center gap-4 text-xs text-ink-soft">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-ok" /> Income</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-bad" /> Expense</span>
          </div>
        </Card>
      )}

      {/* Month selector + totals */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="subtle" size="sm" onClick={() => shiftMonth(-1)}>‹</Button>
          <input
            type="month"
            value={month}
            max={thisMonth()}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-white/10 bg-plum-950/50 px-3 py-2 text-sm text-ink focus:border-gold/60 focus:outline-none"
          />
          <Button variant="subtle" size="sm" disabled={isThisMonth} onClick={() => shiftMonth(1)}>›</Button>
        </div>
        <span className="font-display text-base font-semibold text-ink">{monthLabel(month)}</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Income" value={peso(income)} tone="text-ok" />
        <StatTile label="Expenses" value={peso(expense)} tone="text-bad" />
        <StatTile label="Net" value={peso(net)} tone={net >= 0 ? 'text-gold' : 'text-bad'} />
      </div>

      {note && (
        <p className={noteClass(note.tone)}>{note.msg}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {canInput && !form && <Button onClick={() => setForm('add')}>+ Add entry</Button>}
        <Button variant="ghost" onClick={exportCsv}>Export CSV</Button>
      </div>

      {form && (
        <EntryForm
          initial={form === 'add' ? null : form}
          defaultMonth={month}
          onSave={(values) => saveEntry(values, form === 'add' ? null : form.id)}
          onCancel={() => setForm(null)}
        />
      )}

      <Card>
        <CardTitle
          eyebrow={monthLabel(month)}
          title="Transactions"
          action={<Badge tone="neutral">{monthEntries.length}</Badge>}
        />
        {loading ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : monthEntries.length === 0 ? (
          <p className="text-sm text-ink-soft">No entries for this month.</p>
        ) : (
          <ul className="divide-y divide-white/6">
            {monthEntries.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-3">
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
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
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => setForm(r)} className="text-xs font-semibold text-ink-mute hover:text-gold">Edit</button>
                    <button onClick={() => removeEntry(r.id)} className="text-xs font-semibold text-ink-mute hover:text-bad">Delete</button>
                  </div>
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

function MonthlyChart({ monthly, months, selected, onSelect }) {
  const max = Math.max(1, ...months.map((m) => Math.max(monthly[m]?.income || 0, monthly[m]?.expense || 0)))
  return (
    <div className="flex items-end justify-between gap-2" style={{ height: 132 }}>
      {months.map((m) => {
        const inc = monthly[m]?.income || 0
        const exp = monthly[m]?.expense || 0
        const isSel = m === selected
        return (
          <button
            key={m}
            onClick={() => onSelect(m)}
            className={`flex h-full flex-1 flex-col items-center justify-end gap-1 rounded-lg px-1 pt-1 transition ${
              isSel ? 'bg-white/5' : 'hover:bg-white/5'
            }`}
            title={`${monthLabel(m)} — income ${peso(inc)}, expense ${peso(exp)}`}
          >
            <div className="flex h-full w-full items-end justify-center gap-1">
              <div className="w-2.5 rounded-t bg-ok" style={{ height: `${(inc / max) * 100}%` }} />
              <div className="w-2.5 rounded-t bg-bad" style={{ height: `${(exp / max) * 100}%` }} />
            </div>
            <span className={`text-[0.62rem] font-semibold ${isSel ? 'text-gold' : 'text-ink-mute'}`}>
              {monthShort(m)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function EntryForm({ initial, defaultMonth, onSave, onCancel }) {
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    type: initial?.type || 'income',
    category: initial?.category || '',
    amount: initial?.amount != null ? String(initial.amount) : '',
    branch: initial?.branch || '',
    entry_date: initial?.entry_date || `${defaultMonth}-01`,
    note: initial?.note || '',
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.amount || Number(form.amount) <= 0) return
    setBusy(true)
    await onSave({
      type: form.type,
      category: form.category || null,
      amount: Number(form.amount),
      branch: form.branch || null,
      entry_date: form.entry_date,
      note: form.note || null,
    })
    setBusy(false)
  }

  return (
    <Card>
      <CardTitle eyebrow={initial ? 'Edit' : 'New'} title={initial ? 'Edit entry' : 'Add ledger entry'} />
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
              {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
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
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : initial ? 'Save changes' : 'Add entry'}</Button>
          <Button type="button" variant="subtle" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </Card>
  )
}

const ACTION = {
  insert: { label: 'Added', tone: 'ok' },
  update: { label: 'Edited', tone: 'warn' },
  delete: { label: 'Deleted', tone: 'bad' },
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
      .limit(40)
    setRows(data || [])
  }, [isDemo])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && !isDemo) load()
  }, [open, load, isDemo])

  const amt = (v) => (v == null ? '—' : '₱' + Number(v).toLocaleString('en-PH'))

  return (
    <Card className="panel-hairline">
      <CardTitle
        eyebrow="Tamper-proof"
        title="Edit history"
        action={<Button variant="subtle" size="sm" onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : 'Show'}</Button>}
      />
      {!open ? (
        <p className="text-sm text-ink-soft">
          Every add, edit, and delete is recorded permanently — what changed, and when.
          History can never be overwritten.
        </p>
      ) : isDemo ? (
        <p className="text-sm text-ink-soft">The live edit history appears here once connected to Supabase.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-soft">No changes recorded yet.</p>
      ) : (
        <ul className="divide-y divide-white/6">
          {rows.map((a) => {
            const act = ACTION[a.action] || { label: a.action, tone: 'neutral' }
            const cur = a.new_value || a.old_value || {}
            const changedAmount =
              a.action === 'update' && a.old_value && a.new_value && a.old_value.amount !== a.new_value.amount
            return (
              <li key={a.id} className="py-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Badge tone={act.tone}>{act.label}</Badge>
                    <span className="text-ink-soft">{cur.category || cur.type || 'entry'}</span>
                  </span>
                  <span className="text-xs text-ink-mute">
                    {new Date(a.changed_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
                  </span>
                </div>
                <div className="mt-1 text-xs text-ink-soft">
                  {changedAmount ? (
                    <>Amount {amt(a.old_value.amount)} → <span className="font-semibold text-ink">{amt(a.new_value.amount)}</span></>
                  ) : (
                    <>{amt(cur.amount)}{cur.branch ? ` · ${cur.branch}` : ''}</>
                  )}
                </div>
              </li>
            )
          })}
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
