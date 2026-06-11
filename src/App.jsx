import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppShell from './components/AppShell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import Team from './pages/Team'
import Attendance from './pages/Attendance'
import Endorsement from './pages/Endorsement'
import Tasks from './pages/Tasks'
import Ledger from './pages/Ledger'
import Approvals from './pages/Approvals'
import Announcements from './pages/Announcements'
import Retention from './pages/Retention'
import Scoreboard from './pages/Scoreboard'
import Goals from './pages/Goals'
import Calendar from './pages/Calendar'
import Chat from './pages/Chat'
import Classes from './pages/Classes'
import Schedule from './pages/Schedule'
import Menu from './pages/Menu'
import { LogoMark } from './components/Logo'

function Splash() {
  return (
    <div className="grid min-h-[100dvh] place-items-center">
      <div className="flex flex-col items-center gap-3 opacity-80">
        <LogoMark size={48} />
        <span className="text-sm text-ink-soft">Loading…</span>
      </div>
    </div>
  )
}

// Gate any authenticated route. `allow` optionally restricts by role.
function Protected({ allow, children }) {
  const { session, role, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Splash />
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  if (allow && !allow.includes(role)) return <Navigate to="/" replace />

  return <AppShell>{children}</AppShell>
}

export default function App() {
  const { session, loading } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? <Splash /> : session ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />
      <Route
        path="/attendance"
        element={
          <Protected>
            <Attendance />
          </Protected>
        }
      />
      <Route
        path="/endorsement"
        element={
          <Protected>
            <Endorsement />
          </Protected>
        }
      />
      <Route
        path="/tasks"
        element={
          <Protected>
            <Tasks />
          </Protected>
        }
      />
      <Route
        path="/announcements"
        element={
          <Protected>
            <Announcements />
          </Protected>
        }
      />
      <Route
        path="/approvals"
        element={
          <Protected>
            <Approvals />
          </Protected>
        }
      />
      <Route
        path="/ledger"
        element={
          <Protected allow={['ceo', 'coo', 'admin_manager']}>
            <Ledger />
          </Protected>
        }
      />
      <Route
        path="/retention"
        element={
          <Protected allow={['ceo', 'coo', 'admin_manager']}>
            <Retention />
          </Protected>
        }
      />
      <Route
        path="/scoreboard"
        element={
          <Protected>
            <Scoreboard />
          </Protected>
        }
      />
      <Route
        path="/goals"
        element={
          <Protected>
            <Goals />
          </Protected>
        }
      />
      <Route
        path="/calendar"
        element={
          <Protected>
            <Calendar />
          </Protected>
        }
      />
      <Route
        path="/schedule"
        element={
          <Protected>
            <Schedule />
          </Protected>
        }
      />
      <Route
        path="/chat"
        element={
          <Protected>
            <Chat />
          </Protected>
        }
      />
      <Route
        path="/classes"
        element={
          <Protected allow={['ceo', 'coo', 'admin_manager']}>
            <Classes />
          </Protected>
        }
      />
      <Route
        path="/menu"
        element={
          <Protected>
            <Menu />
          </Protected>
        }
      />
      <Route
        path="/profile"
        element={
          <Protected>
            <Profile />
          </Protected>
        }
      />
      <Route
        path="/team"
        element={
          <Protected allow={['ceo', 'coo']}>
            <Team />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
