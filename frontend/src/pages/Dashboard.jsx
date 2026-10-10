import { Link } from 'react-router-dom'
import { FolderKanban, FolderPlus, Plus, Rocket, ListTodo, CircleCheck, ArrowRight, TriangleAlert } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useApp } from '../context/AppContext'
import { usePageMeta } from '../lib/seo'
import { AnimatedText, Avatar, Badge, Card, IconBlob, PriorityBadge, Progress, SectionTitle, Stagger, StatCard, StatusBadge } from '../components/ui'
import { projectAccent } from '../components/ProjectCard'
import { byDate, cx, daysUntil, dueLabel, fmtDate, greeting, isActive, isAtRisk, timeAgo } from '../lib/utils'

const STATUS_COLORS = { Todo: '#94a3b8', 'In Progress': '#0047ab', Review: '#b45309', Done: '#15803d' }

export default function Dashboard() {
  usePageMeta({ title: 'Dashboard', description: 'Overview of your academic projects: progress, upcoming deadlines and recent team activity.' })
  const { me, projects, tasks, activities, userById, projectById } = useApp()
  const visible = projects.filter((p) => !p.archived)
  const active = visible.filter(isActive)
  const completed = projects.filter((p) => p.status === 'Completed')
  const pending = tasks.filter((t) => t.status !== 'Done')
  const upcoming = [...pending].filter((t) => t.dueDate).sort(byDate('dueDate')).slice(0, 6)
  const byStatus = Object.keys(STATUS_COLORS).map((s) => ({ name: s, value: tasks.filter((t) => t.status === s).length }))
  const overdue = pending.filter((t) => daysUntil(t.dueDate) < 0).length

  return (
    <Stagger stagger={0.1} className="flex flex-col gap-6">
      <div className="clay tone-primary relative overflow-hidden p-6 sm:p-8">
        <div className="clay-tone tone-accent absolute -top-10 -right-10 hidden h-40 w-40 sm:block !rounded-full opacity-90" />
        <div className="clay-tone tone-primary absolute right-28 -bottom-8 hidden h-20 w-20 !rounded-[28px] sm:block" />
        <div className="relative max-w-xl">
          <AnimatedText as="h1" className="text-2xl font-black text-ink sm:text-3xl">{`${greeting()}, ${me.name} 👋`}</AnimatedText>
          <AnimatedText as="p" preset="fade" delay={0.35} className="mt-1 font-semibold text-muted">Here's what's happening with your projects.</AnimatedText>
          {overdue > 0 && (
            <Badge tone="rose" className="mt-4"><TriangleAlert size={13} /> {overdue} overdue task{overdue > 1 ? 's' : ''} {overdue > 1 ? 'need' : 'needs'} attention</Badge>
          )}
        </div>
      </div>

      <Stagger fill delay={0.15} className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FolderKanban} label="Total Projects" value={projects.length} tone="primary" hint={`${projects.filter((p) => p.archived).length} archived`} />
        <StatCard icon={Rocket} label="Active Projects" value={active.length} tone="sky" hint={`${active.filter(isAtRisk).length} at risk`} />
        <StatCard icon={ListTodo} label="Pending Tasks" value={pending.length} tone="peach" hint={`${overdue} overdue`} />
        <StatCard icon={CircleCheck} label="Completed Projects" value={completed.length} tone="mint" hint="All time" />
      </Stagger>

      {projects.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 py-14 text-center">
          <IconBlob icon={FolderPlus} tone="accent" size={72} />
          <h2 className="text-2xl font-black text-ink">Create your first project</h2>
          <p className="max-w-md text-sm font-semibold text-muted">Projects hold your tasks, milestones, team, documents and reviews. Everything you add is saved to your database.</p>
          <Link to="/projects/new" className="btn-tone tone-primary mt-2"><Plus size={17} strokeWidth={2.4} /> New Project</Link>
        </Card>
      ) : (
      <>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle action={<Link to="/projects?filter=active" className="-my-1.5 flex items-center gap-1 rounded-lg px-1 py-1.5 text-sm font-extrabold text-accent">View all <ArrowRight size={15} /></Link>}>Active Projects</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="text-xs font-black tracking-wide text-muted uppercase">
                  <th className="px-3 pb-3">Project</th><th className="px-3 pb-3">Owner</th><th className="px-3 pb-3">Progress</th><th className="px-3 pb-3">Deadline</th><th className="px-3 pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {active.slice(0, 6).map((p) => {
                  const owner = userById(p.ownerId)
                  return (
                    <tr key={p.id} className="row-hover">
                      <td className="rounded-l-2xl px-3 py-3">
                        <Link to={`/projects/${p.id}`} className="flex items-center gap-3">
                          <span className={cx('clay-tone grid h-9 w-9 shrink-0 place-items-center !rounded-xl text-sm font-black', `tone-${projectAccent(p)}`)}>{p.name[0]}</span>
                          <div className="min-w-0 max-w-52">
                            <div className="truncate text-sm font-extrabold text-ink" title={p.name}>{p.name}</div>
                            <div className="text-[11px] font-bold text-muted">{p.code}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-3"><Avatar user={owner} size={30} /></td>
                      <td className="w-40 px-3 py-3"><Progress value={p.progress} showLabel /></td>
                      <td className="px-3 py-3">
                        <div className="text-sm font-bold text-ink">{fmtDate(p.endDate, { month: 'short', day: 'numeric' })}</div>
                        <div className={cx('text-[11px] font-bold', daysUntil(p.endDate) < 7 ? 'text-rose' : 'text-muted')}>{dueLabel(p.endDate)}</div>
                      </td>
                      <td className="rounded-r-2xl px-3 py-3"><StatusBadge status={isAtRisk(p) ? 'At Risk' : p.status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <SectionTitle>Task Overview</SectionTitle>
          <div className="relative h-52">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byStatus} dataKey="value" innerRadius={62} outerRadius={88} paddingAngle={4} cornerRadius={8} stroke="none">
                  {byStatus.map((d) => <Cell key={d.name} fill={STATUS_COLORS[d.name]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 16, border: 'none', boxShadow: '0 8px 24px rgba(17,24,39,.12)', fontWeight: 700 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div><div className="text-3xl font-black text-ink">{tasks.length}</div><div className="text-xs font-bold text-muted">tasks</div></div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {byStatus.map((d) => (
              <div key={d.name} className="clay-sm flex items-center gap-2.5 px-3 py-2.5">
                <span className="h-3 w-3 rounded-full" style={{ background: STATUS_COLORS[d.name] }} />
                <span className="flex-1 text-xs font-bold text-muted">{d.name}</span>
                <span className="text-sm font-black text-ink">{d.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <SectionTitle action={<Link to="/calendar" className="-my-1.5 flex items-center gap-1 rounded-lg px-1 py-1.5 text-sm font-extrabold text-accent">Calendar <ArrowRight size={15} /></Link>}>Upcoming Deadlines</SectionTitle>
          <Stagger stagger={0.05} delay={0.3} className="flex flex-col gap-3">
            {upcoming.map((t) => {
              const d = new Date(t.dueDate + 'T00:00:00')
              const n = daysUntil(t.dueDate)
              return (
                <Link key={t.id} to={`/tasks?task=${t.id}`} className="row-hover flex items-center gap-4 rounded-2xl p-2">
                  <div className={cx('clay-soft grid h-14 w-14 shrink-0 place-items-center text-center leading-none', n < 0 ? 'tone-rose' : n <= 2 ? 'tone-peach' : 'tone-primary')}>
                    <div><div className="text-[10px] font-black uppercase">{d.toLocaleString('en-US', { month: 'short' })}</div><div className="text-xl font-black">{d.getDate()}</div></div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-extrabold text-ink">{t.title}</div>
                    <div className="truncate text-xs font-bold text-muted">{projectById(t.projectId)?.name}</div>
                  </div>
                  <Avatar user={userById(t.assignedTo)} size={30} />
                  <div className="hidden w-24 text-right sm:block">
                    <PriorityBadge priority={t.priority} />
                    <div className={cx('mt-1 text-[11px] font-bold', n < 0 ? 'text-rose' : 'text-muted')}>{dueLabel(t.dueDate)}</div>
                  </div>
                </Link>
              )
            })}
          </Stagger>
        </Card>

        <Card>
          <SectionTitle>Recent Activity</SectionTitle>
          <Stagger stagger={0.05} delay={0.3} className="relative flex flex-col gap-1">
            <div className="absolute top-3 bottom-3 left-[19px] w-0.5 rounded bg-line" />
            {activities.slice(0, 7).map((a) => {
              const u = userById(a.userId)
              return (
                <div key={a.id} className="relative flex items-start gap-4 p-1.5">
                  <Avatar user={u} size={38} className="ring-4 ring-surface" />
                  <div className="min-w-0 flex-1 pt-1">
                    <div className="text-sm font-semibold text-muted">
                      <span className="font-black text-ink">{u?.name}</span> {a.action} <span className="font-extrabold text-ink">{a.object}</span>
                    </div>
                    <div className="text-xs font-bold text-muted">{projectById(a.projectId)?.name} · {timeAgo(a.at)}</div>
                  </div>
                </div>
              )
            })}
          </Stagger>
        </Card>
      </div>
      </>
      )}
    </Stagger>
  )
}
