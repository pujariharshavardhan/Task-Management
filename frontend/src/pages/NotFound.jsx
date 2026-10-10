import { Link, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { Compass, Home, FolderKanban } from 'lucide-react'
import PublicShell from '../components/PublicShell'
import { Card } from '../components/ui'
import { useApp } from '../context/AppContext'
import { usePageMeta } from '../lib/seo'

export default function NotFound() {
  usePageMeta({ title: 'Page not found', description: 'The page you were looking for does not exist.' })
  const { pathname } = useLocation()
  const { me } = useApp()
  return (
    <PublicShell>
      <Card className="flex flex-col items-center gap-5 !py-14 text-center">
        <motion.div animate={{ rotate: [0, 18, -14, 8, 0] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.5 }}
          className="clay-tone tone-accent grid h-24 w-24 place-items-center !rounded-full">
          <Compass size={44} strokeWidth={2.2} aria-hidden="true" />
        </motion.div>
        <div>
          <p className="text-6xl font-black tracking-tight text-ink">404</p>
          <h1 className="mt-2 text-2xl font-black text-ink">Page not found</h1>
          <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-muted">
            Nothing lives at <code className="rounded-lg bg-bg px-1.5 py-0.5 font-mono text-ink">{pathname}</code>. The link may be mistyped, or the page was moved.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to={me ? '/dashboard' : '/login'} className="btn-tone tone-primary"><Home size={17} aria-hidden="true" /> {me ? 'Go to dashboard' : 'Go to sign in'}</Link>
          {me && <Link to="/projects" className="btn-ghost"><FolderKanban size={17} aria-hidden="true" /> Your projects</Link>}
        </div>
      </Card>
    </PublicShell>
  )
}
