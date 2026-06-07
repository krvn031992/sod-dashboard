import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { demoStore } from '../lib/demoData'
import { can } from '../lib/roles'
import { Card, CardTitle, Field, Input, Button, Badge } from '../components/ui'

export default function Announcements() {
  const { profile, role, isDemo } = useAuth()
  const canPost = can.postAnnouncements(role)

  const [rows, setRows] = useState(() => (isSupabaseConfigured ? [] : [...demoStore.announcements]))
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [note, setNote] = useState(null)

  const fetchRows = useCallback(async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*, author:author_id (full_name)')
      .order('created_at', { ascending: false })
    if (error) setNote({ tone: 'bad', msg: error.message })
    setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isSupabaseConfigured) fetchRows()
  }, [fetchRows])

  const post = async (item) => {
    if (isDemo) {
      demoStore.announcements.unshift({
        ...item,
        id: 'dan-' + Date.now(),
        author_id: profile.id,
        author_name: profile.full_name,
        created_at: new Date().toISOString(),
      })
      setRows([...demoStore.announcements])
      setNote({ tone: 'gold', msg: 'Demo mode — not saved.' })
      return true
    }
    const { error } = await supabase.from('announcements').insert({ ...item, author_id: profile.id })
    if (error) {
      setNote({ tone: 'bad', msg: error.message })
      return false
    }
    setNote({ tone: 'ok', msg: 'Posted.' })
    fetchRows()
    return true
  }

  const remove = async (id) => {
    if (isDemo) {
      const idx = demoStore.announcements.findIndex((a) => a.id === id)
      if (idx >= 0) demoStore.announcements.splice(idx, 1)
      setRows([...demoStore.announcements])
      return
    }
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) setNote({ tone: 'bad', msg: error.message })
    else fetchRows()
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow mb-1">Comms</div>
        <h1 className="text-2xl font-semibold text-ink">Announcements</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {canPost ? 'Post updates for the whole team.' : 'Latest updates from leadership.'}
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

      {canPost && <PostForm onPost={post} />}

      {loading ? (
        <Card><p className="text-sm text-ink-soft">Loading…</p></Card>
      ) : rows.length === 0 ? (
        <Card><p className="text-sm text-ink-soft">No announcements yet.</p></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((a) => (
            <Card key={a.id} className={a.urgent ? 'border-gold/40' : ''}>
              <div className="mb-1 flex items-start justify-between gap-3">
                <h3 className="text-lg text-ink">{a.title}</h3>
                {a.urgent && <Badge tone="gold">Urgent</Badge>}
              </div>
              {a.body && <p className="text-sm leading-relaxed text-ink-soft">{a.body}</p>}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-ink-mute">
                  {(a.author?.full_name || a.author_name || 'Leadership')} ·{' '}
                  {new Date(a.created_at).toLocaleDateString('en-PH', {
                    timeZone: 'Asia/Manila',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                {canPost && (
                  <button
                    onClick={() => remove(a.id)}
                    className="text-xs font-semibold text-ink-mute hover:text-bad"
                  >
                    Delete
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function PostForm({ onPost }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', urgent: false })

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title) return
    setBusy(true)
    const ok = await onPost({ title: form.title, body: form.body || null, urgent: form.urgent })
    setBusy(false)
    if (ok) {
      setForm({ title: '', body: '', urgent: false })
      setOpen(false)
    }
  }

  if (!open) return <Button onClick={() => setOpen(true)}>+ New announcement</Button>

  return (
    <Card>
      <CardTitle eyebrow="New" title="Post an announcement" />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title">
          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Headline"
          />
        </Field>
        <Field label="Message">
          <textarea
            className="w-full rounded-xl border border-white/10 bg-plum-950/50 px-3.5 py-2.5 text-ink placeholder:text-ink-mute focus:border-gold/60 focus:outline-none"
            rows={4}
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            placeholder="Details for the team…"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={form.urgent}
            onChange={(e) => setForm((f) => ({ ...f, urgent: e.target.checked }))}
            className="h-4 w-4 accent-[#deb060]"
          />
          Mark as urgent (pins to the top of everyone’s dashboard)
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>{busy ? 'Posting…' : 'Post'}</Button>
          <Button type="button" variant="subtle" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </form>
    </Card>
  )
}
