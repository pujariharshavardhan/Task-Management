import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { ArrowLeft, FileText, GraduationCap, CalendarDays, Settings2, Cpu, Users, Plus, Trash2, Check } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { usePageMeta } from '../lib/seo'
import { Avatar, Button, Card, Chip, Field, IconBlob, Input, PageHeader, Reveal, Select, Textarea } from '../components/ui'
import { PRIORITIES, PROJECT_STATUSES, PROJECT_TYPES, ROLES, TECH_OPTIONS } from '../data/constants'

const Section = ({ icon, tone, title, subtitle, children }) => (
  <Reveal>
  <Card className="!p-6">
    <div className="mb-5 flex items-center gap-3">
      <IconBlob icon={icon} tone={tone} size={42} />
      <div>
        <h2 className="text-lg font-black text-ink">{title}</h2>
        {subtitle && <p className="text-xs font-semibold text-muted">{subtitle}</p>}
      </div>
    </div>
    {children}
  </Card>
  </Reveal>
)

export default function CreateProject() {
  usePageMeta({ title: 'Create Project', description: 'Set up a new academic project with its timeline, technology stack and team.' })
  const { me, users, addProject, toast } = useApp()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { name: '', code: '', type: '', description: '', college: '', department: '', academicYear: '', semester: '', batch: '', course: '', guideId: '', startDate: '', endDate: '', actualCompletionDate: '', priority: 'Medium', status: 'Planning' },
  })
  const [tech, setTech] = useState(['Python', 'FastAPI', 'React', 'PostgreSQL'])
  const [members, setMembers] = useState([{ userId: me.id, role: 'Project Manager' }])
  const [pick, setPick] = useState({ userId: '', role: 'Developer' })

  const toggleTech = (t) => setTech((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))
  const addMemberRow = () => {
    if (!pick.userId || members.some((m) => m.userId === pick.userId)) return
    setMembers([...members, pick])
    setPick({ userId: '', role: 'Developer' })
  }

  const submit = async (d) => {
    const id = await addProject({ ...d, guideId: d.guideId ? Number(d.guideId) : null, tech, members, actualCompletionDate: d.actualCompletionDate || null })
    if (!id) return
    toast('Project created 🎉')
    navigate(`/projects/${id}`)
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="mx-auto max-w-5xl">
      <button type="button" onClick={() => navigate(-1)} className="mb-2 -ml-2 flex cursor-pointer items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-extrabold text-muted hover:text-accent"><ArrowLeft size={16} aria-hidden="true" /> Back</button>
      <PageHeader
        title="Create Project"
        subtitle="Set up a new academic project, its timeline and team."
        actions={<><Button type="button" variant="ghost" onClick={() => navigate('/projects')}>Cancel</Button><Button type="submit" icon={Check}>Create Project</Button></>}
      />

      <div className="flex flex-col gap-6">
        <Section icon={FileText} tone="primary" title="Basic Information" subtitle="What is this project about?">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Project Name" required error={errors.name?.message} className="md:col-span-2">
              <Input placeholder="AI-Based Academic Management System" {...register('name', { required: 'Project name is required', maxLength: { value: 200, message: 'Project name must be 200 characters or fewer' } })} />
            </Field>
            <Field label="Project Code" error={errors.code?.message} hint="Leave empty to auto-generate (e.g. APMS-2026-001)">
              <Input placeholder="Auto-generated" {...register('code', { maxLength: { value: 40, message: 'Project code must be 40 characters or fewer' } })} />
            </Field>
            <Field label="Project Type" required error={errors.type?.message}>
              <Select placeholder="Select type" options={PROJECT_TYPES} {...register('type', { required: 'Choose a project type' })} />
            </Field>
            <Field label="Project Description" required error={errors.description?.message} className="md:col-span-2">
              <Textarea rows={4} placeholder="Describe goals, scope and expected outcomes…" {...register('description', { required: 'Description is required' })} />
            </Field>
          </div>
        </Section>

        <Section icon={GraduationCap} tone="sky" title="Academic Information" subtitle="Institution and course details">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="College / University" className="md:col-span-2"><Input placeholder="JNTU Hyderabad" {...register('college')} /></Field>
            <Field label="Department"><Input placeholder="CSE" {...register('department')} /></Field>
            <Field label="Academic Year"><Input placeholder="2026-27" {...register('academicYear')} /></Field>
            <Field label="Semester"><Select placeholder="Select" options={['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']} {...register('semester')} /></Field>
            <Field label="Batch"><Input placeholder="2023-2027" {...register('batch')} /></Field>
            <Field label="Course"><Input placeholder="B.Tech" {...register('course')} /></Field>
            <Field label="Guide / Mentor" className="md:col-span-2">
              <Select placeholder="Select guide" options={users.filter((u) => u.id !== me.id).map((u) => ({ value: u.id, label: `${u.name}${u.role === 'Mentor' ? ' (Mentor)' : ''}` }))} {...register('guideId')} />
            </Field>
          </div>
        </Section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section icon={CalendarDays} tone="mint" title="Dates" subtitle="Project timeline">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start Date" required error={errors.startDate?.message}><Input type="date" {...register('startDate', { required: 'Required' })} /></Field>
              <Field label="Expected End Date" required error={errors.endDate?.message}><Input type="date" {...register('endDate', { required: 'Required', validate: (v, all) => !all.startDate || v >= all.startDate || 'End date must be on or after the start date' })} /></Field>
              <Field label="Actual Completion Date" hint="Fill in when the project is done" className="sm:col-span-2"><Input type="date" {...register('actualCompletionDate')} /></Field>
            </div>
          </Section>
          <Section icon={Settings2} tone="peach" title="Management" subtitle="Priority and current status">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Priority"><Select options={PRIORITIES} {...register('priority')} /></Field>
              <Field label="Status"><Select options={PROJECT_STATUSES} {...register('status')} /></Field>
            </div>
          </Section>
        </div>

        <Section icon={Cpu} tone="pink" title="Technology Stack" subtitle={`${tech.length} selected`}>
          <div className="flex flex-wrap gap-2.5">
            {TECH_OPTIONS.map((t) => <Chip key={t} active={tech.includes(t)} onClick={() => toggleTech(t)}>{t}</Chip>)}
          </div>
        </Section>

        <Section icon={Users} tone="sun" title="Team" subtitle="Add members and their roles">
          <div className="mb-5 flex flex-col gap-3">
            {members.map((m) => {
              const u = users.find((x) => x.id === m.userId)
              return (
                <div key={m.userId} className="clay-sm flex items-center gap-3 p-3">
                  <Avatar user={u} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black text-ink">{u?.name}</div>
                    <div className="text-xs font-semibold text-muted">{u?.email}</div>
                  </div>
                  <Select value={m.role} options={ROLES.map((r) => r.name)} onChange={(e) => setMembers(members.map((x) => (x.userId === m.userId ? { ...x, role: e.target.value } : x)))} className="!w-44 !py-2" />
                  <button type="button" disabled={m.userId === me.id} onClick={() => setMembers(members.filter((x) => x.userId !== m.userId))} className="cursor-pointer p-2 text-muted hover:text-rose disabled:opacity-30" aria-label="Remove member"><Trash2 size={17} /></button>
                </div>
              )
            })}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select shellClassName="flex-1" value={pick.userId} onChange={(e) => setPick({ ...pick, userId: e.target.value })} placeholder="Select person" options={users.filter((u) => !members.some((m) => m.userId === u.id)).map((u) => ({ value: u.id, label: `${u.name} — ${u.title}` }))} />
            <Select value={pick.role} onChange={(e) => setPick({ ...pick, role: e.target.value })} options={ROLES.map((r) => r.name)} className="sm:!w-52" />
            <Button type="button" variant="ghost" icon={Plus} onClick={addMemberRow} className="shrink-0">Add Member</Button>
          </div>
        </Section>

        <div className="flex justify-end gap-3 pb-4">
          <Button type="button" variant="ghost" onClick={() => navigate('/projects')}>Cancel</Button>
          <Button type="submit" icon={Check} className="!px-6">Create Project</Button>
        </div>
      </div>
    </form>
  )
}
