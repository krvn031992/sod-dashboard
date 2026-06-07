import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { demoStore, DEMO_PROFILES } from '../lib/demoData'
import { roleMetrics, roleLabel, can } from '../lib/roles'
import { Card, CardTitle, Field, Input, Button, Badge, Avatar } from '../components/ui'

const manilaDate = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

export default function Endorsement() {
  const { profile, role, isDemo } = useAuth()
  const [m1Label, m2Label] = roleMetrics(role)
  const wd = manilaDate()

  const [form, setForm] = useState({
    completed: '',
    blocked: '',
    next: '',
    metric_one: '',
    metric_two: '',
  })
  const [existing, setExisting] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)

  const load = useCallback(async () => {
    if (isDemo) {
      const mine = demoStore.endorsements
        .filter((e) => e.user_id === profile.id)
        .sort((a, b) => b.work_date.localeCompare(a.work_date))
      const todayRow = mine.find((e) => e.work_date === wd)
      setExisting(todayRow || null)
      if (todayRow) setForm({ ...todayRow })
      setHistory(mine)
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('endorsements')
      .select('*')
      .eq('user_id', profile.id)
      .order('work_date', { ascending: false })
      .limit(7)
    const todayRow = (data || []).find((e) => e.work_date === wd)
    setExisting(todayRow || null)
    if (todayRow)
      setForm({
        completed: todayRow.completed || '',
        blocked: todayRow.blocked || '',
        next: todayRow.next || '',
        metric_one: todayRow.metric_one ?? '',
        metric_two: todayRow.metric_two ?? '',
      })
    setHistory(data || [])
    setLoading(false)
  }, [isDemo, profile.id, wd])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setStatus(null)
    setBusy(true)

    const payload = {
      user_id: profile.id,
      completed: form.completed,
      blocked: form.blocked,
      next: form.next,
      metric_one: form.metric_one === '' ? null : Number(form.metric_one),
      metric_two: form.metric_two === '' ? null : Number(form.metric_two),
    }

    if (isDemo) {
      const row = { ...payload, id: existing?.id || 'de-' + Date.now(), work_date: wd }
      const idx = demoStore.endorsements.findIndex(
        (x) => x.user_id === profile.id && x.work_date === wd,
      )
      if (idx >= 0) demoStore.endorsements[idx] = row
      else demoStore.endorsements.push(row)
      setBusy(false)
      setStatus({ tone: 'ok', msg: 'Endorsement saved.' })
      load()
      return
    }

    // Upsert on (user_id, work_date) so re-submitting the same day edits.
    const { error } = await supabase
      .from('endorsements')
      .upsert(payload, { onConflict: 'user_id,work_date' })
    setBusy(false)
    if (error) setStatus({ tone: 'bad', msg: error.message })
    else {
      setStatus({ tone: 'ok', msg: 'Endorsement saved.' })
      load()
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <div className="eyebrow mb-1">Daily ops</div>
        <h1 className="text-2xl font-semibold text-ink">Daily endorsement</h1>
        <p className="mt-1 text-sm text-ink-soft">
          End-of-day check-in. {existing ? 'You can edit today’s entry.' : 'One per day.'}
        </p>
      </header>

      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Field label="What I completed">
            <textarea
              className="w-full rounded-xl border border-white/10 bg-plum-950/50 px-3.5 py-2.5 text-ink placeholder:text-ink-mute focus:border-gold/60 focus:outline-none"
              rows={3}
              value={form.completed}
              onChange={set('completed')}
              placeholder="Key things you finished today…"
            />
          </Field>
          <Field label="What's blocked">
            <textarea
              className="w-full rounded-xl border border-white/10 bg-plum-950/50 px-3.5 py-2.5 text-ink placeholder:text-ink-mute focus:border-gold/60 focus:outline-none"
              rows={2}
              value={form.blocked}
              onChange={set('blocked')}
              placeholder="Anything holding you up…"
            />
          </Field>
          <Field label="What's next">
            <textarea
              className="w-full rounded-xl border border-white/10 bg-plum-950/50 px-3.5 py-2.5 text-ink placeholder:text-ink-mute focus:border-gold/60 focus:outline-none"
              rows={2}
              value={form.next}
              onChange={set('next')}
              placeholder="Top priorities for tomorrow…"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={m1Label}>
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                value={form.metric_one}
                onChange={set('metric_one')}
                placeholder="0"
              />
            </Field>
            <Field label={m2Label}>
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                value={form.metric_two}
                onChange={set('metric_two')}
                placeholder="0"
              />
            </Field>
          </div>

          {status && (
            <p
              className={`rounded-lg border px-3 py-2 text-sm ${
                status.tone === 'ok'
                  ? 'border-ok/30 bg-ok/10 text-ok'
                  : 'border-bad/30 bg-bad/10 text-bad'
              }`}
            >
              {status.msg}
            </p>
          )}

          <Button type="submit" size="block" disabled={busy}>
            {busy ? 'Saving…' : existing ? 'Update today’s endorsement' : 'Submit endorsement'}
          </Button>
        </form>
      </Card>

      {can.viewAllEndorsements(role) && <TeamEndorsements isDemo={isDemo} />}

      <Card>
        <CardTitle eyebrow="Last 7 days" title="Your recent endorsements" />
        {loading ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-ink-soft">No endorsements yet. Submit your first above.</p>
        ) : (
          <ul className="divide-y divide-white/6">
            {history.map((e) => (
              <li key={e.id} className="py-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink">{e.work_date}</span>
                  <span className="flex gap-2">
                    <Badge tone="gold">
                      {m1Label}: {e.metric_one ?? 0}
                    </Badge>
                    <Badge tone="violet">
                      {m2Label}: {e.metric_two ?? 0}
                    </Badge>
                  </span>
                </div>
                {e.completed && (
                  <p className="text-sm text-ink-soft">
                    <span className="text-ink-mute">Done: </span>
                    {e.completed}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

// Managers (CEO / COO / Admin Manager) see everyone's recent endorsements.
function TeamEndorsements({ isDemo }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(!isDemo)

  const load = useCallback(async () => {
    if (isDemo) {
      const nameOf = Object.fromEntries(DEMO_PROFILES.map((p) => [p.id, p]))
      setRows(
        [...demoStore.endorsements]
          .sort((a, b) => (b.work_date + b.id).localeCompare(a.work_date + a.id))
          .map((e) => ({ ...e, author: nameOf[e.user_id] })),
      )
      return
    }
    const { data } = await supabase
      .from('endorsements')
      .select('*, author:user_id (full_name, role)')
      .order('work_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)
    setRows(data || [])
    setLoading(false)
  }, [isDemo])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  return (
    <Card>
      <CardTitle
        eyebrow="Whole team"
        title="Team endorsements"
        action={<Badge tone="neutral">{rows.length}</Badge>}
      />
      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-soft">No endorsements submitted yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((e) => {
            const [l1, l2] = roleMetrics(e.author?.role)
            return (
              <li key={e.id} className="rounded-2xl border border-white/8 bg-plum-950/40 p-3.5">
                <div className="flex items-center gap-3">
                  <Avatar name={e.author?.full_name} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">
                      {e.author?.full_name || 'Member'}
                      <span className="ml-2 text-xs font-normal text-gold">
                        {roleLabel(e.author?.role)}
                      </span>
                    </div>
                    <div className="text-xs text-ink-mute">{e.work_date}</div>
                  </div>
                  <span className="flex shrink-0 gap-1.5">
                    <Badge tone="gold">{l1}: {e.metric_one ?? 0}</Badge>
                    <Badge tone="violet">{l2}: {e.metric_two ?? 0}</Badge>
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  {e.completed && (
                    <p className="text-ink-soft"><span className="text-ink-mute">Done: </span>{e.completed}</p>
                  )}
                  {e.blocked && (
                    <p className="text-ink-soft"><span className="text-ink-mute">Blocked: </span>{e.blocked}</p>
                  )}
                  {e.next && (
                    <p className="text-ink-soft"><span className="text-ink-mute">Next: </span>{e.next}</p>
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
