import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { roleLabel, can } from '../lib/roles'
import { DEMO_OVERVIEW, demoStore } from '../lib/demoData'
import { yearOverYear, pct } from '../lib/retention'
import { Card, CardTitle, StatTile, Progress, Badge } from '../components/ui'
import { ClockIcon, ClipboardIcon, CheckSquareIcon } from '../components/icons'

function QuickActions() {
  const actions = [
    { to: '/attendance', label: 'Attendance', desc: 'Check in / out', icon: ClockIcon },
    { to: '/endorsement', label: 'Daily endorsement', desc: 'End-of-day report', icon: ClipboardIcon },
    { to: '/tasks', label: 'Tasks', desc: 'Your queue', icon: CheckSquareIcon },
  ]
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {actions.map(({ to, label, desc, icon: Icon }) => (
        <Link key={to} to={to} className="panel flex items-center gap-3 p-4 transition hover:border-gold/40">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold/12 text-gold">
            <Icon width={22} height={22} />
          </span>
          <span>
            <span className="block text-sm font-semibold text-ink">{label}</span>
            <span className="block text-xs text-ink-mute">{desc}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}

const emptyOverview = {
  latestAnn: null,
  pendingApprovals: null,
  goals: null,
  scoreboard: null,
  reEnroll: null,
  attendance: null,
}

function useOverview(managerPlus) {
  const [data, setData] = useState(emptyOverview)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      const yoy = yearOverYear(demoStore.customers)
      setData({
        latestAnn: demoStore.announcements[0] || null,
        pendingApprovals: demoStore.approvals.filter((a) => a.status === 'pending').length,
        goals: demoStore.goals.slice(0, 3),
        scoreboard: demoStore.benchmarks.slice(0, 5),
        reEnroll: yoy[yoy.length - 1]?.rate ?? null,
        attendance: DEMO_OVERVIEW.attendance,
      })
      return
    }

    const next = { ...emptyOverview }

    const { data: ann } = await supabase
      .from('announcements')
      .select('*, author:author_id (full_name)')
      .order('created_at', { ascending: false })
      .limit(1)
    next.latestAnn = ann?.[0] || null

    const { data: goals } = await supabase
      .from('goals')
      .select('*')
      .eq('status', 'active')
      .order('created_at')
      .limit(3)
    next.goals = goals || []

    const { data: bm } = await supabase
      .from('benchmark_metrics')
      .select('*')
      .order('week_start', { ascending: false })
      .limit(20)
    next.scoreboard = bm && bm.length
      ? bm.filter((r) => r.week_start === bm[0].week_start).slice(0, 5)
      : []

    if (managerPlus) {
      const { count } = await supabase
        .from('approvals')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
      next.pendingApprovals = count ?? 0

      const { data: cust } = await supabase.from('customers').select('master_customer_id, enrolled_year')
      const yoy = yearOverYear(cust || [])
      next.reEnroll = yoy[yoy.length - 1]?.rate ?? null

      // Attendance today (managers can read all rows; one row per person per day).
      const wd = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
      const { count: checkedIn } = await supabase
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('work_date', wd)
      const { count: team } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('active', true)
      next.attendance = { checkedIn: checkedIn ?? 0, team: team ?? 0 }
    }

    setData(next)
  }, [managerPlus])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  return data
}

function AnnouncementCard({ ann }) {
  return (
    <Link to="/announcements" className="block">
      <Card className="transition hover:border-gold/40">
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="eyebrow">Latest announcement</div>
          {ann?.urgent && <Badge tone="gold">Urgent</Badge>}
        </div>
        {ann ? (
          <>
            <h3 className="text-lg text-ink">{ann.title}</h3>
            {ann.body && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-soft">{ann.body}</p>}
            <p className="mt-3 text-xs text-ink-mute">{ann.author?.full_name || ann.author_name || 'Leadership'}</p>
          </>
        ) : (
          <p className="text-sm text-ink-soft">No announcements yet.</p>
        )}
      </Card>
    </Link>
  )
}

export default function Dashboard() {
  const { profile, role, isDemo } = useAuth()
  const o = DEMO_OVERVIEW
  const firstName = (profile?.full_name || 'there').split(' ')[0]
  const managerPlus = can.viewRetention(role)
  const { latestAnn, pendingApprovals, goals, scoreboard, reEnroll, attendance } =
    useOverview(managerPlus)

  const approvalsValue = pendingApprovals ?? 0
  const reEnrollDisplay = reEnroll != null ? pct(reEnroll) : '—'
  const attendanceDisplay = attendance ? `${attendance.checkedIn}/${attendance.team}` : '—'
  const recitalValue = scoreValue(scoreboard, 'Recital ticket sales')

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow mb-1">{roleLabel(role)} · Today</div>
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Good day, {firstName}.</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {managerPlus ? 'The state of the business at a glance.' : 'Your workspace for the day.'}
          </p>
        </div>
        <span className="text-sm text-ink-mute">
          {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
      </header>

      <QuickActions />

      {managerPlus ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Link to="/retention">
              <StatTile label="Re-enrollment" value={reEnrollDisplay} sub="year over year" tone="text-gold" />
            </Link>
            <Link to="/attendance">
              <StatTile label="Attendance" value={attendanceDisplay} sub="checked in today" />
            </Link>
            <Link to="/approvals">
              <StatTile
                label="Approvals"
                value={approvalsValue}
                sub="awaiting sign-off"
                tone={approvalsValue ? 'text-warn' : 'text-ok'}
              />
            </Link>
            <Link to="/scoreboard">
              <StatTile label="Recital tickets" value={recitalValue} sub="this week" />
            </Link>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Link to="/scoreboard" className="block">
              <Card className="h-full transition hover:border-gold/40">
                <CardTitle eyebrow="This week" title="Benchmarking scoreboard" />
                <ScoreboardList scoreboard={scoreboard} demo={isDemo ? o.scoreboard : null} />
              </Card>
            </Link>

            <Link to="/goals" className="block">
              <Card className="h-full transition hover:border-gold/40">
                <CardTitle eyebrow="Active goals" title="Goal board" />
                <GoalsList goals={goals} demo={isDemo ? o.goals : null} />
              </Card>
            </Link>
          </div>

          <AnnouncementCard ann={latestAnn} />
        </>
      ) : (
        <>
          <Card>
            <CardTitle eyebrow="Your day" title="Daily workflow" />
            <p className="text-sm leading-relaxed text-ink-soft">
              Use the actions above: check in when you arrive, work your task queue through
              the day, and file your daily endorsement before you leave.
            </p>
          </Card>
          <AnnouncementCard ann={latestAnn} />
        </>
      )}
    </div>
  )
}

function scoreValue(scoreboard, name) {
  if (scoreboard && scoreboard.length) {
    const hit = scoreboard.find((s) => s.metric_name === name)
    if (hit) return String(hit.our_value)
  }
  return '—' // no figure entered yet
}

function ScoreboardList({ scoreboard, demo }) {
  const items =
    scoreboard && scoreboard.length
      ? scoreboard.map((s) => ({ metric: s.metric_name, value: String(s.our_value) }))
      : demo
  if (!items || items.length === 0) {
    return <p className="text-sm text-ink-soft">No numbers entered yet — tap to add this week’s.</p>
  }
  return (
    <ul className="divide-y divide-white/6">
      {items.map((s) => (
        <li key={s.metric} className="flex items-center justify-between py-2.5">
          <span className="text-sm text-ink-soft">{s.metric}</span>
          <span className="font-display text-base font-semibold text-ink">{s.value}</span>
        </li>
      ))}
    </ul>
  )
}

function GoalsList({ goals, demo }) {
  const items =
    goals && goals.length
      ? goals.map((g) => ({ title: g.title, current: Number(g.current), target: Number(g.target) || 100 }))
      : demo
  if (!items || items.length === 0) {
    return <p className="text-sm text-ink-soft">No active goals yet — tap to add one.</p>
  }
  return (
    <div className="space-y-4">
      {items.map((g) => (
        <div key={g.title}>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="text-ink-soft">{g.title}</span>
            <span className="font-semibold text-ink">
              {g.current}
              <span className="text-ink-mute"> / {g.target}</span>
            </span>
          </div>
          <Progress value={g.current} max={g.target} />
        </div>
      ))}
    </div>
  )
}
