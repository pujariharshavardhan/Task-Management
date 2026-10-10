import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Flag, GraduationCap, Plus, Trash2, Archive, Upload, UserPlus, Award, Download } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { check, rules } from '../lib/validate'
import { usePageMeta } from '../lib/seo'
import { Avatar, Badge, Button, Card, ConfirmDialog, Empty, Field, IconBlob, Input, Modal, PriorityBadge, Progress, Ring, SectionTitle, Select, Stagger, StatusBadge, TabPanels, Tabs, Textarea } from '../components/ui'
import { KanbanBoard, TaskFormModal } from '../components/TaskBoard'
import { projectAccent } from '../components/ProjectCard'
import { UploadModal, FileIcon } from './Documents'
import { ReviewCard, ReviewFormModal } from './Reviews'
import { PROJECT_STATUSES, ROLES } from '../data/constants'
import { byDate, cx, daysUntil, dueLabel, fmtDate, isAtRisk, milestoneStatus, timeAgo } from '../lib/utils'

const TABS = ['Overview', 'Tasks', 'Milestones', 'Team', 'Files', 'Reviews', 'Activity']

function Info({ label, children }) {
  return (
    <div className="clay-sm p-4">
      <div className="mb-1 text-[11px] font-black tracking-wide text-muted uppercase">{label}</div>
      <div className="text-sm font-extrabold text-ink">{children}</div>
    </div>
  )
}

function Overview({ p }) {
  const { userById, tasks, milestones } = useApp()
  const pt = tasks.filter((t) => t.projectId === p.id)
  const done = pt.filter((t) => t.status === 'Done').length
  const next = milestones.filter((m) => m.projectId === p.id && m.progress < 100).sort(byDate('dueDate'))[0]
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="flex flex-col gap-6 xl:col-span-2">
        <Card>
          <SectionTitle>Description</SectionTitle>
          <p className="text-sm leading-relaxed font-semibold text-ink">{p.description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {p.tech.map((t) => <Badge key={t} tone="primary">{t}</Badge>)}
          </div>
        </Card>
        <Stagger fill stagger={0.05} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Project Owner"><span className="flex items-center gap-2"><Avatar user={userById(p.ownerId)} size={24} />{userById(p.ownerId)?.name}</span></Info>
          <Info label="Start Date">{fmtDate(p.startDate)}</Info>
          <Info label="Deadline">{fmtDate(p.endDate)}</Info>
          <Info label="Priority"><PriorityBadge priority={p.priority} /></Info>
          <Info label="Project Type">{p.type}</Info>
          <Info label="Completed On">{fmtDate(p.actualCompletionDate)}</Info>
        </Stagger>
        <Card>
          <SectionTitle>Academic Details</SectionTitle>
          <Stagger fill stagger={0.05} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Info label="College / University">{p.college || '—'}</Info>
            <Info label="Department">{p.department || '—'}</Info>
            <Info label="Course">{p.course || '—'}</Info>
            <Info label="Academic Year">{p.academicYear || '—'}</Info>
            <Info label="Semester">{p.semester || '—'}</Info>
            <Info label="Batch">{p.batch || '—'}</Info>
          </Stagger>
        </Card>
      </div>
      <div className="flex flex-col gap-6">
        <Card className="flex flex-col items-center gap-4 py-7">
          <Ring value={p.progress} size={150} tone={p.progress >= 100 ? 'mint' : 'accent'} label="complete" />
          <div className="grid w-full grid-cols-3 gap-3 text-center">
            <div className="clay-sm p-3"><div className="text-xl font-black text-ink">{pt.length}</div><div className="text-[11px] font-bold text-muted">Tasks</div></div>
            <div className="clay-sm p-3"><div className="text-xl font-black text-mint">{done}</div><div className="text-[11px] font-bold text-muted">Done</div></div>
            <div className="clay-sm p-3"><div className="text-xl font-black text-rose">{pt.filter((t) => t.status !== 'Done' && daysUntil(t.dueDate) < 0).length}</div><div className="text-[11px] font-bold text-muted">Overdue</div></div>
          </div>
        </Card>
        <Card>
          <SectionTitle>Guide / Mentor</SectionTitle>
          <div className="flex items-center gap-3">
            <IconBlob icon={GraduationCap} tone="sky" />
            <div><div className="font-black text-ink">{userById(p.guideId)?.name || 'Not assigned'}</div><div className="text-xs font-semibold text-muted">{userById(p.guideId)?.email}</div></div>
          </div>
        </Card>
        {next && (
          <Card>
            <SectionTitle>Next Milestone</SectionTitle>
            <div className="font-black text-ink">{next.name}</div>
            <div className="mb-3 text-xs font-bold text-muted">Due {fmtDate(next.dueDate)} · {dueLabel(next.dueDate)}</div>
            <Progress value={next.progress} showLabel />
          </Card>
        )}
      </div>
    </div>
  )
}

function Milestones({ p }) {
  const { milestones, addMilestone, updateMilestone } = useApp()
  const list = milestones.filter((m) => m.projectId === p.id).sort(byDate('startDate'))
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', startDate: '', dueDate: '' })
  const [errors, setErrors] = useState({})
  const save = async (e) => {
    e.preventDefault()
    const errs = check(form, {
      name: [rules.required('Milestone name'), rules.max(200, 'Milestone name')],
      startDate: [rules.required('Start date')],
      dueDate: [rules.required('Due date'), rules.after('startDate', 'Due date', 'Start date')],
    })
    setErrors(errs)
    if (Object.keys(errs).length) return
    if (!(await addMilestone({ ...form, projectId: p.id }))) return
    setForm({ name: '', description: '', startDate: '', dueDate: '' })
    setOpen(false)
  }
  return (
    <Card>
      <SectionTitle action={<Button icon={Plus} size="sm" onClick={() => setOpen(true)}>Add Milestone</Button>}>Milestones</SectionTitle>
      {list.length === 0 ? <Empty icon={Flag} title="No milestones yet" text="Break the project into phases like Design, Development and Testing." /> : (
        <Stagger stagger={0.08} className="relative flex flex-col gap-5 pl-2">
          <div className="absolute top-4 bottom-4 left-[29px] w-1 rounded-full bg-line" />
          {list.map((m) => {
            const status = milestoneStatus(m)
            const tone = status === 'Completed' ? 'mint' : status === 'In Progress' ? 'accent' : 'muted'
            return (
              <div key={m.id} className="relative flex gap-5">
                <IconBlob icon={Flag} tone={tone} size={44} />
                <div className="clay-sm flex-1 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-black text-ink">{m.name}</div>
                    <StatusBadge status={status} />
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-muted">{m.description}</p>
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-muted"><CalendarDays size={13} /> {fmtDate(m.startDate, { month: 'short', day: 'numeric' })} → {fmtDate(m.dueDate)}</div>
                  <div className="mt-3 flex items-center gap-3">
                    <Progress value={m.progress} className="flex-1" showLabel />
                    <input type="range" min="0" max="100" step="5" value={m.progress} onChange={(e) => updateMilestone(m.id, { progress: Number(e.target.value) })} className="w-28 accent-[var(--color-accent)]" aria-label="Update progress" />
                  </div>
                </div>
              </div>
            )
          })}
        </Stagger>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add Milestone">
        <form onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="Milestone Name" required error={errors.name} className="sm:col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Backend Development" /></Field>
          <Field label="Description" className="sm:col-span-2"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Start Date" required error={errors.startDate}><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
          <Field label="Due Date" required error={errors.dueDate}><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          <div className="flex justify-end gap-3 sm:col-span-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Save</Button></div>
        </form>
      </Modal>
    </Card>
  )
}

function Team({ p }) {
  const { users, userById, tasks, addMember, removeMember } = useApp()
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState({ userId: '', role: 'Developer' })
  const [confirm, setConfirm] = useState(null)
  return (
    <Card>
      <SectionTitle action={<Button icon={UserPlus} size="sm" onClick={() => setOpen(true)}>Add Member</Button>}>Team ({p.members.length})</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left">
          <thead><tr className="text-xs font-black tracking-wide text-muted uppercase">{['Name', 'Role', 'Tasks', 'Progress', ''].map((h) => <th key={h} className="px-3 pb-3">{h}</th>)}</tr></thead>
          <tbody>
            {p.members.map((m) => {
              const u = userById(m.userId)
              const mt = tasks.filter((t) => t.projectId === p.id && t.assignedTo === m.userId)
              const done = mt.filter((t) => t.status === 'Done').length
              const role = ROLES.find((r) => r.name === m.role)
              return (
                <tr key={m.userId} className="row-hover">
                  <td className="rounded-l-2xl px-3 py-3"><div className="flex items-center gap-3"><Avatar user={u} size={36} /><div><div className="text-sm font-black text-ink">{u?.name}</div><div className="text-xs font-semibold text-muted">{u?.title}</div></div></div></td>
                  <td className="px-3 py-3"><Badge tone={role?.tone || 'muted'}>{m.role}</Badge></td>
                  <td className="px-3 py-3 text-sm font-extrabold text-ink">{done}/{mt.length}</td>
                  <td className="w-48 px-3 py-3"><Progress value={mt.length ? Math.round((done / mt.length) * 100) : 0} showLabel /></td>
                  <td className="rounded-r-2xl px-3 py-3 text-right">
                    {m.userId !== p.ownerId && <button onClick={() => setConfirm(m)} className="cursor-pointer p-2 text-muted hover:text-rose" aria-label="Remove member"><Trash2 size={16} /></button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Add Member"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!pick.userId} onClick={async () => { if (await addMember(p.id, pick.userId, pick.role)) { setOpen(false); setPick({ userId: '', role: 'Developer' }) } }}>Add</Button></>}>
        <div className="flex flex-col gap-4">
          <Field label="Person"><Select value={pick.userId} onChange={(e) => setPick({ ...pick, userId: e.target.value })} placeholder="Select person" options={users.filter((u) => !p.members.some((m) => m.userId === u.id)).map((u) => ({ value: u.id, label: `${u.name} — ${u.title}` }))} /></Field>
          <Field label="Role"><Select value={pick.role} onChange={(e) => setPick({ ...pick, role: e.target.value })} options={ROLES.map((r) => r.name)} /></Field>
        </div>
      </Modal>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} title="Remove member?" confirmLabel="Remove"
        message={`${userById(confirm?.userId)?.name} will lose access to this project.`} onConfirm={() => removeMember(p.id, confirm.userId)} />
    </Card>
  )
}

function Files({ p }) {
  const { documents, userById, downloadDocument, deleteDocument } = useApp()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const list = documents.filter((d) => d.projectId === p.id)
  return (
    <Card>
      <SectionTitle action={<Button icon={Upload} size="sm" onClick={() => setOpen(true)}>Upload</Button>}>Files ({list.length})</SectionTitle>
      {list.length === 0 ? <Empty title="No files yet" text="Upload SRS, diagrams, reports and presentations." /> : (
        <Stagger fill stagger={0.05} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((d) => (
            <div key={d.id} className="clay-sm flex items-center gap-3 p-4">
              <FileIcon type={d.type} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black text-ink">{d.name}</div>
                <div className="text-xs font-semibold text-muted">{d.folder} · v{d.version} · {d.size}</div>
                <div className="text-[11px] font-semibold text-muted">{userById(d.uploadedBy)?.name} · {fmtDate(d.uploadedAt)}</div>
              </div>
              <button onClick={() => downloadDocument(d)} className="cursor-pointer p-2 text-muted hover:text-accent" aria-label="Download"><Download size={17} /></button>
              <button onClick={() => setConfirm(d)} className="cursor-pointer p-2 text-muted hover:text-rose" aria-label="Delete"><Trash2 size={17} /></button>
            </div>
          ))}
        </Stagger>
      )}
      <UploadModal open={open} onClose={() => setOpen(false)} projectId={p.id} />
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} title="Delete document?" message={`“${confirm?.name}” will be permanently deleted.`} onConfirm={() => deleteDocument(confirm.id)} />
    </Card>
  )
}

function Reviews({ p }) {
  const { reviews } = useApp()
  const [open, setOpen] = useState(false)
  const list = reviews.filter((r) => r.projectId === p.id)
  return (
    <div>
      <SectionTitle action={<Button icon={Plus} size="sm" onClick={() => setOpen(true)}>Add Review</Button>}>Academic Reviews</SectionTitle>
      {list.length === 0 ? <Card><Empty icon={Award} title="No reviews yet" text="Mentor reviews and scores will appear here." /></Card> : (
        <Stagger fill className="grid gap-6 lg:grid-cols-2">{list.map((r) => <ReviewCard key={r.id} review={r} hideProject />)}</Stagger>
      )}
      <ReviewFormModal open={open} onClose={() => setOpen(false)} projectId={p.id} />
    </div>
  )
}

function Activity({ p }) {
  const { activities, userById } = useApp()
  const list = activities.filter((a) => a.projectId === p.id)
  return (
    <Card>
      <SectionTitle>Activity Timeline</SectionTitle>
      {list.length === 0 ? <Empty title="No activity yet" /> : (
        <Stagger stagger={0.05} className="relative flex flex-col gap-2">
          <div className="absolute top-3 bottom-3 left-[21px] w-0.5 bg-line" />
          {list.map((a) => {
            const u = userById(a.userId)
            return (
              <div key={a.id} className="relative flex items-center gap-4 p-1">
                <Avatar user={u} size={42} className="ring-4 ring-surface" />
                <div className="clay-sm flex-1 px-4 py-3">
                  <div className="text-sm font-semibold text-muted"><span className="font-black text-ink">{u?.name}</span> {a.action} <span className="font-extrabold text-ink">{a.object}</span></div>
                  <div className="text-xs font-bold text-muted">{fmtDate(a.at)} · {timeAgo(a.at)}</div>
                </div>
              </div>
            )
          })}
        </Stagger>
      )}
    </Card>
  )
}

export default function ProjectDetails() {
  const { projectId } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { projectById, tasks, updateProject, deleteProject, toast } = useApp()
  const [taskModal, setTaskModal] = useState(null)
  const [confirm, setConfirm] = useState(false)
  const tab = params.get('tab') || 'Overview'
  const p = projectById(projectId)
  usePageMeta({ title: p ? `${p.name} (${p.code})` : 'Project', description: p ? p.description.slice(0, 155) : 'Project details' })

  if (!p) return <Card><Empty title="Project not found" action={<Link to="/projects" className="btn-ghost">Back to projects</Link>} /></Card>

  const accent = projectAccent(p)

  return (
    <div>
      <Link to="/projects" className="mb-2 -ml-2 inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-extrabold text-muted hover:text-accent"><ArrowLeft size={16} /> Projects</Link>

      <Card className="mb-6 !p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <span className={cx('clay-tone grid h-16 w-16 shrink-0 place-items-center !rounded-3xl text-2xl font-black', `tone-${accent}`)}>{p.name[0]}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-ink">{p.name}</h1>
              {isAtRisk(p) && <Badge tone="rose">At Risk</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-bold text-muted">
              <span>{p.code}</span><span>{p.type}</span>
              <span className="flex items-center gap-1"><CalendarDays size={14} /> {fmtDate(p.endDate)} · {dueLabel(p.endDate)}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={p.status} options={PROJECT_STATUSES} onChange={async (e) => { const v = e.target.value; if (await updateProject(p.id, { status: v })) toast(`Status set to ${v}`) }} className="!w-40 !py-2.5" aria-label="Project status" />
            <Button variant="ghost" icon={Archive} onClick={async () => { if (await updateProject(p.id, { archived: !p.archived })) toast(p.archived ? 'Project restored' : 'Project archived', 'sky') }}>{p.archived ? 'Restore' : 'Archive'}</Button>
            <Button variant="ghost" icon={Trash2} className="!text-rose" onClick={() => setConfirm(true)} aria-label="Delete project" />
          </div>
        </div>
        <div className="mt-6 flex items-center gap-4">
          <span className="text-xs font-black tracking-wide text-muted uppercase">Overall Progress</span>
          <Progress value={p.progress} className="flex-1" showLabel />
        </div>
      </Card>

      <Tabs tabs={TABS} active={tab} onChange={(t) => setParams({ tab: t })} className="mb-6" />

      <TabPanels index={TABS.indexOf(tab)}>
        <Overview p={p} />
        <div>
          <SectionTitle action={<Button icon={Plus} size="sm" onClick={() => setTaskModal({ status: 'Todo' })}>New Task</Button>}>Task Board</SectionTitle>
          <KanbanBoard tasks={tasks.filter((t) => t.projectId === p.id)} showProject={false} onNewTask={(status) => setTaskModal({ status })} />
        </div>
        <Milestones p={p} />
        <Team p={p} />
        <Files p={p} />
        <Reviews p={p} />
        <Activity p={p} />
      </TabPanels>

      <TaskFormModal open={!!taskModal} onClose={() => setTaskModal(null)} defaults={{ projectId: p.id, status: taskModal?.status }} />
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Delete project?"
        message={`“${p.name}” and all of its tasks will be permanently deleted. This cannot be undone.`}
        onConfirm={async () => { if (await deleteProject(p.id)) { toast('Project deleted', 'rose'); navigate('/projects') } }} />
    </div>
  )
}
