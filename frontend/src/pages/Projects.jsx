import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, LayoutGrid, List, FolderKanban } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { usePageMeta } from '../lib/seo'
import ProjectCard, { projectAccent } from '../components/ProjectCard'
import { AvatarStack, Button, Card, Empty, Input, PageHeader, PriorityBadge, Progress, Select, Stagger, StatusBadge, Tabs } from '../components/ui'
import { PRIORITIES, PROJECT_TYPES } from '../data/constants'
import { byDate, cx, fmtDate, isActive } from '../lib/utils'

const FILTERS = [
  { key: 'all', label: 'All Projects' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'archived', label: 'Archived' },
]

export default function Projects() {
  usePageMeta({ title: 'Projects', description: 'All your academic projects with status, progress, deadlines and team members.' })
  const { projects, tasks, userById } = useApp()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const filter = params.get('filter') || 'all'
  const [q, setQ] = useState('')
  const [priority, setPriority] = useState('')
  const [type, setType] = useState('')
  const [view, setView] = useState('grid')
  const [sort, setSort] = useState('deadline')

  const list = useMemo(() => {
    let l = projects.filter((p) =>
      filter === 'archived' ? p.archived : filter === 'active' ? isActive(p) : filter === 'completed' ? p.status === 'Completed' && !p.archived : !p.archived,
    )
    if (q) l = l.filter((p) => (p.name + p.code).toLowerCase().includes(q.toLowerCase()))
    if (priority) l = l.filter((p) => p.priority === priority)
    if (type) l = l.filter((p) => p.type === type)
    const sorters = { deadline: byDate('endDate'), progress: (a, b) => b.progress - a.progress, name: (a, b) => a.name.localeCompare(b.name) }
    return [...l].sort(sorters[sort])
  }, [projects, filter, q, priority, type, sort])

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle={`${list.length} project${list.length === 1 ? '' : 's'} · manage every academic project in one place`}
        actions={<Button icon={Plus} onClick={() => navigate('/projects/new')}>New Project</Button>}
      />

      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center">
        <Tabs tabs={FILTERS} active={filter} onChange={(k) => setParams({ filter: k })} />
        <div className="flex flex-1 flex-wrap items-center gap-3 xl:justify-end">
          <div className="relative min-w-52 flex-1 xl:max-w-64">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-4 z-10 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name or code" className="!py-2.5 pl-10" />
          </div>
          <Select aria-label="Filter by priority" value={priority} onChange={(e) => setPriority(e.target.value)} options={PRIORITIES} placeholder="All priorities" className="!w-auto !py-2.5" />
          <Select aria-label="Filter by project type" value={type} onChange={(e) => setType(e.target.value)} options={PROJECT_TYPES} placeholder="All types" className="!w-auto !py-2.5" />
          <Select aria-label="Sort projects" value={sort} onChange={(e) => setSort(e.target.value)} options={[{ value: 'deadline', label: 'Sort: Deadline' }, { value: 'progress', label: 'Sort: Progress' }, { value: 'name', label: 'Sort: Name' }]} className="!w-auto !py-2.5" />
          <div className="clay-inset flex gap-1 p-1">
            <button onClick={() => setView('grid')} className={cx('tab !px-2.5', view === 'grid' && 'active')} aria-label="Grid view"><LayoutGrid size={17} /></button>
            <button onClick={() => setView('list')} className={cx('tab !px-2.5', view === 'list' && 'active')} aria-label="List view"><List size={17} /></button>
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <Card><Empty icon={FolderKanban} title="No projects found" text="Try another filter, or create a new project." action={<Button icon={Plus} onClick={() => navigate('/projects/new')}>New Project</Button>} /></Card>
      ) : view === 'grid' ? (
        <Stagger key={`${filter}-${list.length}`} fill stagger={0.05} className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.map((p) => <ProjectCard key={p.id} project={p} />)}
        </Stagger>
      ) : (
        <Card className="overflow-x-auto !p-3">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="text-xs font-black tracking-wide text-muted uppercase">
                {['Project', 'Type', 'Members', 'Tasks', 'Progress', 'Deadline', 'Priority', 'Status'].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const pt = tasks.filter((t) => t.projectId === p.id)
                return (
                  <tr key={p.id} className="row-hover">
                    <td className="rounded-l-2xl px-3 py-3">
                      <Link to={`/projects/${p.id}`} className="flex items-center gap-3">
                        <span className={cx('clay-tone grid h-9 w-9 shrink-0 place-items-center !rounded-xl text-sm font-black', `tone-${projectAccent(p)}`)}>{p.name[0]}</span>
                        <div><div className="text-sm font-extrabold text-ink">{p.name}</div><div className="text-[11px] font-bold text-muted">{p.code}</div></div>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-sm font-bold text-muted">{p.type}</td>
                    <td className="px-3 py-3"><AvatarStack users={p.members.map((m) => userById(m.userId)).filter(Boolean)} size={26} max={3} /></td>
                    <td className="px-3 py-3 text-sm font-extrabold text-ink">{pt.filter((t) => t.status === 'Done').length}/{pt.length}</td>
                    <td className="w-40 px-3 py-3"><Progress value={p.progress} showLabel /></td>
                    <td className="px-3 py-3 text-sm font-bold text-ink">{fmtDate(p.endDate)}</td>
                    <td className="px-3 py-3"><PriorityBadge priority={p.priority} /></td>
                    <td className="rounded-r-2xl px-3 py-3"><StatusBadge status={p.archived ? 'Archived' : p.status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
