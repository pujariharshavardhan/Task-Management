import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useApp } from './context/AppContext'
import { TextShimmer } from './components/motion-primitives/text-shimmer'
import Layout, { Toasts } from './components/Layout'
import { AuthLayout, Login, Register } from './pages/Auth'
import ErrorBoundary from './components/ErrorBoundary'

// Each page is its own chunk, downloaded the first time it is opened
const Testimonials = lazy(() => import('./pages/Testimonials'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Projects = lazy(() => import('./pages/Projects'))
const CreateProject = lazy(() => import('./pages/CreateProject'))
const ProjectDetails = lazy(() => import('./pages/ProjectDetails'))
const Tasks = lazy(() => import('./pages/Tasks'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Team = lazy(() => import('./pages/Team'))
const Documents = lazy(() => import('./pages/Documents'))
const Reviews = lazy(() => import('./pages/Reviews'))
const Reports = lazy(() => import('./pages/Reports'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Discussions = lazy(() => import('./pages/Discussions'))
const Settings = lazy(() => import('./pages/Settings'))
const NotFound = lazy(() => import('./pages/NotFound'))
const PrivacyPolicy = lazy(() => import('./pages/Legal').then((m) => ({ default: m.PrivacyPolicy })))
const Terms = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Terms })))

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center">
      <TextShimmer className="text-lg font-black [--base-color:#94a3b8] [--base-gradient-color:#0047ab]" duration={1.4}>Loading your workspace…</TextShimmer>
    </div>
  )
}

function Protected({ children }) {
  const { me, booting } = useApp()
  if (booting) return <Splash />
  return me ? children : <Navigate to="/login" replace />
}

function PublicOnly({ children }) {
  const { me, booting } = useApp()
  if (booting) return <Splash />
  return me ? <Navigate to="/dashboard" replace /> : children
}

export default function App() {
  return (
    <ErrorBoundary>
    <Suspense fallback={<Splash />}>
    <Routes>
      {/* Public pages: readable signed in or out */}
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/testimonials" element={<Testimonials />} />
      <Route element={<PublicOnly><AuthLayout /></PublicOnly>}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/new" element={<CreateProject />} />
        <Route path="/projects/:projectId" element={<ProjectDetails />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/team" element={<Team />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/discussions" element={<Discussions />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
    <Toasts />
    </ErrorBoundary>
  )
}
