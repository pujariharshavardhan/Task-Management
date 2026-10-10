import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { check, rules } from '../lib/validate'
import { usePageMeta } from '../lib/seo'
import { Badge, Button, Card, Empty, Field, IconButton, Input, Modal, PageHeader, Select, Stagger, TabPanels, Tabs } from '../components/ui'
import { cx, eventTone, fmtDate, isoDay, today } from '../lib/utils'

const TYPES = [
  { key: 'deadline', label: 'Task Deadline' },
  { key: 'milestone', label: 'Milestone' },
  { key: 'meeting', label: 'Meeting' },
  { key: 'review', label: 'Review' },
  { key: 'submission', label: 'Submission' },
]
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

function EventPill({ e, onClick, full }) {
  return (
    <button onClick={() => onClick(e)} className={cx('badge min-h-6 w-full cursor-pointer !justify-start !rounded-lg text-left', `tone-${eventTone(e.type)}`, !full && '!px-1.5 !py-0.5 !text-[10px]')} title={e.title}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--tone)' }} />
      <span className="truncate">{e.time && full ? `${e.time} · ` : ''}{e.title}</span>
    </button>
  )
}

export default function Calendar() {
  usePageMeta({ title: 'Calendar', description: 'Task deadlines, milestones, meetings, reviews and submissions on one calendar.' })
  const { tasks, milestones, events, projects, projectById, addEvent } = useApp()
  const [scheduling, setScheduling] = useState(false)
  const [form, setForm] = useState({ projectId: '', title: '', type: 'meeting', date: '', time: '' })
  const [eventErrors, setEventErrors] = useState({})
  const navigate = useNavigate()
  const [view, setView] = useState('Month')
  const [cursor, setCursor] = useState(() => new Date())
  const [project, setProject] = useState('')
  const [hidden, setHidden] = useState([])

  const all = useMemo(() => [
    ...tasks.filter((t) => t.status !== 'Done' && t.dueDate).map((t) => ({ id: t.id, title: t.title, type: 'deadline', date: t.dueDate, projectId: t.projectId, link: `/tasks?task=${t.id}` })),
    ...milestones.filter((m) => m.dueDate).map((m) => ({ id: m.id, title: m.name, type: 'milestone', date: m.dueDate, projectId: m.projectId, link: `/projects/${m.projectId}?tab=Milestones` })),
    ...events.map((e) => ({ ...e, link: `/projects/${e.projectId}` })),
  ].filter((e) => (!project || String(e.projectId) === String(project)) && !hidden.includes(e.type)), [tasks, milestones, events, project, hidden])

  const byDay = useMemo(() => all.reduce((acc, e) => ((acc[e.date] ||= []).push(e), acc), {}), [all])
  const open = (e) => navigate(e.link)

  const shift = (dir) => {
    const d = new Date(cursor)
    if (view === 'Month') d.setMonth(d.getMonth() + dir)
    else if (view === 'Week') d.setDate(d.getDate() + 7 * dir)
    else if (view === 'Day') d.setDate(d.getDate() + dir)
    else d.setMonth(d.getMonth() + dir)
    setCursor(d)
  }

  const title = view === 'Day' ? fmtDate(cursor, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const gridStart = addDays(monthStart, -monthStart.getDay())
  const monthDays = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const weekStart = addDays(cursor, -cursor.getDay())
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const todayIso = today()

  const agenda = all.filter((e) => e.date >= isoDay(monthStart)).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).slice(0, 40)

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Deadlines, milestones, meetings, reviews and submissions." actions={<Button icon={Plus} onClick={() => { setForm((f) => ({ ...f, date: isoDay(cursor) })); setScheduling(true) }}>Schedule Event</Button>} />

      <Card className="mb-6 flex flex-wrap items-center gap-3 !p-4">
        <div className="flex items-center gap-2">
          <IconButton icon={ChevronLeft} label="Previous" onClick={() => shift(-1)} />
          <IconButton icon={ChevronRight} label="Next" onClick={() => shift(1)} />
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
        </div>
        <h2 className="min-w-48 text-lg font-black text-ink">{title}</h2>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <Select aria-label="Filter by project" value={project} onChange={(e) => setProject(e.target.value)} placeholder="All projects" options={projects.filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name }))} className="!w-auto !py-2.5" />
          <Tabs tabs={['Month', 'Week', 'Day', 'Agenda']} active={view} onChange={setView} />
        </div>
      </Card>

      <div className="mb-5 flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button key={t.key} onClick={() => setHidden((h) => (h.includes(t.key) ? h.filter((x) => x !== t.key) : [...h, t.key]))} className={cx('badge cursor-pointer transition', `tone-${eventTone(t.key)}`, hidden.includes(t.key) && 'opacity-40 line-through')}>
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--tone)' }} />{t.label}
          </button>
        ))}
      </div>

      <TabPanels index={['Month', 'Week', 'Day', 'Agenda'].indexOf(view)}>
        <Card className="overflow-x-auto !p-4">
          <div className="grid min-w-[720px] grid-cols-7 gap-2.5">
            {WEEKDAYS.map((d) => <div key={d} className="pb-1 text-center text-xs font-black tracking-wide text-muted uppercase">{d}</div>)}
            {monthDays.map((d) => {
              const iso = isoDay(d)
              const evs = byDay[iso] || []
              const inMonth = d.getMonth() === cursor.getMonth()
              return (
                <div key={iso} className={cx('flex min-h-28 flex-col gap-1 rounded-2xl p-2 transition', inMonth ? 'clay-sm' : 'opacity-45', iso === todayIso && 'ring-3 ring-accent/60')}>
                  <button onClick={() => { setCursor(d); setView('Day') }} className={cx('grid h-7 w-7 cursor-pointer place-items-center rounded-full text-xs font-black', iso === todayIso ? 'clay-tone tone-primary' : 'text-ink')}>{d.getDate()}</button>
                  {evs.slice(0, 3).map((e) => <EventPill key={e.type + e.id} e={e} onClick={open} />)}
                  {evs.length > 3 && <button onClick={() => { setCursor(d); setView('Day') }} className="cursor-pointer text-left text-[10px] font-black text-muted">+{evs.length - 3} more</button>}
                </div>
              )
            })}
          </div>
        </Card>
        <Stagger fill stagger={0.04} className="grid gap-4 md:grid-cols-7">
          {weekDays.map((d) => {
            const iso = isoDay(d)
            const evs = byDay[iso] || []
            return (
              <Card key={iso} className={cx('min-h-60 !p-3', iso === todayIso && 'ring-3 ring-accent/60')}>
                <div className="mb-3 text-center">
                  <div className="text-xs font-black text-muted uppercase">{WEEKDAYS[d.getDay()]}</div>
                  <div className={cx('mx-auto mt-1 grid h-9 w-9 place-items-center rounded-full text-base font-black', iso === todayIso ? 'clay-tone tone-primary' : 'text-ink')}>{d.getDate()}</div>
                </div>
                <div className="flex flex-col gap-1.5">{evs.map((e) => <EventPill key={e.type + e.id} e={e} onClick={open} full />)}</div>
              </Card>
            )
          })}
        </Stagger>
        <Card>
          {(byDay[isoDay(cursor)] || []).length === 0 ? <Empty title="Nothing scheduled" text="Enjoy the free day — or plan ahead." /> : (
            <Stagger stagger={0.05} className="flex flex-col gap-3">
              {(byDay[isoDay(cursor)] || []).map((e) => (
                <button key={e.type + e.id} onClick={() => open(e)} className={cx('clay-sm flex cursor-pointer items-center gap-4 p-4 text-left', `tone-${eventTone(e.type)}`)}>
                  <span className="clay-tone h-12 w-2 !rounded-full" />
                  <div className="flex-1">
                    <div className="font-black text-ink">{e.title}</div>
                    <div className="text-xs font-bold text-muted">{projectById(e.projectId)?.name}</div>
                  </div>
                  {e.time && <span className="flex items-center gap-1 text-sm font-bold text-muted"><Clock size={14} /> {e.time}</span>}
                  <Badge tone={eventTone(e.type)}>{TYPES.find((t) => t.key === e.type)?.label}</Badge>
                </button>
              ))}
            </Stagger>
          )}
        </Card>
        <Card>
          {agenda.length === 0 ? <Empty title="No upcoming events" /> : (
            <Stagger stagger={0.025} className="flex flex-col gap-2">
              {agenda.map((e, i) => {
                const showDate = i === 0 || agenda[i - 1].date !== e.date
                return (
                  <div key={e.type + e.id}>
                    {showDate && <div className={cx('px-2 pt-3 pb-2 text-xs font-black tracking-wide uppercase', e.date === todayIso ? 'text-accent' : 'text-muted')}>{fmtDate(e.date, { weekday: 'long', month: 'short', day: 'numeric' })}{e.date === todayIso && ' · Today'}</div>}
                    <button onClick={() => open(e)} className="row-hover flex w-full cursor-pointer items-center gap-4 rounded-2xl p-3 text-left">
                      <span className={cx('h-3 w-3 rounded-full', `tone-${eventTone(e.type)}`)} style={{ background: 'var(--tone)' }} />
                      <span className="w-14 text-xs font-bold text-muted">{e.time || 'All day'}</span>
                      <span className="flex-1 text-sm font-extrabold text-ink">{e.title}</span>
                      <span className="hidden text-xs font-bold text-muted sm:block">{projectById(e.projectId)?.name}</span>
                      <Badge tone={eventTone(e.type)}>{TYPES.find((t) => t.key === e.type)?.label}</Badge>
                    </button>
                  </div>
                )
              })}
            </Stagger>
          )}
        </Card>
      </TabPanels>



      <Modal open={scheduling} onClose={() => setScheduling(false)} title="Schedule Event">
        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault()
            const errs = check(form, {
              title: [rules.required('Title'), rules.max(200, 'Title')],
              projectId: [rules.required('Project')],
              date: [rules.required('Date')],
              time: [rules.time()],
            })
            setEventErrors(errs)
            if (Object.keys(errs).length) return
            if (await addEvent(form)) { setScheduling(false); setForm({ projectId: '', title: '', type: 'meeting', date: '', time: '' }) }
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Field label="Title" required error={eventErrors.title} className="sm:col-span-2"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Weekly stand-up" /></Field>
          <Field label="Project" required error={eventErrors.projectId}><Select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} placeholder="Select project" options={projects.filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name }))} /></Field>
          <Field label="Type"><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={[{ value: 'meeting', label: 'Meeting' }, { value: 'review', label: 'Review' }, { value: 'submission', label: 'Submission' }]} /></Field>
          <Field label="Date" required error={eventErrors.date}><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Time" error={eventErrors.time}><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>
          <div className="flex justify-end gap-3 sm:col-span-2"><Button type="button" variant="ghost" onClick={() => setScheduling(false)}>Cancel</Button><Button type="submit" icon={Plus}>Schedule</Button></div>
        </form>
      </Modal>
    </div>
  )
}
