import { useMemo, useState } from 'react'
import { UserPlus, Search, Shield, Check, Mail } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { check, rules } from '../lib/validate'
import { usePageMeta } from '../lib/seo'
import { Avatar, Badge, Button, Card, Field, Input, Modal, PageHeader, Progress, SectionTitle, Select, Stagger, TabPanels, Tabs } from '../components/ui'
import { PERMISSIONS, ROLES } from '../data/constants'

export default function Team() {
  usePageMeta({ title: 'Team', description: 'People across your projects, their roles, workload and permissions.' })
  const { me, users, projects, tasks, inviteUser } = useApp()
  const [invited, setInvited] = useState(null)
  const [tab, setTab] = useState('Members')
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', title: '', projectId: '', role: 'Student' })

  const rows = useMemo(() => users.filter((u) => u.id === me.id || projects.some((p) => p.ownerId === u.id || p.guideId === u.id || p.members.some((m) => m.userId === u.id))).map((u) => {
    const ut = tasks.filter((t) => t.assignedTo === u.id)
    const done = ut.filter((t) => t.status === 'Done').length
    const memberOf = projects.filter((p) => p.members.some((m) => m.userId === u.id) && !p.archived)
    const roles = [...new Set(projects.flatMap((p) => p.members.filter((m) => m.userId === u.id).map((m) => m.role)))]
    return { u, total: ut.length, done, open: ut.length - done, memberOf, roles: roles.length ? roles : [u.role] }
  }).filter((r) => (!q || (r.u.name + r.u.email).toLowerCase().includes(q.toLowerCase())) && (!role || r.roles.includes(role))), [users, tasks, projects, q, role, me.id])

  const [errors, setErrors] = useState({})
  const invite = async (e) => {
    e.preventDefault()
    const errs = check(form, { name: [rules.required('Name'), rules.max(120, 'Name')], email: [rules.required('Email'), rules.email()] })
    setErrors(errs)
    if (Object.keys(errs).length) return
    const res = await inviteUser({ name: form.name, email: form.email, title: form.title || form.role, role: form.role, projectId: form.projectId, projectRole: form.role })
    if (!res) return
    setInvited({ name: res.user.name, email: res.user.email, password: res.temporaryPassword })
    setForm({ name: '', email: '', title: '', projectId: '', role: 'Student' })
    setOpen(false)
  }

  return (
    <div>
      <PageHeader title="Team" subtitle={`${users.length} people across your projects`} actions={<Button icon={UserPlus} onClick={() => setOpen(true)}>Invite Member</Button>} />
      <Tabs tabs={['Members', 'Roles & Permissions']} active={tab} onChange={setTab} className="mb-6" />

      <TabPanels index={tab === 'Members' ? 0 : 1}>
        <>
          <Stagger fill className="mb-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {[...rows].sort((a, b) => b.open - a.open).slice(0, 4).map(({ u, open: o, total }) => (
              <Card key={u.id} className="flex items-center gap-4">
                <Avatar user={u} size={52} />
                <div className="min-w-0">
                  <div className="truncate font-black text-ink">{u.name}</div>
                  <div className="truncate text-xs font-bold text-muted">{u.title}</div>
                  <div className="mt-1 text-xs font-extrabold text-accent">{o} open · {total} total</div>
                </div>
              </Card>
            ))}
          </Stagger>
          <Card className="!p-4">
            <div className="mb-4 flex flex-wrap gap-3">
              <div className="relative min-w-52 flex-1">
                <Search size={16} className="pointer-events-none absolute top-1/2 left-4 z-10 -translate-y-1/2 text-muted" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" className="!py-2.5 pl-10" />
              </div>
              <Select aria-label="Filter by role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="All roles" options={ROLES.map((r) => r.name)} className="!w-auto !py-2.5" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead><tr className="text-xs font-black tracking-wide text-muted uppercase">{['Name', 'Role', 'Projects', 'Tasks', 'Progress'].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}</tr></thead>
                <tbody>
                  {rows.map(({ u, total, done, memberOf, roles }) => (
                    <tr key={u.id} className="row-hover">
                      <td className="rounded-l-2xl px-3 py-3"><div className="flex items-center gap-3"><Avatar user={u} size={38} /><div><div className="text-sm font-black text-ink">{u.name}</div><div className="flex items-center gap-1 text-xs font-semibold text-muted"><Mail size={11} />{u.email}</div></div></div></td>
                      <td className="px-3 py-3"><div className="flex flex-wrap gap-1.5">{roles.map((r) => <Badge key={r} tone={ROLES.find((x) => x.name === r)?.tone || 'muted'}>{r}</Badge>)}</div></td>
                      <td className="px-3 py-3 text-sm font-bold text-muted">{memberOf.length ? memberOf.map((p) => p.code).join(', ') : '—'}</td>
                      <td className="px-3 py-3 text-sm font-extrabold text-ink">{done}/{total}</td>
                      <td className="w-48 rounded-r-2xl px-3 py-3"><Progress value={total ? Math.round((done / total) * 100) : 0} showLabel /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
        <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <Card>
            <SectionTitle>Roles</SectionTitle>
            <Stagger stagger={0.04} className="flex flex-col gap-3">
              {ROLES.map((r) => (
                <div key={r.name} className="clay-sm flex items-center gap-3 p-3.5">
                  <span className={`clay-tone tone-${r.tone} grid h-10 w-10 shrink-0 place-items-center`}><Shield size={18} /></span>
                  <div><div className="text-sm font-black text-ink">{r.name}</div><div className="text-xs font-semibold text-muted">{r.description}</div></div>
                </div>
              ))}
            </Stagger>
          </Card>
          <Card>
            <SectionTitle>Permission Matrix</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead><tr className="text-xs font-black tracking-wide text-muted uppercase"><th className="px-3 py-3">Permission</th>{Object.keys(PERMISSIONS).map((k) => <th key={k} className="px-3 py-3 text-center">{k}</th>)}</tr></thead>
                <tbody>
                  {[...new Set(Object.values(PERMISSIONS).flat())].map((perm) => (
                    <tr key={perm} className="row-hover">
                      <td className="rounded-l-2xl px-3 py-2.5 text-sm font-bold text-ink">{perm}</td>
                      {Object.entries(PERMISSIONS).map(([k, list], i, arr) => (
                        <td key={k} className={`px-3 py-2.5 text-center ${i === arr.length - 1 ? 'rounded-r-2xl' : ''}`}>
                          {k === 'Owner' || list.includes(perm) ? <span className="clay-tone tone-mint inline-grid h-6 w-6 place-items-center !rounded-full"><Check size={13} strokeWidth={3} /></span> : <span className="text-line">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </TabPanels>

      <Modal open={open} onClose={() => setOpen(false)} title="Invite Member">
        <form onSubmit={invite} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={errors.name}><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email" required error={errors.email}><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Title" className="sm:col-span-2"><Input placeholder="e.g. Backend Developer" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Add to Project"><Select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} placeholder="None" options={projects.filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name }))} /></Field>
          <Field label="Role"><Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={ROLES.map((r) => r.name)} /></Field>
          <div className="flex justify-end gap-3 sm:col-span-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" icon={UserPlus}>Send Invite</Button></div>
        </form>
      </Modal>

      <Modal open={!!invited} onClose={() => setInvited(null)} title="Member added" width="max-w-md"
        footer={<Button onClick={() => setInvited(null)}>Done</Button>}>
        {invited?.password ? (
          <div className="flex flex-col gap-3 text-sm font-semibold text-muted">
            <p>An account was created for <b className="text-ink">{invited.name}</b>. Share these sign-in details with them — the password is shown only once.</p>
            <div className="clay-inset flex flex-col gap-1 p-4 font-mono text-ink">
              <span>Email: {invited.email}</span>
              <span>Password: {invited.password}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm font-semibold text-muted"><b className="text-ink">{invited?.name}</b> already had an account and now has access.</p>
        )}
      </Modal>
    </div>
  )
}
