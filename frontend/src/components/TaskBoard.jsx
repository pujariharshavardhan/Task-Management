import { useEffect, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { useForm, useWatch } from 'react-hook-form'
import { CalendarDays, ListChecks, MessageCircle, Plus, Trash2, Send, Clock, Tag } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Avatar, Badge, Button, ConfirmDialog, Field, Input, Modal, PriorityBadge, Progress, Select, Textarea, StatusBadge } from './ui'
import { PRIORITIES, TASK_STATUSES, TASK_TYPES } from '../data/constants'
import { cx, daysUntil, dueLabel, fmtDate, timeAgo } from '../lib/utils'

const COLUMN_TONE = { Todo: 'muted', 'In Progress': 'accent', Review: 'sun', Done: 'mint' }

/** People who can be assigned work on a project: owner, members and guide. */
export function useProjectPeople(projectId) {
  const { projectById, userById } = useApp()
  const p = projectById(projectId)
  if (!p) return []
  const ids = [...new Set([p.ownerId, ...p.members.map((m) => m.userId), p.guideId].filter(Boolean))]
  return ids.map(userById).filter(Boolean)
}

function TaskCard({ task, onOpen, onDragStart, showProject }) {
  const { userById, projectById } = useApp()
  const assignee = userById(task.assignedTo)
  const checks = task.checklist.length
  const checked = task.checklist.filter((c) => c.done).length
  const overdue = task.status !== 'Done' && daysUntil(task.dueDate) < 0

  return (
    <motion.div
      layout
      layoutId={`task-${task.id}`}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', bounce: 0.2, duration: 0.45 }}
    >
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => onOpen(task.id)}
      className="clay-sm min-w-0 cursor-grab p-4 active:cursor-grabbing"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-black text-muted">{task.key}</span>
        <PriorityBadge priority={task.priority} />
      </div>
      <div className="font-extrabold leading-snug text-ink">{task.title}</div>
      {showProject && <div className="mt-1 truncate text-xs font-bold text-secondary">{projectById(task.projectId)?.name}</div>}
      {task.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {task.tags.slice(0, 3).map((t) => <span key={t} className="rounded-lg bg-bg px-2 py-0.5 text-[10px] font-extrabold text-muted">#{t}</span>)}
        </div>
      )}
      {checks > 0 && <Progress value={Math.round((checked / checks) * 100)} className="mt-3" tone="mint" />}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs font-bold text-muted">
          <span className={cx('flex items-center gap-1', overdue && 'text-rose')}><CalendarDays size={13} />{task.status === 'Done' ? fmtDate(task.dueDate, { month: 'short', day: 'numeric' }) : dueLabel(task.dueDate)}</span>
          {checks > 0 && <span className="flex items-center gap-1"><ListChecks size={13} />{checked}/{checks}</span>}
          {task.commentCount > 0 && <span className="flex items-center gap-1"><MessageCircle size={13} />{task.commentCount}</span>}
        </div>
        {assignee && <Avatar user={assignee} size={26} />}
      </div>
    </div>
    </motion.div>
  )
}

export function KanbanBoard({ tasks, showProject = true, onNewTask }) {
  const { updateTask } = useApp()
  const [openId, setOpenId] = useState(null)
  const [over, setOver] = useState(null)

  const onDragStart = (e, id) => e.dataTransfer.setData('text/plain', id)
  const onDrop = (e, status) => {
    e.preventDefault()
    const id = Number(e.dataTransfer.getData('text/plain'))
    const task = tasks.find((t) => t.id === id)
    if (task && task.status !== status) updateTask(id, { status })
    setOver(null)
  }

  return (
    <>
      <LayoutGroup>
      <div className="-mx-1 flex snap-x gap-5 overflow-x-auto px-1 pt-1 pb-4">
        {TASK_STATUSES.map((status) => {
          const col = tasks.filter((t) => t.status === status)
          return (
            <div
              key={status}
              onDragOver={(e) => { e.preventDefault(); setOver(status) }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => onDrop(e, status)}
              className={cx('clay-inset flex w-[290px] shrink-0 snap-start flex-col gap-3.5 !rounded-[26px] p-3.5 transition xl:w-auto xl:min-w-[220px] xl:flex-1 xl:shrink', over === status && 'ring-4 ring-accent-soft')}
            >
              <div className="flex items-center justify-between px-1.5 pt-1">
                <div className="flex items-center gap-2">
                  <span className={cx('h-3 w-3 rounded-full', `tone-${COLUMN_TONE[status]}`)} style={{ background: 'var(--tone)' }} />
                  <span className="text-sm font-black tracking-wide text-ink uppercase">{status}</span>
                  <span className="clay-sm grid h-6 min-w-6 place-items-center !rounded-full px-1.5 text-[11px] font-black text-muted">{col.length}</span>
                </div>
                {onNewTask && (
                  <button onClick={() => onNewTask(status)} className="-m-1.5 cursor-pointer rounded-lg p-1.5 text-muted hover:text-accent" aria-label={`Add task to ${status}`}><Plus size={18} aria-hidden="true" /></button>
                )}
              </div>
              <div className="flex min-h-32 flex-col gap-3.5">
                <AnimatePresence initial={false}>{col.map((t) => <TaskCard key={t.id} task={t} onOpen={setOpenId} onDragStart={onDragStart} showProject={showProject} />)}</AnimatePresence>
                {col.length === 0 && <div className="grid flex-1 place-items-center rounded-2xl border-2 border-dashed border-line p-6 text-xs font-bold text-muted">Drop tasks here</div>}
              </div>
            </div>
          )
        })}
      </div>
      </LayoutGroup>
      <TaskDetailModal taskId={openId} onClose={() => setOpenId(null)} />
    </>
  )
}

export function TaskFormModal({ open, onClose, defaults = {} }) {
  const { projects, addTask } = useApp()
  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm()
  const projectId = useWatch({ control, name: 'projectId' })
  const people = useProjectPeople(projectId)
  useEffect(() => {
    if (open) reset({ title: '', description: '', projectId: defaults.projectId || '', assignedTo: '', type: 'Development', priority: 'Medium', status: defaults.status || 'Todo', startDate: '', dueDate: '', estimatedHours: 8, tags: '' })
  }, [open, defaults.projectId, defaults.status, reset])
  const submit = async (d) => {
    const id = await addTask({ ...d, estimatedHours: Number(d.estimatedHours) || 0, tags: d.tags.split(',').map((s) => s.trim()).filter(Boolean) })
    if (id) onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="New Task" width="max-w-2xl">
      <form onSubmit={handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2">
        <Field label="Task Title" required error={errors.title?.message} className="sm:col-span-2">
          <Input placeholder="e.g. Build login API" {...register('title', { required: 'Title is required', maxLength: { value: 200, message: 'Title must be 200 characters or fewer' } })} />
        </Field>
        <Field label="Project" required error={errors.projectId?.message}>
          <Select placeholder="Select project" options={projects.filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name }))} {...register('projectId', { required: 'Choose a project' })} />
        </Field>
        <Field label="Assigned To">
          <Select placeholder={projectId ? 'Unassigned' : 'Choose a project first'} options={people.map((u) => ({ value: u.id, label: u.name }))} {...register('assignedTo')} />
        </Field>
        <Field label="Task Type"><Select options={TASK_TYPES} {...register('type')} /></Field>
        <Field label="Priority"><Select options={PRIORITIES} {...register('priority')} /></Field>
        <Field label="Status"><Select options={TASK_STATUSES} {...register('status')} /></Field>
        <Field label="Estimated Hours" error={errors.estimatedHours?.message}><Input type="number" min="0" step="0.5" {...register('estimatedHours', { min: { value: 0, message: 'Hours cannot be negative' } })} /></Field>
        <Field label="Start Date"><Input type="date" {...register('startDate')} /></Field>
        <Field label="Due Date" required error={errors.dueDate?.message}><Input type="date" {...register('dueDate', { required: 'Due date is required', validate: (v, all) => !all.startDate || v >= all.startDate || 'Due date must be on or after the start date' })} /></Field>
        <Field label="Description" className="sm:col-span-2"><Textarea placeholder="What needs to be done?" {...register('description')} /></Field>
        <Field label="Tags" hint="Comma separated, e.g. frontend, auth" className="sm:col-span-2"><Input {...register('tags')} /></Field>
        <div className="flex justify-end gap-3 sm:col-span-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" icon={Plus} disabled={isSubmitting}>{isSubmitting ? 'Creating…' : 'Create Task'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export function TaskDetailModal({ taskId, onClose }) {
  const { taskById, userById, projectById, updateTask, deleteTask, addComment, loadTask, addChecklistItem, toggleChecklistItem, toast } = useApp()
  const [comment, setComment] = useState('')
  const [newItem, setNewItem] = useState('')
  const [hours, setHours] = useState('')
  const [confirm, setConfirm] = useState(false)
  const task = taskById(taskId)
  const people = useProjectPeople(task?.projectId)

  // Comments are only included in the task detail endpoint
  useEffect(() => { if (taskId) loadTask(taskId) }, [taskId])
  useEffect(() => { if (task) setHours(String(task.actualHours ?? 0)) }, [task?.id, task?.actualHours])

  if (!task) return null
  const project = projectById(task.projectId)
  const checked = task.checklist.filter((c) => c.done).length

  const addItem = async (e) => {
    e.preventDefault()
    if (!newItem.trim()) return
    if (await addChecklistItem(task.id, newItem.trim())) setNewItem('')
  }
  const send = async (e) => {
    e.preventDefault()
    if (!comment.trim()) return
    if (await addComment(task.id, comment.trim())) setComment('')
  }
  const saveHours = () => {
    const v = Number(hours)
    if (!Number.isNaN(v) && v !== task.actualHours) updateTask(task.id, { actualHours: v })
  }

  return (
    <Modal open onClose={onClose} title={task.title} width="max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone="muted">{task.key}</Badge>
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        <Badge tone="sky">{task.type}</Badge>
        <span className="text-xs font-bold text-accent">{project?.name}</span>
      </div>
      <div className="grid gap-6 md:grid-cols-[1fr_240px]">
        <div className="flex flex-col gap-6">
          <div>
            <h4 className="mb-2 text-xs font-black tracking-wide text-muted uppercase">Description</h4>
            <p className="text-sm font-semibold text-ink">{task.description || 'No description yet.'}</p>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-xs font-black tracking-wide text-muted uppercase">Checklist</h4>
              {task.checklist.length > 0 && <span className="text-xs font-black text-ink">{checked}/{task.checklist.length}</span>}
            </div>
            {task.checklist.length > 0 && <Progress value={Math.round((checked / task.checklist.length) * 100)} tone="mint" className="mb-3" />}
            <div className="flex flex-col gap-2">
              {task.checklist.map((c) => (
                <label key={c.id} className="row-hover flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5">
                  <input type="checkbox" checked={c.done} onChange={() => toggleChecklistItem(task.id, c.id, !c.done)} className="h-4.5 w-4.5 accent-[var(--color-accent)]" />
                  <span className={cx('text-sm font-bold', c.done ? 'text-muted line-through' : 'text-ink')}>{c.item}</span>
                </label>
              ))}
            </div>
            <form onSubmit={addItem} className="mt-2 flex gap-2">
              <Input shellClassName="flex-1" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add checklist item" className="!py-2" />
              <Button type="submit" variant="ghost" icon={Plus} size="sm">Add</Button>
            </form>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-black tracking-wide text-muted uppercase">Comments ({task.comments ? task.comments.length : task.commentCount})</h4>
            <div className="flex flex-col gap-3">
              {!task.comments && task.commentCount > 0 && <div className="text-xs font-bold text-muted">Loading comments…</div>}
              {(task.comments || []).map((c) => {
                const u = userById(c.userId)
                return (
                  <div key={c.id} className="flex gap-3">
                    <Avatar user={u} size={32} />
                    <div className="clay-sm flex-1 px-4 py-2.5">
                      <div className="text-xs font-black text-ink">{u?.name} <span className="font-semibold text-muted">· {timeAgo(c.at)}</span></div>
                      <div className="text-sm font-semibold text-ink">{c.text}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <form onSubmit={send} className="mt-3 flex gap-2">
              <Input shellClassName="flex-1" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment…" className="!py-2.5" />
              <Button type="submit" icon={Send} aria-label="Send comment" />
            </form>
          </div>
        </div>

        <div className="clay-inset flex h-fit flex-col gap-4 p-4">
          <Field label="Status">
            <Select value={task.status} options={TASK_STATUSES} onChange={(e) => updateTask(task.id, { status: e.target.value })} className="!bg-surface" />
          </Field>
          <Field label="Assigned To">
            <Select value={task.assignedTo || ''} placeholder="Unassigned" options={people.map((u) => ({ value: u.id, label: u.name }))} onChange={(e) => updateTask(task.id, { assignedTo: e.target.value ? Number(e.target.value) : null })} className="!bg-surface" />
          </Field>
          <Field label="Priority">
            <Select value={task.priority} options={PRIORITIES} onChange={(e) => updateTask(task.id, { priority: e.target.value })} className="!bg-surface" />
          </Field>
          <div className="grid grid-cols-2 gap-3 text-xs font-bold text-muted">
            <div><div className="mb-1 flex items-center gap-1"><CalendarDays size={12} /> Start</div><div className="text-ink">{fmtDate(task.startDate)}</div></div>
            <div><div className="mb-1 flex items-center gap-1"><CalendarDays size={12} /> Due</div><div className="text-ink">{fmtDate(task.dueDate)}</div></div>
            <div><div className="mb-1 flex items-center gap-1"><Clock size={12} /> Estimated</div><div className="text-ink">{task.estimatedHours}h</div></div>
            <div><div className="mb-1 flex items-center gap-1"><Clock size={12} /> Actual</div>
              <input type="number" min="0" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} onBlur={saveHours} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} className="w-16 rounded-lg bg-surface px-2 py-0.5 text-ink outline-none" aria-label="Actual hours" />h
            </div>
          </div>
          {task.tags.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center gap-1 text-xs font-bold text-muted"><Tag size={12} /> Tags</div>
              <div className="flex flex-wrap gap-1.5">{task.tags.map((t) => <Badge key={t} tone="primary">#{t}</Badge>)}</div>
            </div>
          )}
          {task.createdBy && <div className="text-xs font-semibold text-muted">Created by {userById(task.createdBy)?.name}</div>}
          <Button tone="rose" variant="ghost" icon={Trash2} className="!text-rose" onClick={() => setConfirm(true)}>Delete task</Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete task?"
        message={`“${task.title}” and its checklist and comments will be permanently removed.`}
        onConfirm={async () => { if (await deleteTask(task.id)) { toast('Task deleted', 'rose'); onClose() } }}
      />
    </Modal>
  )
}
