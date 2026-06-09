import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { demoStore, DEMO_PROFILES } from '../lib/demoData'
import { can } from '../lib/roles'
import { Card, CardTitle, Button, Badge, Avatar } from '../components/ui'
import CameraCapture from '../components/CameraCapture'
import { downloadCsv } from '../lib/csv'

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

      {can.viewAllAttendance(role) && <AttendanceRecord isDemo={isDemo} />}
    </div>
  )
}

// Manager record with two views: by day, or summarized by employee.
function AttendanceRecord({ isDemo }) {
  const [view, setView] = useState('day')
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {[
          ['day', 'By day'],
          ['employee', 'By employee'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              view === key ? 'bg-gold/15 text-gold' : 'border border-white/10 text-ink-soft hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === 'day' ? <AttendanceLog isDemo={isDemo} /> : <AttendanceByEmployee isDemo={isDemo} />}
    </div>
  )
}

// Hours between check-in and check-out, e.g. "6.5h".
function hoursWorked(inTs, outTs) {
  if (!inTs || !outTs) return null
  const h = (new Date(outTs) - new Date(inTs)) / 3600000
  return `${h.toFixed(1)}h`
}

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

// Manager view: the attendance record for any chosen day, with selfies + hours.
function AttendanceLog({ isDemo }) {
  const [date, setDate] = useState(manilaDate())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    if (isDemo) {
      const nameOf = Object.fromEntries(DEMO_PROFILES.map((p) => [p.id, p]))
      setRows(
        demoStore.attendance
          .filter((a) => a.work_date === date)
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
      .eq('work_date', date)
      .order('check_in_ts')

    const list = data || []
    // Sign every selfie path in one batch (private bucket → signed URLs only).
    const paths = list.flatMap((r) => [r.check_in_photo_url, r.check_out_photo_url].filter(Boolean))
    let signed = {}
    if (paths.length) {
      const { data: urls } = await supabase.storage.from('attendance').createSignedUrls(paths, 600)
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
  }, [isDemo, date])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const isToday = date === manilaDate()
  const shift = (days) => {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() + days)
    setDate(d.toISOString().slice(0, 10))
  }

  return (
    <Card>
      <CardTitle
        eyebrow="Attendance record"
        title={isToday ? 'Today' : date}
        action={<Badge tone="neutral">{rows.length} in</Badge>}
      />

      <div className="mb-4 flex items-center gap-2">
        <Button variant="subtle" size="sm" onClick={() => shift(-1)}>‹ Prev</Button>
        <input
          type="date"
          value={date}
          max={manilaDate()}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-white/10 bg-plum-950/50 px-3 py-2 text-sm text-ink focus:border-gold/60 focus:outline-none"
        />
        <Button variant="subtle" size="sm" disabled={isToday} onClick={() => shift(1)}>Next ›</Button>
      </div>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink-soft">No check-ins recorded for this day.</p>
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
              <div className="w-20 text-right text-xs text-ink-soft">
                <div>In {fmtTime(r.check_in_ts)}</div>
                <div>Out {r.check_out_ts ? fmtTime(r.check_out_ts) : '—'}</div>
              </div>
              <div className="w-12 text-right">
                {hoursWorked(r.check_in_ts, r.check_out_ts) ? (
                  <span className="text-xs font-semibold text-gold">
                    {hoursWorked(r.check_in_ts, r.check_out_ts)}
                  </span>
                ) : (
                  <Badge tone="ok">In</Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

const thisMonth = () => manilaDate().slice(0, 7) // YYYY-MM
const monthLabel = (ym) =>
  new Date(ym + '-01T00:00:00').toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })

// Per-employee summary for a chosen month: days present + total hours, with a
// drill-down to that person's individual days.
function AttendanceByEmployee({ isDemo }) {
  const [month, setMonth] = useState(thisMonth())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [note, setNote] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const start = `${month}-01`
    const end = `${month}-31`
    if (isDemo) {
      const nameOf = Object.fromEntries(DEMO_PROFILES.map((p) => [p.id, p]))
      setRows(
        demoStore.attendance
          .filter((a) => a.work_date >= start && a.work_date <= end)
          .map((a) => ({ ...a, profiles: nameOf[a.user_id] })),
      )
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('attendance')
      .select('id, user_id, work_date, check_in_ts, check_out_ts, profiles:user_id (full_name, branch)')
      .gte('work_date', start)
      .lte('work_date', end)
      .order('work_date')
    setRows(data || [])
    setLoading(false)
  }, [isDemo, month])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  // Group rows by employee.
  const byEmp = {}
  for (const r of rows) {
    const e = (byEmp[r.user_id] ??= {
      id: r.user_id,
      name: r.profiles?.full_name || 'Member',
      branch: r.profiles?.branch,
      days: 0,
      hours: 0,
      rows: [],
    })
    e.days += 1
    if (r.check_in_ts && r.check_out_ts) {
      e.hours += (new Date(r.check_out_ts) - new Date(r.check_in_ts)) / 3600000
    }
    e.rows.push(r)
  }
  const employees = Object.values(byEmp).sort((a, b) => a.name.localeCompare(b.name))

  const shiftMonth = (delta) => {
    const d = new Date(month + '-01T00:00:00')
    d.setMonth(d.getMonth() + delta)
    setMonth(d.toISOString().slice(0, 7))
  }
  const isThisMonth = month === thisMonth()

  const exportCsv = async () => {
    setNote(null)
    if (employees.length === 0) {
      setNote('No attendance recorded this month yet — there’s nothing to export.')
      return
    }
    const detail = [['Employee', 'Branch', 'Date', 'Check-in', 'Check-out', 'Hours']]
    rows
      .slice()
      .sort((a, b) =>
        (a.profiles?.full_name || '').localeCompare(b.profiles?.full_name || '') ||
        a.work_date.localeCompare(b.work_date),
      )
      .forEach((r) => {
        const h =
          r.check_in_ts && r.check_out_ts
            ? ((new Date(r.check_out_ts) - new Date(r.check_in_ts)) / 3600000).toFixed(2)
            : ''
        detail.push([
          r.profiles?.full_name || 'Member',
          r.profiles?.branch || '',
          r.work_date,
          fmtTime(r.check_in_ts),
          r.check_out_ts ? fmtTime(r.check_out_ts) : '',
          h,
        ])
      })
    // Blank line then a per-employee totals block.
    detail.push([])
    detail.push(['Employee', 'Days', 'Total hours'])
    employees.forEach((e) => detail.push([e.name, e.days, e.hours.toFixed(2)]))
    try {
      await downloadCsv(`attendance-${month}.csv`, detail)
      setNote(`Exported attendance-${month}.csv — check your downloads or share sheet.`)
    } catch {
      setNote('Could not export on this device. Try from a laptop, or tell me what device you’re on.')
    }
  }

  return (
    <Card>
      <CardTitle
        eyebrow="Attendance record"
        title={monthLabel(month)}
        action={
          <div className="flex items-center gap-2">
            <Badge tone="neutral">{employees.length} staff</Badge>
            <Button variant="subtle" size="sm" onClick={exportCsv}>
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Button variant="subtle" size="sm" onClick={() => shiftMonth(-1)}>‹ Prev</Button>
        <input
          type="month"
          value={month}
          max={thisMonth()}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-xl border border-white/10 bg-plum-950/50 px-3 py-2 text-sm text-ink focus:border-gold/60 focus:outline-none"
        />
        <Button variant="subtle" size="sm" disabled={isThisMonth} onClick={() => shiftMonth(1)}>Next ›</Button>
      </div>

      {note && (
        <p className="mb-4 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold">
          {note}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : employees.length === 0 ? (
        <p className="text-sm text-ink-soft">No attendance recorded this month.</p>
      ) : (
        <ul className="space-y-2">
          {employees.map((e) => (
            <li key={e.id} className="rounded-2xl border border-white/8 bg-plum-950/40">
              <button
                onClick={() => setOpenId(openId === e.id ? null : e.id)}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                <Avatar name={e.name} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{e.name}</div>
                  <div className="text-xs text-ink-mute">{e.branch || '—'}</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-base font-semibold text-gold">{e.hours.toFixed(1)}h</div>
                  <div className="text-xs text-ink-mute">{e.days} {e.days === 1 ? 'day' : 'days'}</div>
                </div>
              </button>

              {openId === e.id && (
                <ul className="border-t border-white/6 px-3 pb-2">
                  {e.rows.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                      <span className="text-ink-soft">{r.work_date}</span>
                      <span className="text-ink-mute">
                        {fmtTime(r.check_in_ts)} – {r.check_out_ts ? fmtTime(r.check_out_ts) : '—'}
                      </span>
                      <span className="font-semibold text-ink">
                        {hoursWorked(r.check_in_ts, r.check_out_ts) || '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
