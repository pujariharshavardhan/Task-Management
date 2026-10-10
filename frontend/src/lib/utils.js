import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cx = (...c) => c.filter(Boolean).join(' ')

// Used by the Motion Primitives components (src/components/motion-primitives)
export const cn = (...inputs) => twMerge(clsx(inputs))

const toDate = (d) => (d instanceof Date ? d : new Date(String(d).length === 10 ? d + 'T00:00:00' : d))

export const fmtDate = (d, opts = { month: 'short', day: 'numeric', year: 'numeric' }) =>
  d ? toDate(d).toLocaleDateString('en-US', opts) : '—'

export const fmtShort = (d) => fmtDate(d, { month: 'short', day: 'numeric' })

export const fmtTime = (d) => (d ? toDate(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '')

export const isoDay = (d) => {
  const x = toDate(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

export const today = () => isoDay(new Date())

/** Whole days from today until `d`; Infinity when there is no date (so it never counts as due/overdue). */
export const daysUntil = (d) => {
  if (!d) return Infinity
  const a = toDate(isoDay(new Date()))
  return Math.round((toDate(d) - a) / 86400000)
}

export const timeAgo = (d) => {
  if (!d) return ''
  const s = Math.max(0, (Date.now() - toDate(d)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`
  return fmtShort(d)
}

export const dueLabel = (d) => {
  if (!d) return 'No due date'
  const n = daysUntil(d)
  if (n < 0) return `${-n}d overdue`
  if (n === 0) return 'Due today'
  if (n === 1) return 'Tomorrow'
  return `In ${n} days`
}

export const statusTone = (s) =>
  ({
    Planning: 'sky', 'Not Started': 'muted', 'In Progress': 'accent', 'On Hold': 'sun', Completed: 'mint', Cancelled: 'rose',
    Todo: 'muted', Review: 'sun', Done: 'mint', Active: 'accent', 'At Risk': 'rose', Archived: 'muted', Pending: 'muted',
  })[s] || 'muted'

export const priorityTone = (p) => ({ Low: 'mint', Medium: 'sky', High: 'peach', Critical: 'rose' })[p] || 'muted'

export const eventTone = (type) => ({ deadline: 'rose', milestone: 'sky', meeting: 'mint', review: 'sun', submission: 'primary' })[type] || 'muted'

export const milestoneStatus = (m) => (m.progress >= 100 ? 'Completed' : m.progress > 0 ? 'In Progress' : 'Pending')

export const isActive = (p) => !p.archived && !['Completed', 'Cancelled'].includes(p.status)

export const isAtRisk = (p) => isActive(p) && daysUntil(p.endDate) <= 40 && p.progress < 50

export const reviewTotal = (r) => Object.values(r.scores).reduce((a, b) => a + b, 0)

export const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function downloadCSV(filename, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

// Excel opens HTML tables saved as .xls
export function downloadXLS(filename, rows) {
  const html = `<table>${rows.map((r, i) => `<tr>${r.map((c) => (i ? `<td>${c ?? ''}</td>` : `<th>${c}</th>`)).join('')}</tr>`).join('')}</table>`
  const url = URL.createObjectURL(new Blob([html], { type: 'application/vnd.ms-excel' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

/** Sort helper for optional ISO dates (missing dates sort last). */
export const byDate = (key) => (a, b) => (a[key] || '9999-12-31').localeCompare(b[key] || '9999-12-31')
