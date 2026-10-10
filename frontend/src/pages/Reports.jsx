import { useMemo, useState } from 'react'
import { Download, FileText, FileSpreadsheet, Printer, Target, ListTodo, CircleCheck, Clock, TriangleAlert, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { useApp } from '../context/AppContext'
import { usePageMeta } from '../lib/seo'
import { Avatar, Badge, Button, Card, PageHeader, PriorityBadge, Progress, SectionTitle, Select, Stagger, StatCard, StatusBadge } from '../components/ui'
import { byDate, cx, daysUntil, fmtDate, milestoneStatus } from '../lib/utils'

const TYPES = ['Project Progress', 'Task Completion', 'Team Workload', 'Delayed Tasks', 'Deadline Report', 'Milestone Report', 'Member Contribution', 'Project Completion Report']
const REPORT_KEYS = {
  'Project Progress': 'project-progress', 'Task Completion': 'task-completion', 'Team Workload': 'team-workload', 'Delayed Tasks': 'delayed-tasks',
  'Deadline Report': 'deadline-report', 'Milestone Report': 'milestone-report', 'Member Contribution': 'member-contribution', 'Project Completion Report': 'project-completion',
}
const C = { primary: '#0a0a0a', accent: '#0047ab', mint: '#15803d', peach: '#c2410c', sky: '#1e3a8a', pink: '#9d174d', sun: '#b45309', rose: '#b91c1c', muted: '#94a3b8' }
const tip = { contentStyle: { borderRadius: 16, border: 'none', boxShadow: '0 8px 24px rgba(10,10,10,.12)', fontWeight: 700, fontFamily: 'Nunito' }, cursor: { fill: 'rgba(0,71,171,.06)' } }
const axis = { tick: { fill: '#5b6474', fontSize: 12, fontWeight: 700 }, axisLine: false, tickLine: false }

function Table({ head, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left">
        <thead><tr className="text-xs font-black tracking-wide text-muted uppercase">{head.map((h) => <th key={h} className="px-3 py-3">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="row-hover">{r.map((c, j) => <td key={j} className={cx('px-3 py-2.5 text-sm font-bold text-ink', j === 0 && 'rounded-l-2xl', j === r.length - 1 && 'rounded-r-2xl')}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

export default function Reports() {
  usePageMeta({ title: 'Reports', description: 'Progress, workload, deadline and contribution reports with PDF, Excel and CSV export.' })
  const { projects, tasks, milestones, users, userById, projectById, exportReport } = useApp()
  const [type, setType] = useState(TYPES[0])
  const [projectId, setProjectId] = useState('')

  const scopeProjects = projects.filter((p) => !p.archived && (!projectId || String(p.id) === String(projectId)))
  const scopeTasks = tasks.filter((t) => scopeProjects.some((p) => p.id === t.projectId))
  const done = scopeTasks.filter((t) => t.status === 'Done')
  const delayed = scopeTasks.filter((t) => t.status !== 'Done' && daysUntil(t.dueDate) < 0)
  const onTime = done.length // done tasks treated as on-time in mock data
  const overall = scopeProjects.length ? Math.round(scopeProjects.reduce((a, p) => a + p.progress, 0) / scopeProjects.length) : 0

  const workload = useMemo(() => users.map((u) => {
    const ut = scopeTasks.filter((t) => t.assignedTo === u.id)
    return { name: u.name.replace('Dr. ', ''), user: u, Todo: ut.filter((t) => t.status === 'Todo').length, 'In Progress': ut.filter((t) => t.status === 'In Progress').length, Review: ut.filter((t) => t.status === 'Review').length, Done: ut.filter((t) => t.status === 'Done').length, total: ut.length, hours: ut.reduce((a, t) => a + (t.actualHours || 0), 0), est: ut.reduce((a, t) => a + (t.estimatedHours || 0), 0) }
  }).filter((w) => w.total), [users, scopeTasks])

  const statusData = ['Todo', 'In Progress', 'Review', 'Done'].map((s) => ({ name: s, value: scopeTasks.filter((t) => t.status === s).length }))
  const statusColors = [C.muted, C.accent, C.sun, C.mint]
  const scopeMilestones = milestones.filter((m) => scopeProjects.some((p) => p.id === m.projectId))
  const upcoming = scopeTasks.filter((t) => t.status !== 'Done' && daysUntil(t.dueDate) >= 0).sort(byDate('dueDate'))


  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Measure progress, workload, deadlines and contribution."
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <Button variant="ghost" icon={Printer} onClick={() => exportReport(REPORT_KEYS[type], 'pdf', projectId)}>PDF</Button>
            <Button variant="ghost" icon={FileSpreadsheet} onClick={() => exportReport(REPORT_KEYS[type], 'xlsx', projectId)}>Excel</Button>
            <Button icon={Download} onClick={() => exportReport(REPORT_KEYS[type], 'csv', projectId)}>CSV</Button>
          </div>
        }
      />

      <Card className="no-print mb-6 flex flex-wrap items-center gap-3 !p-4">
        <Select value={type} onChange={(e) => setType(e.target.value)} options={TYPES} className="!w-auto !py-2.5" aria-label="Report type" />
        <Select aria-label="Filter by project" value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="All projects" options={projects.filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name }))} className="!w-auto !py-2.5" />
        <span className="ml-auto text-xs font-bold text-muted">Generated {fmtDate(new Date())}</span>
      </Card>

      <Stagger fill stagger={0.05} className="mb-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard icon={TrendingUp} label="Overall Progress" value={`${overall}%`} tone="primary" />
        <StatCard icon={ListTodo} label="Total Tasks" value={scopeTasks.length} tone="sky" />
        <StatCard icon={CircleCheck} label="Completed" value={done.length} tone="mint" />
        <StatCard icon={Clock} label="Pending" value={scopeTasks.length - done.length} tone="peach" />
        <StatCard icon={Target} label="On-Time" value={onTime} tone="pink" />
        <StatCard icon={TriangleAlert} label="Delayed" value={delayed.length} tone="rose" />
      </Stagger>

      <h2 className="mb-4 text-xl font-black text-ink">{type}</h2>

      {(type === 'Project Progress' || type === 'Project Completion Report') && (
        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <SectionTitle>Progress by Project</SectionTitle>
            <div className="h-80">
              <ResponsiveContainer>
                <BarChart data={scopeProjects.map((p) => ({ name: p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name, full: p.name, progress: p.progress }))} barSize={28}>
                  <CartesianGrid vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" {...axis} />
                  <YAxis domain={[0, 100]} {...axis} unit="%" />
                  <Tooltip {...tip} labelFormatter={(_, p) => p?.[0]?.payload.full} />
                  <Bar dataKey="progress" radius={[10, 10, 10, 10]}>
                    {scopeProjects.map((p) => <Cell key={p.id} fill={p.progress >= 100 ? C.mint : p.progress < 35 ? C.sun : C.accent} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <SectionTitle>Projects</SectionTitle>
            <div className="flex flex-col gap-4">
              {scopeProjects.map((p) => (
                <div key={p.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2"><span className="truncate text-sm font-extrabold text-ink">{p.name}</span><StatusBadge status={p.status} /></div>
                  <Progress value={p.progress} showLabel />
                  {type === 'Project Completion Report' && <div className="mt-1 text-xs font-bold text-muted">{p.actualCompletionDate ? `Completed ${fmtDate(p.actualCompletionDate)} (deadline ${fmtDate(p.endDate)})` : `Deadline ${fmtDate(p.endDate)}`}</div>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {type === 'Task Completion' && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
          <Card>
            <SectionTitle>Tasks by Status</SectionTitle>
            <div className="h-80">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={4} cornerRadius={8} stroke="none">
                    {statusData.map((d, i) => <Cell key={d.name} fill={statusColors[i]} />)}
                  </Pie>
                  <Tooltip {...tip} />
                  <Legend iconType="circle" wrapperStyle={{ fontWeight: 700, fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <SectionTitle>Estimated vs Actual Hours</SectionTitle>
            <div className="h-80">
              <ResponsiveContainer>
                <BarChart data={scopeProjects.map((p) => { const pt = tasks.filter((t) => t.projectId === p.id); return { name: p.name.length > 14 ? p.name.slice(0, 13) + '…' : p.name, Estimated: pt.reduce((a, t) => a + t.estimatedHours, 0), Actual: pt.reduce((a, t) => a + t.actualHours, 0) } })} barGap={6}>
                  <CartesianGrid vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" {...axis} /><YAxis {...axis} />
                  <Tooltip {...tip} /><Legend iconType="circle" wrapperStyle={{ fontWeight: 700, fontSize: 13 }} />
                  <Bar dataKey="Estimated" fill={C.primary} radius={[8, 8, 8, 8]} barSize={16} />
                  <Bar dataKey="Actual" fill={C.accent} radius={[8, 8, 8, 8]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {(type === 'Team Workload' || type === 'Member Contribution') && (
        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <SectionTitle>{type === 'Team Workload' ? 'Tasks per Member' : 'Hours Contributed'}</SectionTitle>
            <div className="h-80">
              <ResponsiveContainer>
                {type === 'Team Workload' ? (
                  <BarChart data={workload} barSize={26}>
                    <CartesianGrid vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" {...axis} /><YAxis allowDecimals={false} {...axis} />
                    <Tooltip {...tip} /><Legend iconType="circle" wrapperStyle={{ fontWeight: 700, fontSize: 13 }} />
                    <Bar dataKey="Todo" stackId="a" fill={C.muted} />
                    <Bar dataKey="In Progress" stackId="a" fill={C.accent} />
                    <Bar dataKey="Review" stackId="a" fill={C.sun} />
                    <Bar dataKey="Done" stackId="a" fill={C.mint} radius={[8, 8, 0, 0]} />
                  </BarChart>
                ) : (
                  <BarChart data={workload} layout="vertical" barSize={18}>
                    <CartesianGrid horizontal={false} stroke="#e5e7eb" />
                    <XAxis type="number" {...axis} /><YAxis type="category" dataKey="name" width={70} {...axis} />
                    <Tooltip {...tip} />
                    <Bar dataKey="hours" name="Actual hours" fill={C.accent} radius={[0, 10, 10, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <SectionTitle>Members</SectionTitle>
            <div className="flex flex-col gap-3">
              {[...workload].sort((a, b) => b.total - a.total).map((w) => (
                <div key={w.user.id} className="clay-sm flex items-center gap-3 p-3">
                  <Avatar user={w.user} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-sm font-black text-ink"><span>{w.user.name}</span><span className="text-muted">{w.Done}/{w.total}</span></div>
                    <Progress value={Math.round((w.Done / w.total) * 100)} className="mt-1.5" />
                  </div>
                  {type === 'Member Contribution' && <Badge tone="primary">{w.hours}h</Badge>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {type === 'Delayed Tasks' && (
        <Card>
          {delayed.length === 0 ? <p className="py-10 text-center font-bold text-muted">🎉 No delayed tasks.</p> : (
            <Table head={['Task', 'Project', 'Assignee', 'Due', 'Overdue', 'Priority']} rows={delayed.map((t) => [t.title, projectById(t.projectId)?.name, userById(t.assignedTo)?.name, fmtDate(t.dueDate), <Badge key="o" tone="rose">{-daysUntil(t.dueDate)} days</Badge>, <PriorityBadge key="p" priority={t.priority} />])} />
          )}
        </Card>
      )}

      {type === 'Deadline Report' && (
        <Card>
          <Table head={['Task', 'Project', 'Assignee', 'Due', 'Days Left', 'Priority']} rows={upcoming.map((t) => [t.title, projectById(t.projectId)?.name, userById(t.assignedTo)?.name, fmtDate(t.dueDate), <Badge key="d" tone={daysUntil(t.dueDate) <= 3 ? 'peach' : 'sky'}>{daysUntil(t.dueDate)} days</Badge>, <PriorityBadge key="p" priority={t.priority} />])} />
        </Card>
      )}

      {type === 'Milestone Report' && (
        <Card>
          <Table head={['Milestone', 'Project', 'Start', 'Due', 'Progress', 'Status']} rows={scopeMilestones.map((m) => [m.name, projectById(m.projectId)?.name, fmtDate(m.startDate), fmtDate(m.dueDate), <div key="p" className="w-40"><Progress value={m.progress} showLabel /></div>, <StatusBadge key="s" status={milestoneStatus(m)} />])} />
        </Card>
      )}

      <p className="no-print mt-6 flex items-center gap-2 text-xs font-semibold text-muted"><FileText size={14} /> PDF, Excel and CSV files are generated by the server from live data.</p>
    </div>
  )
}
