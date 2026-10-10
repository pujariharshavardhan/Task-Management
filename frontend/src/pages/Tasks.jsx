import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, Columns3, List } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { usePageMeta } from '../lib/seo'
import { KanbanBoard, TaskFormModal, TaskDetailModal } from '../components/TaskBoard'
import { Avatar, Button, Card, Chip, Empty, Input, PageHeader, PriorityBadge, Select, StatusBadge } from '../components/ui'
import { PRIORITIES } from '../data/constants'
import { byDate, cx, daysUntil, dueLabel, fmtDate } from '../lib/utils'

export default function Tasks() {
  usePageMeta({ title: 'Tasks', description: 'Kanban board of tasks across your projects: to do, in progress, review and done.' })
  const { tasks, projects, users, me, userById, projectById } = useApp()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [project, setProject] = useState('')
  const [assignee, setAssignee] = useState('')
  const [priority, setPriority] = useState('')
  const [mine, setMine] = useState(false)
  const [view, setView] = useState('board')
  const [modal, setModal] = useState(null)
  const openTask = params.get('task')

  const list = useMemo(() => tasks.filter((t) =>
    (!q || (t.title + t.key + t.tags.join(' ')).toLowerCase().includes(q.toLowerCase())) &&
    (!project || String(t.projectId) === String(project)) &&
    (!assignee || String(t.assignedTo) === String(assignee)) &&
    (!priority || t.priority === priority) &&
    (!mine || t.assignedTo === me.id),
  ), [tasks, q, project, assignee, priority, mine, me.id])

  return (
    <div>
      <PageHeader title="Tasks" subtitle="Drag cards between columns to update their status." actions={<Button icon={Plus} onClick={() => setModal({ status: 'Todo' })}>New Task</Button>} />

      <Card className="mb-6 flex flex-wrap items-center gap-3 !p-4">
        <div className="relative min-w-52 flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-4 z-10 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks, IDs or #tags" className="!py-2.5 pl-10" />
        </div>
        <Select aria-label="Filter by project" value={project} onChange={(e) => setProject(e.target.value)} placeholder="All projects" options={projects.filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name }))} className="!w-auto !py-2.5" />
        <Select aria-label="Filter by assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Anyone" options={users.map((u) => ({ value: u.id, label: u.name }))} className="!w-auto !py-2.5" />
        <Select aria-label="Filter by priority" value={priority} onChange={(e) => setPriority(e.target.value)} placeholder="Any priority" options={PRIORITIES} className="!w-auto !py-2.5" />
        <Chip active={mine} onClick={() => setMine(!mine)}>My tasks</Chip>
        <div className="clay-inset flex gap-1 p-1">
          <button onClick={() => setView('board')} className={cx('tab !px-2.5', view === 'board' && 'active')} aria-label="Board view"><Columns3 size={17} /></button>
          <button onClick={() => setView('list')} className={cx('tab !px-2.5', view === 'list' && 'active')} aria-label="List view"><List size={17} /></button>
        </div>
      </Card>

      {view === 'board' ? (
        <KanbanBoard tasks={list} onNewTask={(status) => setModal({ status })} />
      ) : list.length === 0 ? (
        <Card><Empty title="No tasks match" /></Card>
      ) : (
        <Card className="overflow-x-auto !p-3">
          <table className="w-full min-w-[820px] text-left">
            <thead><tr className="text-xs font-black tracking-wide text-muted uppercase">{['ID', 'Task', 'Project', 'Assignee', 'Due', 'Priority', 'Status'].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {[...list].sort(byDate('dueDate')).map((t) => (
                <tr key={t.id} className="row-hover cursor-pointer" onClick={() => setParams({ task: t.id })}>
                  <td className="rounded-l-2xl px-3 py-3 text-xs font-black text-muted">{t.key}</td>
                  <td className="px-3 py-3 text-sm font-extrabold text-ink">{t.title}</td>
                  <td className="px-3 py-3 text-sm font-bold text-muted">{projectById(t.projectId)?.name}</td>
                  <td className="px-3 py-3"><div className="flex items-center gap-2"><Avatar user={userById(t.assignedTo)} size={26} /><span className="text-sm font-bold">{userById(t.assignedTo)?.name || '—'}</span></div></td>
                  <td className="px-3 py-3"><div className="text-sm font-bold text-ink">{fmtDate(t.dueDate, { month: 'short', day: 'numeric' })}</div><div className={cx('text-[11px] font-bold', t.status !== 'Done' && daysUntil(t.dueDate) < 0 ? 'text-rose' : 'text-muted')}>{t.status === 'Done' ? 'Completed' : dueLabel(t.dueDate)}</div></td>
                  <td className="px-3 py-3"><PriorityBadge priority={t.priority} /></td>
                  <td className="rounded-r-2xl px-3 py-3"><StatusBadge status={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <TaskFormModal open={!!modal} onClose={() => setModal(null)} defaults={{ status: modal?.status, projectId: project }} />
      {openTask && <TaskDetailModal taskId={openTask} onClose={() => setParams({})} />}
    </div>
  )
}
