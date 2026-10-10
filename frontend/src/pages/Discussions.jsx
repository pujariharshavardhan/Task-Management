import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { AnimatedBackground } from '../components/motion-primitives/animated-background'
import { Plus, Send, MessagesSquare, ArrowLeft } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { check, rules } from '../lib/validate'
import { usePageMeta } from '../lib/seo'
import { Avatar, AvatarStack, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Textarea } from '../components/ui'
import { cx, fmtTime, timeAgo } from '../lib/utils'

export default function Discussions() {
  usePageMeta({ title: 'Discussions', description: 'Project conversations with your team and mentors.' })
  const { discussions, projects, me, userById, projectById, addThread, replyThread, loadThread } = useApp()
  const [activeId, setActiveId] = useState(discussions[0]?.id)
  const [sending, setSending] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [project, setProject] = useState('')
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ projectId: '', title: '', text: '' })
  const endRef = useRef()

  const threads = discussions.filter((d) => !project || String(d.projectId) === String(project))
  const active = discussions.find((d) => d.id === activeId)

  // Pick the first thread once threads arrive, and load full messages for the open thread
  useEffect(() => { if (activeId == null && discussions.length) setActiveId(discussions[0].id) }, [discussions, activeId])
  useEffect(() => { if (activeId != null) loadThread(activeId) }, [activeId])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [active?.messages?.length])

  const send = async (e) => {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    const ok = await replyThread(active.id, text.trim())
    setSending(false)
    if (ok) setText('')
  }
  const [errors, setErrors] = useState({})
  const create = async (e) => {
    e.preventDefault()
    const errs = check(form, { projectId: [rules.required('Project')], title: [rules.required('Title'), rules.max(200, 'Title')], text: [rules.required('Message'), rules.max(5000, 'Message')] })
    setErrors(errs)
    if (Object.keys(errs).length) return
    const id = await addThread(form.projectId, form.title, form.text)
    if (!id) return
    setActiveId(id)
    setMobileOpen(true)
    setForm({ projectId: '', title: '', text: '' })
    setOpen(false)
  }

  return (
    <div>
      <PageHeader title="Discussions" subtitle="Project conversations with your team and mentors." actions={<Button icon={Plus} onClick={() => setOpen(true)}>New Thread</Button>} />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card className={cx('flex flex-col gap-3 !p-4', mobileOpen && 'hidden lg:flex')}>
          <Select aria-label="Filter by project" value={project} onChange={(e) => setProject(e.target.value)} placeholder="All projects" options={projects.map((p) => ({ value: p.id, label: p.name }))} className="!py-2.5" />
          {threads.length === 0 && <Empty icon={MessagesSquare} title="No threads" />}
          <AnimatedBackground
            defaultValue={activeId}
            onValueChange={(id) => { if (id) { setActiveId(id); setMobileOpen(true) } }}
            className="clay-sm !rounded-2xl"
            transition={{ type: 'spring', bounce: 0.2, duration: 0.45 }}
          >
          {threads.map((th) => {
            const last = th.last
            const participants = th.participants.map(userById).filter(Boolean)
            return (
              <button key={th.id} data-id={th.id} type="button" className="w-full cursor-pointer rounded-2xl p-3.5 text-left">
                <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <span className={cx('font-black', th.id === activeId ? 'text-accent' : 'text-ink')}>{th.title}</span>
                  <span className="shrink-0 text-[11px] font-bold text-muted">{timeAgo(last?.at || th.updatedAt)}</span>
                </div>
                <div className="text-xs font-bold text-muted">{projectById(th.projectId)?.name}</div>
                <div className="line-clamp-1 text-sm font-semibold text-muted">{last ? `${userById(last.userId)?.name || 'Someone'}: ${last.text}` : 'No messages yet'}</div>
                <div className="flex items-center justify-between"><AvatarStack users={participants} size={24} /><span className="text-[11px] font-black text-muted">{th.messageCount} message{th.messageCount === 1 ? '' : 's'}</span></div>
                </div>
              </button>
            )
          })}
          </AnimatedBackground>
        </Card>

        <Card className={cx('flex min-h-[560px] flex-col !p-0', !mobileOpen && 'hidden lg:flex')}>
          {!active ? <Empty icon={MessagesSquare} title="Select a thread" /> : (
            <>
              <div className="flex items-center gap-3 border-b-2 border-line/70 p-5">
                <button onClick={() => setMobileOpen(false)} className="cursor-pointer text-muted lg:hidden" aria-label="Back"><ArrowLeft size={20} /></button>
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-black text-ink">{active.title}</div>
                  <div className="text-xs font-bold text-muted">{projectById(active.projectId)?.name} · started by {userById(active.authorId)?.name}</div>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
                {!active.messages && <div className="m-auto text-sm font-bold text-muted">Loading messages…</div>}
                {(active.messages || []).map((m) => {
                  const u = userById(m.userId)
                  const mine = m.userId === me.id
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 14, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', bounce: 0.3, duration: 0.45 }}
                      style={{ originX: mine ? 1 : 0 }}
                      className={cx('flex max-w-[85%] gap-3', mine && 'flex-row-reverse self-end')}
                    >
                      <Avatar user={u} size={34} />
                      <div>
                        <div className={cx('mb-1 text-xs font-black text-muted', mine && 'text-right')}>{u?.name} · {fmtTime(m.at)}</div>
                        <div className={cx('px-4 py-3 text-sm font-semibold', mine ? 'clay-tone tone-primary !rounded-[20px] !rounded-tr-md' : 'clay-sm !rounded-[20px] !rounded-tl-md text-ink')}>{m.text}</div>
                      </div>
                    </motion.div>
                  )
                })}
                <div ref={endRef} />
              </div>
              <form onSubmit={send} className="flex gap-3 border-t-2 border-line/70 p-4">
                <Input shellClassName="flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" />
                <Button type="submit" icon={Send} aria-label="Send" disabled={sending}>Send</Button>
              </form>
            </>
          )}
        </Card>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Thread">
        <form onSubmit={create} noValidate className="flex flex-col gap-4">
          <Field label="Project" required error={errors.projectId}><Select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} placeholder="Select project" options={projects.map((p) => ({ value: p.id, label: p.name }))} /></Field>
          <Field label="Title" required error={errors.title}><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Message" required error={errors.text}><Textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} /></Field>
          <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Start Thread</Button></div>
        </form>
      </Modal>
    </div>
  )
}
