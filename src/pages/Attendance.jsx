import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { demoStore, DEMO_PROFILES } from '../lib/demoData'
import { can } from '../lib/roles'
import { Card, CardTitle, Button, Badge, Avatar } from '../components/ui'
import CameraCapture from '../components/CameraCapture'

const manilaDate = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

const fmtTime = (ts) =>
  ts
    ? new Date(ts).toLocaleTimeString('en-PH', {
        timeZone: 'Asia/Manila',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—'

export default function Attendance() {
  const { profile, role, isDemo } = useAuth()
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState(null) // 'in' | 'out' | null
  const [error, setError] = useState('')

  const wd = manilaDate()

  const loadToday = useCallback(async () => {
    if (isDemo) {
      const r = demoStore.attendance.find(
        (a) => a.user_id === profile.id && a.work_date === wd,
      )
      setRecord(r || null)
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', profile.id)
      .eq('work_date', wd)
      .maybeSingle()
    if (error) setError(error.message)
    setRecord(data || null)
    setLoading(false)
  }, [isDemo, profile.id, wd])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadToday()
  }, [loadToday])

  const handleCapture = async (blob, dataUrl) => {
    setError('')
    setBusy(true)

    if (isDemo) {
      const now = new Date().toISOString()
      if (mode === 'in') {
        const row = {
          id: 'da-' + Date.now(),
          user_id: profile.id,
          work_date: wd,
          check_in_ts: now,
          check_out_ts: null,
          check_in_photo_url: dataUrl,
          check_out_photo_url: null,
        }
        demoStore.attendance.push(row)
        setRecord(row)
      } else if (mode === 'out' && record) {
        const updated = { ...record, check_out_ts: now, check_out_photo_url: dataUrl }
        const idx = demoStore.attendance.findIndex((a) => a.id === record.id)
        if (idx >= 0) demoStore.attendance[idx] = updated
        setRecord(updated)
      }
      setBusy(false)
      setMode(null)
      return
    }

    try {
      const path = `${profile.id}/${wd}-${mode}.jpg`
      const { error: upErr } = await supabase.storage
        .from('attendance')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (upErr) throw upErr

      if (mode === 'in') {
        const { error: insErr } = await supabase
          .from('attendance')
          .insert({ user_id: profile.id, check_in_photo_url: path })
        if (insErr) throw insErr
      } else {
        const { error: updErr } = await supabase
          .from('attendance')
          .update({ check_out_photo_url: path })
          .eq('id', record.id)
        if (updErr) throw updErr
      }
      await loadToday()
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
      setMode(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <div className="eyebrow mb-1">Daily ops</div>
        <h1 className="text-2xl font-semibold text-ink">Attendance</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {new Date().toLocaleDateString('en-PH', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}{' '}
          · The check-in time is set by the server and is the payroll record. The
          selfie only confirms it was you.
        </p>
      </header>

      {error && (
        <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      <Card>
        {loading ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/8 bg-plum-950/40 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-ink-mute">
                  Check-in
                </div>
                <div className="mt-1 font-display text-2xl font-semibold text-ink">
                  {fmtTime(record?.check_in_ts)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-plum-950/40 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-ink-mute">
                  Check-out
                </div>
                <div className="mt-1 font-display text-2xl font-semibold text-ink">
                  {fmtTime(record?.check_out_ts)}
                </div>
              </div>
            </div>

            {/* State machine: not in → check in; in, not out → check out; done */}
            {mode ? (
              <CameraCapture
                onCapture={handleCapture}
                label={mode === 'in' ? 'Take check-in selfie' : 'Take check-out selfie'}
              />
            ) : !record ? (
              <Button size="block" disabled={busy} onClick={() => setMode('in')}>
                {busy ? 'Saving…' : 'Check in'}
              </Button>
            ) : !record.check_out_ts ? (
              <Button size="block" disabled={busy} onClick={() => setMode('out')}>
                {busy ? 'Saving…' : 'Check out'}
              </Button>
            ) : (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-ok/30 bg-ok/10 px-3 py-3 text-sm font-semibold text-ok">
                You're all set for today. See you tomorrow.
              </div>
            )}
          </>
        )}
      </Card>

      {can.viewAllAttendance(role) && <TodayRoster wd={wd} isDemo={isDemo} />}
    </div>
  )
}

// Manager view: who has checked in today.
// Thumbnail of a check-in/out selfie. Click to open the full photo.
function SelfieThumb({ url, label }) {
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={`${label} selfie — tap to enlarge`}
      className="block"
    >
      <img
        src={url}
        alt={`${label} selfie`}
        className="h-12 w-12 rounded-lg object-cover ring-1 ring-gold/30 transition hover:ring-gold"
      />
    </a>
  )
}

function TodayRoster({ wd, isDemo }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (isDemo) {
      const nameOf = Object.fromEntries(DEMO_PROFILES.map((p) => [p.id, p]))
      // In demo the photo fields hold data URLs already, so use them directly.
      setRows(
        demoStore.attendance
          .filter((a) => a.work_date === wd)
          .map((a) => ({
            ...a,
            profiles: nameOf[a.user_id],
            inUrl: a.check_in_photo_url,
            outUrl: a.check_out_photo_url,
          })),
      )
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('attendance')
      .select(
        'id, check_in_ts, check_out_ts, check_in_photo_url, check_out_photo_url, profiles:user_id (full_name, branch)',
      )
      .eq('work_date', wd)
      .order('check_in_ts')

    const list = data || []
    // Sign every selfie path in one batch (private bucket → signed URLs only).
    const paths = list.flatMap((r) =>
      [r.check_in_photo_url, r.check_out_photo_url].filter(Boolean),
    )
    let signed = {}
    if (paths.length) {
      const { data: urls } = await supabase.storage
        .from('attendance')
        .createSignedUrls(paths, 600)
      signed = Object.fromEntries((urls || []).map((u) => [u.path, u.signedUrl]))
    }
    setRows(
      list.map((r) => ({
        ...r,
        inUrl: r.check_in_photo_url ? signed[r.check_in_photo_url] : null,
        outUrl: r.check_out_photo_url ? signed[r.check_out_photo_url] : null,
      })),
    )
    setLoading(false)
  }, [isDemo, wd])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  return (
    <Card>
      <CardTitle eyebrow="Team" title="Checked in today" />
      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-soft">No check-ins yet today.</p>
      ) : (
        <ul className="divide-y divide-white/6">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-3">
              <Avatar name={r.profiles?.full_name} size={34} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">
                  {r.profiles?.full_name || 'Member'}
                </div>
                <div className="text-xs text-ink-mute">{r.profiles?.branch || '—'}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <SelfieThumb url={r.inUrl} label="Check-in" />
                <SelfieThumb url={r.outUrl} label="Check-out" />
              </div>
              <div className="w-16 text-right text-xs text-ink-soft">
                <div>In {fmtTime(r.check_in_ts)}</div>
                {r.check_out_ts && <div>Out {fmtTime(r.check_out_ts)}</div>}
              </div>
              {r.check_out_ts ? <Badge tone="neutral">Done</Badge> : <Badge tone="ok">In</Badge>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
