import { Link } from 'react-router-dom'
import { CalendarDays, SquareCheckBig, TriangleAlert } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { AvatarStack, Badge, PriorityBadge, Progress, StatusBadge } from './ui'
import { Spotlight } from './motion-primitives/spotlight'
import { Tilt } from './motion-primitives/tilt'
import { dueLabel, fmtDate, isAtRisk, isActive, daysUntil, cx } from '../lib/utils'

const ACCENTS = ['primary', 'mint', 'pink', 'sky', 'peach', 'sun']

export const projectAccent = (p) => ACCENTS[(parseInt(String(p.id).replace(/\D/g, ''), 10) || 0) % ACCENTS.length]

export default function ProjectCard({ project: p }) {
  const { tasks, userById } = useApp()
  const pt = tasks.filter((t) => t.projectId === p.id)
  const done = pt.filter((t) => t.status === 'Done').length
  const members = p.members.map((m) => userById(m.userId)).filter(Boolean)
  const accent = projectAccent(p)
  const overdue = isActive(p) && daysUntil(p.endDate) < 0

  return (
    <Tilt rotationFactor={4} isRevese springOptions={{ stiffness: 260, damping: 26 }} className="h-full">
    <Link to={`/projects/${p.id}`} className="clay group relative flex h-full min-w-0 flex-col gap-4 overflow-hidden p-5">
      <Spotlight size={220} className="bg-[radial-gradient(circle_at_center,rgba(0,71,171,0.16),rgba(0,71,171,0.06)_45%,transparent_70%)] blur-2xl" />
      <div className="flex items-start gap-3">
        <span className={cx('clay-tone grid h-12 w-12 shrink-0 place-items-center text-lg font-black', `tone-${accent}`)}>
          {p.name[0]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-black text-ink group-hover:text-accent">{p.name}</div>
          <div className="text-xs font-bold text-muted">{p.code} · {p.type}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={p.archived ? 'Archived' : p.status} />
        <PriorityBadge priority={p.priority} />
        {isAtRisk(p) && <Badge tone="rose"><TriangleAlert size={12} /> At Risk</Badge>}
      </div>
      <div>
        <div className="mb-2 flex justify-between text-xs font-extrabold text-muted">
          <span>Progress</span>
          <span className="text-ink">{p.progress}%</span>
        </div>
        <Progress value={p.progress} />
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t-2 border-line/70 pt-4">
        <AvatarStack users={members} size={28} />
        <div className="flex items-center gap-3 text-xs font-bold text-muted">
          <span className="flex items-center gap-1" title="Tasks done / total"><SquareCheckBig size={14} /> {done}/{pt.length}</span>
          <span className={cx('flex items-center gap-1', overdue && 'text-rose')} title={fmtDate(p.endDate)}>
            <CalendarDays size={14} /> {isActive(p) ? dueLabel(p.endDate) : fmtDate(p.endDate, { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    </Link>
    </Tilt>
  )
}
