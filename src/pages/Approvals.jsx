import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { demoStore } from '../lib/demoData'
import { can } from '../lib/roles'
import { Card, CardTitle, Field, Input, Select, Button, Badge } from '../components/ui'

const ITEM_TYPES = [
  { value: 'marketing_post', label: 'Marketing post' },
  { value: 'expense', label: 'Expense' },
  { value: 'policy', label: 'Policy / decision' },
  { value: 'other', label: 'Other' },
]
const STATUS = {
  pending: { label: 'Pending', tone: 'warn' },
  approved: { label: 'Approved', tone: 'ok' },
  rejected: { label: 'Rejected', tone: 'bad' },
}

export default function Approvals() {
  const { profile, role, isDemo } = useAuth()
  const isApprover = can.approveItems(role)

  const [rows, setRows] = useState(() => (isSupabaseConfigured ? [] : [...demoStore.approvals]))
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [note, setNote] = useState(null)

  const fetchRows = useCallback(async () => {
    const { data, error } = await supabase
      .from('approvals')
      .select('*, submitter:submitted_by (full_name), decider:decided_by (full_name)')
      .order('created_at', { ascending: false })
    if (error) setNote({ tone: 'bad', msg: error.message })
    setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isSupabaseConfigured) fetchRows()
  }, [fetchRows])

  const submit = async (item) => {
    if (isDemo) {
      demoStore.approvals.unshift({
        ...item,
        id: 'dap-' + Date.now(),
        submitted_by: profile.id,
        submitter_name: profile.full_name,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      setRows([...demoStore.approvals])
      setNote({ tone: 'gold', msg: 'Demo mode — not saved.' })
      return true
    }
    const { error } = await supabase.from('approvals').insert({ ...item, submitted_by: profile.id })
    if (error) {
      setNote({ tone: 'bad', msg: error.message })
      return false
    }
    setNote({ tone: 'ok', msg: 'Submitted for approval.' })
    fetchRows()
    return true
  }

  const decide = async (item, status, note_) => {
    if (isDemo) {
      const row = demoStore.approvals.find((a) => a.id === item.id)
      if (row) {
        row.status = status
        row.note = note_
        row.decided_at = new Date().toISOString()
        row.decider_name = profile.full_name
      }
      setRows([...demoStore.approvals])
      return
    }
    const { error } = await supabase
      .from('approvals')
      .update({ status, note: note_ || null })
      .eq('id', item.id)
    if (error) setNote({ tone: 'bad', msg: error.message })
    else {
      setNote({ tone: 'ok', msg: `Marked ${status}.` })
      fetchRows()
    }
  }

  const pending = rows.filter((r) => r.status === 'pending')
  const decided = rows.filter((r) => r.status !== 'pending')

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow mb-1">Oversight</div>
        <h1 className="text-2xl font-semibold text-ink">Approvals</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {isApprover
            ? 'Sign off on items before they go out. Decisions are permanent and timestamped.'
            : 'Submit items for CEO sign-off — especially marketing posts before publishing.'}
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

      <SubmitForm onSubmit={submit} />

      <Card>
        <CardTitle
          eyebrow={isApprover ? 'Needs your sign-off' : 'Awaiting decision'}
          title="Pending"
          action={<Badge tone={pending.length ? 'warn' : 'ok'}>{pending.length}</Badge>}
        />
        {loading ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing pending.</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((a) => (
              <ApprovalItem key={a.id} item={a} isApprover={isApprover} onDecide={decide} />
            ))}
          </ul>
        )}
      </Card>

      {decided.length > 0 && (
        <Card>
          <CardTitle eyebrow="History" title="Decided" />
          <ul className="space-y-3">
            {decided.map((a) => (
              <ApprovalItem key={a.id} item={a} isApprover={false} onDecide={decide} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function SubmitForm({ onSubmit }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ item_type: 'marketing_post', title: '', detail: '' })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title) return
    setBusy(true)
    const ok = await onSubmit({
      item_type: form.item_type,
      title: form.title,
      detail: form.detail || null,
    })
    setBusy(false)
    if (ok) {
      setForm({ item_type: 'marketing_post', title: '', detail: '' })
      setOpen(false)
    }
  }

  if (!open) return <Button onClick={() => setOpen(true)}>+ Submit for approval</Button>

  return (
    <Card>
      <CardTitle eyebrow="New" title="Submit for approval" />
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Type">
            <Select value={form.item_type} onChange={set('item_type')}>
              {ITEM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Title">
            <Input value={form.title} onChange={set('title')} placeholder="What needs sign-off" />
          </Field>
        </div>
        <Field label="Detail">
          <Input value={form.detail} onChange={set('detail')} placeholder="Link or description" />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit'}</Button>
          <Button type="button" variant="subtle" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </form>
    </Card>
  )
}

function ApprovalItem({ item, isApprover, onDecide }) {
  const [note, setNote] = useState('')
  const [acting, setActing] = useState(false)
  const s = STATUS[item.status] || STATUS.pending
  const submitterName = item.submitter?.full_name || item.submitter_name || 'Someone'
  const deciderName = item.decider?.full_name || item.decider_name

  const act = async (status) => {
    setActing(true)
    await onDecide(item, status, note)
    setActing(false)
  }

  return (
    <li className="rounded-2xl border border-white/8 bg-plum-950/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-ink">{item.title}</div>
          {item.detail && <div className="mt-0.5 text-sm text-ink-soft">{item.detail}</div>}
          <div className="mt-2 text-xs text-ink-mute">
            From {submitterName}
            {deciderName ? ` · decided by ${deciderName}` : ''}
            {item.decided_at
              ? ` · ${new Date(item.decided_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}`
              : ''}
          </div>
          {item.note && item.status !== 'pending' && (
            <div className="mt-1 text-xs text-ink-soft">Note: {item.note}</div>
          )}
        </div>
        <Badge tone={s.tone}>{s.label}</Badge>
      </div>

      {isApprover && item.status === 'pending' && (
        <div className="mt-3 space-y-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note for your decision"
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={acting} onClick={() => act('approved')}>
              Approve
            </Button>
            <Button variant="danger" size="sm" disabled={acting} onClick={() => act('rejected')}>
              Reject
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}
