import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Bell, CalendarClock, UserPlus, Clock, MessageCircle, CircleCheck, Flag, FileText, Award, CheckCheck, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { usePageMeta } from '../lib/seo'
import { Button, Card, Empty, IconBlob, PageHeader, Tabs } from '../components/ui'
import { cx, timeAgo } from '../lib/utils'

const TYPE = {
  deadline: [CalendarClock, 'rose', 'Task deadline'],
  assigned: [UserPlus, 'primary', 'New task assigned'],
  project_deadline: [Clock, 'peach', 'Project deadline'],
  comment: [MessageCircle, 'sky', 'New comment'],
  completed: [CircleCheck, 'mint', 'Task completed'],
  milestone: [Flag, 'sky', 'Milestone updated'],
  document: [FileText, 'pink', 'New document'],
  review: [Award, 'sun', 'Review scheduled'],
}

export function NotificationIcon({ type, size = 44 }) {
  const [icon, tone] = TYPE[type] || [Bell, 'muted']
  return <IconBlob icon={icon} tone={tone} size={size} soft />
}

export default function Notifications() {
  usePageMeta({ title: 'Notifications', description: 'Your alerts for deadlines, assignments, comments, milestones and reviews.' })
  const { notifications, markRead, markAllRead, deleteNotification, projectById } = useApp()
  const [tab, setTab] = useState('All')
  const navigate = useNavigate()
  const list = notifications.filter((n) => tab === 'All' || (tab === 'Unread' ? !n.read : n.read))
  const unread = notifications.filter((n) => !n.read).length

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Notifications" subtitle={`${unread} unread`} actions={<Button variant="ghost" icon={CheckCheck} onClick={markAllRead} disabled={!unread}>Mark all as read</Button>} />
      <Tabs tabs={['All', 'Unread', 'Read']} active={tab} onChange={setTab} className="mb-6" />
      <Card className="!p-3">
        {list.length === 0 && <Empty icon={Bell} title="You're all caught up" />}
        <AnimatePresence initial={false} mode="popLayout">
        {list.map((n, i) => (
          <motion.div
            key={n.id}
            layout
            initial={{ opacity: 0, x: -16, filter: 'blur(4px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)', transition: { delay: Math.min(i, 10) * 0.04 } }}
            exit={{ opacity: 0, x: 40, height: 0, transition: { duration: 0.25 } }}
            className="row-hover group flex items-center gap-4 rounded-2xl p-3"
          >
            <NotificationIcon type={n.type} />
            <button onClick={() => { markRead(n.id); navigate(n.taskId ? `/tasks?task=${n.taskId}` : `/projects/${n.projectId}`) }} className="min-w-0 flex-1 cursor-pointer text-left">
              <div className={cx('text-sm', n.read ? 'font-semibold text-muted' : 'font-black text-ink')}>{n.message}</div>
              <div className="text-xs font-bold text-muted">{TYPE[n.type]?.[2]} · {projectById(n.projectId)?.name} · {timeAgo(n.at)}</div>
            </button>
            {!n.read && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />}
            <button onClick={() => deleteNotification(n.id)} className="cursor-pointer p-2 text-muted opacity-0 transition group-hover:opacity-100 hover:text-rose focus:opacity-100" aria-label="Delete notification"><Trash2 size={16} /></button>
          </motion.div>
        ))}
        </AnimatePresence>
      </Card>
    </div>
  )
}
