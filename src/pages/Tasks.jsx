import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { demoStore, DEMO_PROFILES } from '../lib/demoData'
import { can } from '../lib/roles'
import { Card, CardTitle, Field, Input, Select, Button, Badge } from '../components/ui'

const STATUS = {
  open: { label: 'Open', tone: 'neutral' },
  in_progress: { label: 'In progress', tone: 'gold' },
  done: { label: 'Done', tone: 'ok' },
  blocked: { label: 'Blocked', tone: 'bad' },
}

export default function Tasks() {
  const { profile, role, isDemo } = useAuth()
  const isManager = can.assignTasks(role)

  const [tasks, setTasks] = useState([])
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const peopleById = Object.fromEntries(people.map((p) => [p.id, p]))

  const load = useCallback(async () => {
    if (isDemo) {
      setPeople(DEMO_PROFILES)
      setTasks([...demoStore.tasks])
      setLoading(false)
      return
    }
    const [{ data: t, error: te }, { data: p }] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, role, active').order('full_name'),
    ])
    if (te) setError(te.message)
    setTasks(t || [])
    setPeople((p || []).filter((x) => x.active))
    setLoading(false)
  }, [isDemo])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const updateStatus = async (task, status) => {
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status } : t)))
    if (isDemo) {
      const row = demoStore.tasks.find((t) => t.id === task.id)
      if (row) row.status = status
      return
    }
    const { error } = await supabase.from('tasks').update({ status }).eq('id', task.id)
    if (error) {
      setError(error.message)
      load()
    }
  }

  const myTasks = tasks.filter((t) => t.assigned_to === profile.id)
  const allTasks = tasks

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow mb-1">Daily ops</div>
        <h1 className="text-2xl font-semibold text-ink">Tasks</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {isManager
            ? 'Assign work and track every queue.'
            : 'Your assigned work. Update status as you go.'}
        </p>
      </header>

      {error && (
        <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      {isManager && (
        <AssignForm
          people={people}
          isDemo={isDemo}
          me={profile.id}
          onCreated={load}
        />
      )}

      <Card>
        <CardTitle eyebrow="Assigned to me" title="My queue" />
        <TaskList
          tasks={myTasks}
          peopleById={peopleById}
          loading={loading}
          onStatus={updateStatus}
          editable
          empty="Nothing assigned to you right now."
        />
      </Card>

      {isManager && (
        <Card>
          <CardTitle
            eyebrow="Everyone"
            title="All tasks"
            action={<Badge tone="neutral">{allTasks.length}</Badge>}
          />
          <TaskList
            tasks={allTasks}
            peopleById={peopleById}
            loading={loading}
            onStatus={updateStatus}
            editable
            showAssignee
            empty="No tasks yet."
          />
        </Card>
      )}
    </div>
  )
}

function AssignForm({ people, isDemo, me, onCreated }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', assigned_to: '', due_date: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.title || !form.assigned_to) {
      setError('Title and assignee are required.')
      return
    }
    setBusy(true)
    const payload = {
      title: form.title,
      description: form.description || null,
      assigned_to: form.assigned_to,
      assigned_by: me,
      due_date: form.due_date || null,
      status: 'open',
    }
    if (isDemo) {
      demoStore.tasks.unshift({
        ...payload,
        id: 'dt-' + Date.now(),
        created_at: new Date().toISOString(),
      })
    } else {
      const { error } = await supabase.from('tasks').insert(payload)
      if (error) {
        setError(error.message)
        setBusy(false)
        return
      }
    }
    setBusy(false)
    setForm({ title: '', description: '', assigned_to: '', due_date: '' })
    setOpen(false)
    onCreated()
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>+ Assign a task</Button>
    )
  }

  return (
    <Card>
      <CardTitle eyebrow="New" title="Assign a task" />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title">
          <Input value={form.title} onChange={set('title')} placeholder="What needs doing" />
        </Field>
        <Field label="Description">
          <Input value={form.description} onChange={set('description')} placeholder="Optional detail" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Assign to">
            <Select value={form.assigned_to} onChange={set('assigned_to')}>
              <option value="">— Select person —</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.email}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due date">
            <Input type="date" value={form.due_date} onChange={set('due_date')} />
          </Field>
        </div>
        {error && <p className="text-sm text-bad">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? 'Assigning…' : 'Assign'}
          </Button>
          <Button type="button" variant="subtle" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )
}

function TaskList({ tasks, peopleById, loading, onStatus, editable, showAssignee, empty }) {
  if (loading) return <p className="text-sm text-ink-soft">Loading…</p>
  if (tasks.length === 0) return <p className="text-sm text-ink-soft">{empty}</p>

  return (
    <ul className="space-y-3">
      {tasks.map((t) => {
        const s = STATUS[t.status] || STATUS.open
        const overdue =
          t.due_date && t.status !== 'done' && t.due_date < new Date().toISOString().slice(0, 10)
        return (
          <li
            key={t.id}
            className="rounded-2xl border border-white/8 bg-plum-950/40 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-ink">{t.title}</div>
                {t.description && (
                  <div className="mt-0.5 text-sm text-ink-soft">{t.description}</div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-mute">
                  {showAssignee && (
                    <span>
                      For {peopleById[t.assigned_to]?.full_name || 'unassigned'}
                    </span>
                  )}
                  {t.due_date && (
                    <span className={overdue ? 'text-bad' : ''}>
                      Due {t.due_date}
                      {overdue ? ' · overdue' : ''}
                    </span>
                  )}
                </div>
              </div>
              <Badge tone={s.tone}>{s.label}</Badge>
            </div>

            {editable && (
              <div className="mt-3">
                <Select
                  aria-label="Update status"
                  value={t.status}
                  onChange={(e) => onStatus(t, e.target.value)}
                  className="text-sm"
                >
                  {Object.entries(STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
