import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { demoStore, DEMO_PROFILES } from '../lib/demoData'
import { Avatar, Button, Input } from '../components/ui'

const CHANNEL = 'general'

const fmtTime = (ts) =>
  new Date(ts).toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
  })

export default function Chat() {
  const { profile, isDemo } = useAuth()
  const [messages, setMessages] = useState(() => (isSupabaseConfigured ? [] : [...demoStore.messages]))
  const [people, setPeople] = useState(() =>
    isSupabaseConfigured ? {} : Object.fromEntries(DEMO_PROFILES.map((p) => [p.id, p])),
  )
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [body, setBody] = useState('')
  const [attachment, setAttachment] = useState('')
  const [showAttach, setShowAttach] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef(null)

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      scrollToEnd()
      return
    }
    const [{ data: msgs, error: mErr }, { data: profs }] = await Promise.all([
      supabase
        .from('messages')
        .select('*')
        .eq('channel', CHANNEL)
        .order('created_at', { ascending: true })
        .limit(200),
      supabase.from('profiles').select('id, full_name, profile_photo_url'),
    ])
    if (mErr) setError(mErr.message)
    setPeople(Object.fromEntries((profs || []).map((p) => [p.id, p])))
    setMessages(msgs || [])
    setLoading(false)
    scrollToEnd()
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  // Realtime: append new messages as they arrive.
  useEffect(() => {
    if (!isSupabaseConfigured) return
    const channel = supabase
      .channel('messages-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel=eq.${CHANNEL}` },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new],
          )
          scrollToEnd()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const send = async (e) => {
    e.preventDefault()
    const text = body.trim()
    if (!text && !attachment) return
    setError('')

    if (isDemo) {
      const msg = {
        id: 'dm-' + Date.now(),
        channel: CHANNEL,
        sender_id: profile.id,
        body: text || null,
        attachment_url: attachment || null,
        created_at: new Date().toISOString(),
      }
      demoStore.messages.push(msg)
      setMessages((prev) => [...prev, msg])
      setBody('')
      setAttachment('')
      setShowAttach(false)
      scrollToEnd()
      return
    }

    setBody('')
    setAttachment('')
    setShowAttach(false)
    const { error: sErr } = await supabase
      .from('messages')
      .insert({ channel: CHANNEL, sender_id: profile.id, body: text || null, attachment_url: attachment || null })
    if (sErr) setError(sErr.message)
    // The realtime subscription appends the row when it lands.
  }

  return (
    <div className="flex h-[calc(100dvh-9rem)] flex-col lg:h-[calc(100dvh-6rem)]">
      <header className="mb-3">
        <div className="eyebrow mb-1">Comms</div>
        <h1 className="text-2xl font-semibold text-ink">Team chat</h1>
      </header>

      <div ref={scrollRef} className="panel flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-ink-soft">No messages yet. Say hello 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === profile.id
            const person = people[m.sender_id]
            return (
              <div key={m.id} className={`flex gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
                {!mine && <Avatar name={person?.full_name} src={person?.profile_photo_url} size={32} />}
                <div className={`max-w-[78%] ${mine ? 'text-right' : ''}`}>
                  {!mine && (
                    <div className="mb-0.5 px-1 text-xs font-semibold text-gold">
                      {person?.full_name || 'Member'}
                    </div>
                  )}
                  <div
                    className={`inline-block rounded-2xl px-3.5 py-2 text-sm ${
                      mine
                        ? 'bg-gradient-to-br from-gold-400 to-gold-600 text-plum-950'
                        : 'border border-white/10 bg-plum-950/50 text-ink'
                    }`}
                  >
                    {m.body && <span className="whitespace-pre-wrap break-words">{m.body}</span>}
                    {m.attachment_url && (
                      <a
                        href={m.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className={`mt-1 block break-all text-xs font-semibold underline ${mine ? 'text-plum-900' : 'text-gold'}`}
                      >
                        Attachment
                      </a>
                    )}
                  </div>
                  <div className="mt-0.5 px-1 text-[0.65rem] text-ink-mute">{fmtTime(m.created_at)}</div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {error && <p className="mt-2 text-sm text-bad">{error}</p>}

      <form onSubmit={send} className="mt-3 space-y-2">
        {showAttach && (
          <Input
            value={attachment}
            onChange={(e) => setAttachment(e.target.value)}
            placeholder="Paste a Google Drive / file link"
            type="url"
          />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowAttach((s) => !s)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 text-ink-soft hover:border-gold/40 hover:text-gold"
            aria-label="Attach a link"
            title="Attach a link"
          >
            +
          </button>
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message the team…"
          />
          <Button type="submit" className="shrink-0">Send</Button>
        </div>
      </form>
    </div>
  )
}
