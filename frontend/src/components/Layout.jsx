import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate, useOutlet, useSearchParams, Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  LayoutDashboard, FolderKanban, SquareCheckBig, CalendarDays, Users, ChartColumn, FileText, MessagesSquare, Settings,
  Bell, Search, Plus, Award, Menu, X, ChevronDown, PanelLeftClose, PanelLeftOpen, LogOut, GraduationCap, User, Flag, Folder,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Avatar, Button, FieldShell, IconButton } from './ui'
import { Magnetic } from './motion-primitives/magnetic'
import { cx, timeAgo } from '../lib/utils'
import { NotificationIcon } from '../pages/Notifications'
import { SiteFooter } from './PublicShell'
import ErrorBoundary from './ErrorBoundary'
import { TextShimmer } from './motion-primitives/text-shimmer'

const DROPDOWN = {
  initial: { opacity: 0, y: -8, scale: 0.97, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -6, scale: 0.98, filter: 'blur(4px)' },
  transition: { type: 'spring', bounce: 0.15, duration: 0.3 },
}

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Projects', icon: FolderKanban, to: '/projects', children: [
    { label: 'All Projects', filter: 'all' }, { label: 'Active', filter: 'active' }, { label: 'Completed', filter: 'completed' }, { label: 'Archived', filter: 'archived' },
  ] },
  { label: 'Tasks', icon: SquareCheckBig, to: '/tasks' },
  { label: 'Calendar', icon: CalendarDays, to: '/calendar' },
  { label: 'Team', icon: Users, to: '/team' },
  { label: 'Reviews', icon: Award, to: '/reviews' },
  { label: 'Reports', icon: ChartColumn, to: '/reports' },
  { label: 'Documents', icon: FileText, to: '/documents' },
  { label: 'Discussions', icon: MessagesSquare, to: '/discussions' },
  { label: 'Settings', icon: Settings, to: '/settings' },
]

function Logo({ collapsed }) {
  return (
    <Link to="/dashboard" className="flex items-center gap-3 px-2">
      <motion.span whileHover={{ rotate: -10, scale: 1.06 }} transition={{ type: "spring", stiffness: 300, damping: 14 }} className="clay-tone tone-accent grid h-11 w-11 shrink-0 place-items-center"><GraduationCap size={22} strokeWidth={2.4} /></motion.span>
      {!collapsed && (
        <div>
          <div className="text-lg font-black leading-none text-ink">APMS</div>
          <div className="text-[11px] font-bold text-muted">Academic Projects</div>
        </div>
      )}
    </Link>
  )
}

/** Clay pill that glides between the active nav items. */
const NavPill = ({ id }) => (
  <motion.span layoutId={id} className="clay-sm absolute inset-0 !rounded-2xl" transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }} />
)

function SidebarNav({ collapsed, onNavigate, scope = 'side' }) {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const [open, setOpen] = useState(pathname.startsWith('/projects'))
  const filter = params.get('filter') || 'all'
  const pill = `nav-pill-${scope}`

  return (
    <nav className="flex flex-col gap-1.5">
      {NAV.map((item) => {
        if (item.children) {
          const active = pathname.startsWith('/projects')
          return (
            <div key={item.label}>
              <div className={cx('nav-item relative w-full', active && 'text-accent', collapsed && 'justify-center')}>
                {active && <NavPill id={pill} />}
                <NavLink to="/projects" onClick={onNavigate} className="relative z-10 -my-2.5 flex flex-1 items-center gap-3 py-2.5" title={item.label}>
                  <item.icon size={19} strokeWidth={2.3} />
                  {!collapsed && <span className="flex-1">{item.label}</span>}
                </NavLink>
                {!collapsed && (
                  <button onClick={() => setOpen(!open)} aria-label="Toggle projects menu" aria-expanded={open} className="relative z-10 -m-1.5 cursor-pointer rounded-lg p-1.5">
                    <motion.span animate={{ rotate: open ? 180 : 0 }} className="block"><ChevronDown size={16} /></motion.span>
                  </button>
                )}
              </div>
              <AnimatePresence initial={false}>
                {open && !collapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1 ml-6 flex flex-col gap-0.5 border-l-2 border-line pl-3">
                      {item.children.map((c) => (
                        <Link
                          key={c.filter}
                          to={`/projects?filter=${c.filter}`}
                          onClick={onNavigate}
                          className={cx('rounded-xl px-3 py-1.5 text-[13px] font-bold transition', pathname === '/projects' && filter === c.filter ? 'text-accent' : 'text-muted hover:text-ink')}
                        >
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        }
        return (
          <NavLink key={item.to} to={item.to} onClick={onNavigate} title={item.label} className={({ isActive }) => cx('nav-item relative', isActive && 'text-accent', collapsed && 'justify-center')}>
            {({ isActive }) => (
              <>
                {isActive && <NavPill id={pill} />}
                <span className={cx('relative z-10 flex items-center gap-3', collapsed && 'justify-center')}>
                  <item.icon size={19} strokeWidth={2.3} />
                  {!collapsed && item.label}
                </span>
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

function GlobalSearch() {
  const { projects, tasks, users, documents, milestones } = useApp()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const navigate = useNavigate()

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const key = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); ref.current?.querySelector('input')?.focus() } }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key) }
  }, [])

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    const m = (x) => x.toLowerCase().includes(s)
    return [
      { group: 'Projects', icon: FolderKanban, items: projects.filter((p) => m(p.name) || m(p.code || '')).map((p) => ({ id: p.id, label: p.name, sub: p.code, to: `/projects/${p.id}` })) },
      { group: 'Tasks', icon: SquareCheckBig, items: tasks.filter((t) => m(t.title) || m(t.key || '')).map((t) => ({ id: t.id, label: t.title, sub: t.key, to: `/tasks?task=${t.id}` })) },
      { group: 'Members', icon: User, items: users.filter((u) => m(u.name) || m(u.email)).map((u) => ({ id: u.id, label: u.name, sub: u.title, to: '/team' })) },
      { group: 'Documents', icon: Folder, items: documents.filter((d) => m(d.name)).map((d) => ({ id: d.id, label: d.name, sub: d.folder, to: '/documents' })) },
      { group: 'Milestones', icon: Flag, items: milestones.filter((x) => m(x.name)).map((x) => ({ id: x.id, label: x.name, sub: 'Milestone', to: `/projects/${x.projectId}?tab=Milestones` })) },
    ].filter((g) => g.items.length)
  }, [q, projects, tasks, users, documents, milestones])

  const go = (to) => { navigate(to); setOpen(false); setQ('') }

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <FieldShell>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search projects, tasks, members, documents..."
          className="input !rounded-2xl !py-2.5 pr-14 pl-11"
        />
      </FieldShell>
      <Search size={17} className="pointer-events-none absolute top-1/2 left-4 z-10 -translate-y-1/2 text-muted" />
      <kbd className="pointer-events-none absolute top-1/2 right-3 z-10 hidden -translate-y-1/2 rounded-lg bg-surface px-1.5 py-0.5 text-[10px] font-black text-muted shadow sm:block">Ctrl K</kbd>
      <AnimatePresence>
      {open && q && (
        <motion.div {...DROPDOWN} className="clay absolute top-full right-0 left-0 z-40 mt-3 max-h-[70vh] overflow-y-auto p-3">
          {results.length === 0 ? (
            <div className="p-4 text-center text-sm font-semibold text-muted">No results for “{q}”</div>
          ) : (
            results.map((g) => (
              <div key={g.group} className="mb-2 last:mb-0">
                <div className="px-3 py-1.5 text-[11px] font-black tracking-wider text-muted uppercase">{g.group}</div>
                {g.items.slice(0, 5).map((it) => (
                  <button key={it.id} onClick={() => go(it.to)} className="row-hover flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-left">
                    <g.icon size={16} className="text-accent" />
                    <span className="flex-1 truncate text-sm font-bold text-ink">{it.label}</span>
                    <span className="text-xs font-semibold text-muted">{it.sub}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  )
}

function useClickOutside(onClose) {
  const ref = useRef()
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onClose()
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])
  return ref
}

function NotificationMenu() {
  const { notifications, markRead, markAllRead, projectById } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(() => setOpen(false))
  const navigate = useNavigate()
  const unread = notifications.filter((n) => !n.read).length

  return (
    <div ref={ref} className="relative">
      <Magnetic intensity={0.25} range={60}><IconButton icon={Bell} label="Notifications" badge={unread} onClick={() => setOpen(!open)} /></Magnetic>
      <AnimatePresence>
      {open && (
        <motion.div {...DROPDOWN} className="clay absolute top-full right-0 z-40 mt-3 w-[min(22rem,calc(100vw-2rem))] origin-top-right p-3">
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="font-black text-ink">Notifications</span>
            <button onClick={markAllRead} className="cursor-pointer text-xs font-extrabold text-accent">Mark all read</button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.slice(0, 6).map((n) => (
              <button
                key={n.id}
                onClick={() => { markRead(n.id); setOpen(false); navigate(n.taskId ? `/tasks?task=${n.taskId}` : `/projects/${n.projectId}`) }}
                className="row-hover flex w-full cursor-pointer items-start gap-3 rounded-2xl p-2.5 text-left"
              >
                <NotificationIcon type={n.type} size={36} />
                <div className="min-w-0 flex-1">
                  <div className={cx('text-sm leading-snug', n.read ? 'font-semibold text-muted' : 'font-extrabold text-ink')}>{n.message}</div>
                  <div className="mt-0.5 text-xs font-semibold text-muted">{projectById(n.projectId)?.name} · {timeAgo(n.at)}</div>
                </div>
                {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
              </button>
            ))}
          </div>
          <Link to="/notifications" onClick={() => setOpen(false)} className="btn-ghost mt-2 w-full">View all</Link>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  )
}

function ProfileMenu() {
  const { me, logout } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(() => setOpen(false))
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-label="Account menu" aria-expanded={open} className="clay-sm flex cursor-pointer items-center gap-2.5 !rounded-2xl p-1.5 pr-3">
        <Avatar user={me} size={34} />
        <div className="hidden text-left lg:block">
          <div className="text-sm leading-tight font-black text-ink">{me.name}</div>
          <div className="text-[11px] font-bold text-muted">{me.title || me.role}</div>
        </div>
        <ChevronDown size={15} className="hidden text-muted lg:block" />
      </button>
      <AnimatePresence>
      {open && (
        <motion.div {...DROPDOWN} className="clay absolute top-full right-0 z-40 mt-3 w-56 origin-top-right p-2">
          <div className="px-3 py-2">
            <div className="text-sm font-black text-ink">{me.name}</div>
            <div className="truncate text-xs font-semibold text-muted">{me.email}</div>
          </div>
          <Link to="/settings" onClick={() => setOpen(false)} className="row-hover flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-bold text-ink"><User size={16} /> Profile</Link>
          <Link to="/settings?tab=Notifications" onClick={() => setOpen(false)} className="row-hover flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-bold text-ink"><Settings size={16} /> Settings</Link>
          <button onClick={logout} className="row-hover flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-bold text-rose"><LogOut size={16} /> Log out</button>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  )
}

export function Toasts() {
  const { toasts } = useApp()
  return (
    <div className="fixed right-4 bottom-24 z-[60] flex flex-col gap-3 lg:bottom-6">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: 'spring', bounce: 0.3, duration: 0.45 }}
            className={cx('clay-tone px-5 py-3 text-sm font-extrabold', `tone-${t.tone}`)}
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

const MOBILE_NAV = [NAV[0], NAV[1], NAV[2], NAV[3]]

export default function Layout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('apms_collapsed') === '1')
  const [drawer, setDrawer] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const outlet = useOutlet()

  useEffect(() => { try { localStorage.setItem('apms_collapsed', collapsed ? '1' : '0') } catch { /* ignore */ } }, [collapsed])
  useEffect(() => { setDrawer(false); window.scrollTo(0, 0) }, [pathname])

  return (
    <div className="min-h-screen">
      <a href="#main" className="skip-link">Skip to content</a>
      {/* Desktop / tablet sidebar */}
      <aside className={cx('fixed inset-y-0 left-0 z-30 hidden p-4 transition-all md:block', collapsed ? 'w-24' : 'w-72')}>
        <div className="clay flex h-full flex-col gap-6 overflow-y-auto p-4">
          <Logo collapsed={collapsed} />
          <SidebarNav collapsed={collapsed} />
          <div className="mt-auto flex flex-col gap-3">
            <button onClick={() => setCollapsed(!collapsed)} className="nav-item cursor-pointer justify-center" aria-label={collapsed ? "Expand sidebar" : undefined} aria-expanded={!collapsed}>
              {collapsed ? <PanelLeftOpen size={19} /> : <><PanelLeftClose size={19} /> Collapse</>}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawer && (
          <motion.div key="drawer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm md:hidden" onClick={() => setDrawer(false)}>
            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', bounce: 0.15, duration: 0.45 }}
              className="clay absolute inset-y-3 left-3 flex w-72 flex-col gap-6 overflow-y-auto p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <Logo />
                <IconButton icon={X} label="Close menu" onClick={() => setDrawer(false)} />
              </div>
              <SidebarNav scope="drawer" onNavigate={() => setDrawer(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cx('transition-all', collapsed ? 'md:pl-24' : 'md:pl-72')}>
        <header className="sticky top-0 z-20 bg-bg/80 px-4 py-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <IconButton icon={Menu} label="Open menu" className="md:hidden" onClick={() => setDrawer(true)} />
            <GlobalSearch />
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden sm:block"><Magnetic intensity={0.3} range={90}><Button icon={Plus} onClick={() => navigate('/projects/new')}>New Project</Button></Magnetic></div>
              <IconButton icon={Plus} label="New Project" onClick={() => navigate('/projects/new')} className="sm:hidden" />
              <NotificationMenu />
              <div className="hidden sm:block"><Magnetic intensity={0.25} range={60}><IconButton icon={Settings} label="Settings" onClick={() => navigate('/settings')} /></Magnetic></div>
              <ProfileMenu />
            </div>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="px-4 pt-2 pb-28 outline-none sm:px-6 md:pb-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
              exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              <ErrorBoundary key={pathname}>
                <Suspense fallback={<div className="grid min-h-[50vh] place-items-center"><TextShimmer className="text-sm font-black [--base-color:#94a3b8] [--base-gradient-color:#0047ab]">Loading…</TextShimmer></div>}>
                  {outlet}
                </Suspense>
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
          <SiteFooter className="mt-12" />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="clay fixed inset-x-3 bottom-3 z-30 flex justify-around p-2 md:hidden">
        {MOBILE_NAV.map((i) => (
          <NavLink key={i.to} to={i.to} className={({ isActive }) => cx('relative rounded-2xl px-3 py-1.5 text-[10px] font-extrabold', isActive ? 'text-accent' : 'text-muted')}>
            {({ isActive }) => (
              <>
                {isActive && <NavPill id="nav-pill-mobile" />}
                <span className="relative z-10 flex flex-col items-center gap-0.5"><i.icon size={19} strokeWidth={2.3} />{i.label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button onClick={() => setDrawer(true)} className="flex cursor-pointer flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] font-extrabold text-muted">
          <Menu size={19} /> More
        </button>
      </nav>

    </div>
  )
}
