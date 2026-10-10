import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { GraduationCap, ArrowLeft } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { SITE } from '../config/site'

/** Layout for public pages (legal, reviews, 404): works whether or not you are signed in. */
export default function PublicShell({ children, wide }) {
  const { me } = useApp()
  return (
    <div className="min-h-screen px-4 py-6 sm:px-6">
      <header className="mx-auto mb-6 flex max-w-5xl items-center justify-between gap-3">
        <Link to={me ? '/dashboard' : '/login'} className="flex items-center gap-3">
          <span className="clay-tone tone-accent grid h-11 w-11 place-items-center"><GraduationCap size={22} strokeWidth={2.4} aria-hidden="true" /></span>
          <span>
            <span className="block text-lg leading-none font-black text-ink">{SITE.name}</span>
            <span className="text-[11px] font-bold text-muted">Academic Projects</span>
          </span>
        </Link>
        <Link to={me ? '/dashboard' : '/login'} className="btn-ghost"><ArrowLeft size={16} aria-hidden="true" /> {me ? 'Back to app' : 'Sign in'}</Link>
      </header>
      <motion.main
        id="main"
        initial={{ y: 14 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.35 }}
        className={`mx-auto ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}
      >
        {children}
      </motion.main>
      <SiteFooter />
    </div>
  )
}

export function SiteFooter({ className = '' }) {
  return (
    <footer className={`mx-auto mt-10 flex max-w-5xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-bold text-muted ${className}`}>
      <span>© {new Date().getFullYear()} {SITE.organization}</span>
      <Link to="/privacy" className="hover:text-accent">Privacy Policy</Link>
      <Link to="/terms" className="hover:text-accent">Terms &amp; Conditions</Link>
      <Link to="/testimonials" className="hover:text-accent">User Reviews</Link>
    </footer>
  )
}
