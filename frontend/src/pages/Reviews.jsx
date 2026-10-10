import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Award, Plus, CalendarDays, ListChecks } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { check, rules } from '../lib/validate'
import { usePageMeta } from '../lib/seo'
import { Avatar, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Progress, Ring, Select, Stagger, StatCard, Tabs, Textarea } from '../components/ui'
import { REVIEW_CRITERIA, REVIEW_STAGES } from '../data/constants'
import { fmtDate, reviewTotal } from '../lib/utils'

const scoreTone = (n) => (n >= 80 ? 'mint' : n >= 60 ? 'primary' : n >= 40 ? 'sun' : 'rose')

export function ReviewCard({ review: r, hideProject }) {
  const { userById, projectById } = useApp()
  const total = reviewTotal(r)
  const project = projectById(r.projectId)
  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-start gap-4">
        <Ring value={total} size={92} tone={scoreTone(total)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><Badge tone="primary">{r.stage}</Badge><span className="flex items-center gap-1 text-xs font-bold text-muted"><CalendarDays size={12} /> {fmtDate(r.date)}</span></div>
          {!hideProject && <Link to={`/projects/${r.projectId}?tab=Reviews`} className="mt-1.5 block truncate font-black text-ink hover:text-accent">{project?.name}</Link>}
          <div className="mt-2 flex items-center gap-2"><Avatar user={userById(r.reviewerId)} size={24} /><span className="text-xs font-bold text-muted">Reviewed by {userById(r.reviewerId)?.name}</span></div>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {REVIEW_CRITERIA.map((c) => (
          <div key={c.key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[170px_1fr_auto]">
            <span className="text-xs font-bold text-muted">{c.label}</span>
            <Progress value={(r.scores[c.key] / 20) * 100} tone={scoreTone((r.scores[c.key] / 20) * 100)} className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto" />
            <span className="col-start-2 row-start-1 text-xs font-black text-ink sm:col-start-auto sm:row-start-auto">{r.scores[c.key]}/20</span>
          </div>
        ))}
      </div>
      <div className="clay-inset p-4">
        <div className="mb-1 text-[11px] font-black tracking-wide text-muted uppercase">Feedback</div>
        <p className="text-sm font-semibold text-ink">{r.feedback}</p>
      </div>
      {r.actionItems?.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-black tracking-wide text-muted uppercase"><ListChecks size={13} /> Action Items</div>
          <ul className="flex flex-col gap-1.5">{r.actionItems.map((a) => <li key={a} className="flex items-center gap-2 text-sm font-bold text-ink"><span className="h-1.5 w-1.5 rounded-full bg-peach" />{a}</li>)}</ul>
        </div>
      )}
    </Card>
  )
}

export function ReviewFormModal({ open, onClose, projectId: fixed }) {
  const { projects, users, me, addReview } = useApp()
  const blank = { projectId: fixed || '', stage: 'Review 1', reviewerId: me.id, date: new Date().toISOString().slice(0, 10), feedback: '', actionItems: '', scores: { technical: 15, documentation: 15, innovation: 15, presentation: 15, team: 15 } }
  const [f, setF] = useState(blank)
  const total = Object.values(f.scores).reduce((a, b) => a + b, 0)
  const [errors, setErrors] = useState({})
  const save = async (e) => {
    e.preventDefault()
    const errs = check({ ...f, projectId: fixed || f.projectId }, {
      projectId: [rules.required('Project')],
      date: [rules.required('Review date')],
      feedback: [rules.required('Feedback'), rules.min(10, 'Feedback'), rules.max(5000, 'Feedback')],
    })
    setErrors(errs)
    if (Object.keys(errs).length) return
    if (!(await addReview({ ...f, projectId: fixed || f.projectId, actionItems: f.actionItems.split('\n').map((s) => s.trim()).filter(Boolean) }))) return
    setF(blank)
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Academic Review" width="max-w-2xl">
      <form onSubmit={save} noValidate className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-3">
          {!fixed && <Field label="Project" required error={errors.projectId} className="sm:col-span-3"><Select value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} placeholder="Select project" options={projects.map((p) => ({ value: p.id, label: p.name }))} /></Field>}
          <Field label="Review Stage"><Select value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })} options={REVIEW_STAGES} /></Field>
          <Field label="Guide / Mentor"><Select value={f.reviewerId} onChange={(e) => setF({ ...f, reviewerId: e.target.value })} options={users.map((u) => ({ value: u.id, label: u.name }))} /></Field>
          <Field label="Review Date" required error={errors.date}><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        </div>
        <div className="clay-inset flex flex-col gap-4 p-5">
          {REVIEW_CRITERIA.map((c) => (
            <div key={c.key} className="flex items-center gap-4">
              <span className="w-48 text-sm font-bold text-ink">{c.label}</span>
              <input type="range" min="0" max="20" value={f.scores[c.key]} onChange={(e) => setF({ ...f, scores: { ...f.scores, [c.key]: Number(e.target.value) } })} className="flex-1 accent-[var(--color-accent)]" aria-label={c.label} />
              <span className="w-12 text-right text-sm font-black text-ink">{f.scores[c.key]}/20</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t-2 border-line pt-3">
            <span className="text-sm font-black text-muted uppercase">Total</span>
            <Badge tone={scoreTone(total)} className="!text-sm">{total} / 100</Badge>
          </div>
        </div>
        <Field label="Feedback" required error={errors.feedback}><Textarea value={f.feedback} onChange={(e) => setF({ ...f, feedback: e.target.value })} placeholder="Overall comments on the project…" /></Field>
        <Field label="Action Items" hint="One per line"><Textarea value={f.actionItems} onChange={(e) => setF({ ...f, actionItems: e.target.value })} /></Field>
        <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" icon={Award}>Save Review</Button></div>
      </form>
    </Modal>
  )
}

export default function Reviews() {
  usePageMeta({ title: 'Academic Reviews', description: 'Mentor evaluations and scores for Review 1, 2, 3 and the final review.' })
  const { reviews } = useApp()
  const [stage, setStage] = useState('All')
  const [open, setOpen] = useState(false)
  const list = reviews.filter((r) => stage === 'All' || r.stage === stage)
  const avg = reviews.length ? Math.round(reviews.reduce((a, r) => a + reviewTotal(r), 0) / reviews.length) : 0
  const best = reviews.reduce((b, r) => (reviewTotal(r) > (b ? reviewTotal(b) : -1) ? r : b), null)

  return (
    <div>
      <PageHeader title="Academic Reviews" subtitle="Mentor evaluations across Review 1, 2, 3 and Final Review." actions={<Button icon={Plus} onClick={() => setOpen(true)}>New Review</Button>} />
      <Stagger fill className="mb-6 grid gap-5 sm:grid-cols-3">
        <StatCard icon={Award} label="Total Reviews" value={reviews.length} tone="primary" />
        <StatCard icon={ListChecks} label="Average Score" value={`${avg}/100`} tone="mint" />
        <StatCard icon={Award} label="Top Score" value={best ? reviewTotal(best) : '—'} tone="sun" hint={best?.stage} />
      </Stagger>
      <Tabs tabs={['All', ...REVIEW_STAGES]} active={stage} onChange={setStage} className="mb-6" />
      {list.length === 0 ? <Card><Empty icon={Award} title="No reviews for this stage" /></Card> : (
        <Stagger key={stage} fill className="grid gap-6 lg:grid-cols-2">{list.map((r) => <ReviewCard key={r.id} review={r} />)}</Stagger>
      )}
      <ReviewFormModal open={open} onClose={() => setOpen(false)} />
    </div>
  )
}
