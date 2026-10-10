import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X, Inbox } from 'lucide-react'
import { cx, statusTone, priorityTone } from '../lib/utils'
import { AnimatedBackground } from './motion-primitives/animated-background'
import { AnimatedNumber } from './motion-primitives/animated-number'
import { AnimatedGroup } from './motion-primitives/animated-group'
import { BorderTrail } from './motion-primitives/border-trail'
import { InView } from './motion-primitives/in-view'
import { SlidingNumber } from './motion-primitives/sliding-number'
import { TextEffect } from './motion-primitives/text-effect'
import { Tilt } from './motion-primitives/tilt'
import { TransitionPanel } from './motion-primitives/transition-panel'

const spring = { type: 'spring', bounce: 0.2, duration: 0.45 }

export const Card = ({ className, children, ...p }) => (
  <div className={cx('clay min-w-0 p-5', className)} {...p}>{children}</div>
)

/** Staggered entrance for any list/grid of children (Motion Primitives AnimatedGroup). */
export const Stagger = ({ className, children, stagger = 0.07, delay = 0, fill = false, as }) => (
  <AnimatedGroup
    as={as}
    className={cx(className, '[&>div]:min-w-0', fill && '[&>div]:flex [&>div>*]:min-w-0 [&>div>*]:flex-1')}
    variants={{
      container: { hidden: {}, visible: { transition: { staggerChildren: stagger, delayChildren: delay } } },
      item: {
        hidden: { opacity: 0, y: 18, filter: 'blur(4px)' },
        visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', bounce: 0.2, duration: 0.55 }, transitionEnd: { filter: 'none' } },
      },
    }}
  >
    {children}
  </AnimatedGroup>
)

/** Fade/slide a section in when it scrolls into view (Motion Primitives InView). */
export const Reveal = ({ children, delay = 0 }) => (
  <InView
    once
    viewOptions={{ margin: '0px 0px -60px 0px' }}
    variants={{ hidden: { opacity: 0, y: 24, filter: 'blur(4px)' }, visible: { opacity: 1, y: 0, filter: 'blur(0px)' } }}
    transition={{ duration: 0.45, ease: 'easeOut', delay }}
  >
    {children}
  </InView>
)

export function Button({ tone = 'primary', variant = 'solid', icon: Icon, className, children, size, ...p }) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className={cx(variant === 'solid' ? `btn-tone tone-${tone}` : 'btn-ghost', size === 'sm' && '!px-3 !py-1.5 !text-xs !rounded-xl', className)}
      {...p}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 17} strokeWidth={2.4} />}
      {children}
    </motion.button>
  )
}

export const IconButton = ({ icon: Icon, label, className, badge, ...p }) => (
  <motion.button whileTap={{ scale: 0.9 }} aria-label={label} title={label} className={cx('btn-ghost relative !p-2.5 !rounded-2xl', className)} {...p}>
    <Icon size={18} strokeWidth={2.3} />
    <AnimatePresence>
      {badge ? (
        <motion.span
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="tone-rose clay-tone absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center !rounded-full px-1 text-[10px] font-black"
        >
          <SlidingNumber value={badge} />
        </motion.span>
      ) : null}
    </AnimatePresence>
  </motion.button>
)

export const Badge = ({ tone = 'muted', children, dot, className }) => (
  <span className={cx('badge', `tone-${tone}`, className)}>
    {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--tone)' }} />}
    {children}
  </span>
)
export const StatusBadge = ({ status }) => <Badge tone={statusTone(status)} dot>{status}</Badge>
export const PriorityBadge = ({ priority }) => <Badge tone={priorityTone(priority)}>{priority}</Badge>

export function Progress({ value = 0, tone, className, showLabel }) {
  const t = tone || (value >= 100 ? 'mint' : value < 35 ? 'sun' : 'accent')
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className={cx('flex items-center gap-3', className)}>
      <div className="clay-inset h-3 min-w-20 flex-1 overflow-hidden !rounded-full p-[3px]">
        <motion.div
          className={cx('h-full rounded-full', `tone-${t}`)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', bounce: 0, duration: 0.9 }}
          style={{ background: 'linear-gradient(90deg, var(--tone-hi), var(--tone))', boxShadow: 'inset 1px 1px 2px rgba(255,255,255,.5)' }}
        />
      </div>
      {showLabel && <span className="w-10 text-right text-xs font-extrabold text-ink"><AnimatedNumber value={value} springOptions={{ bounce: 0, duration: 900 }} />%</span>}
    </div>
  )
}

export function Ring({ value, size = 120, tone = 'primary', label }) {
  const r = size / 2 - 12
  const c = 2 * Math.PI * r
  return (
    <div className={cx('clay relative grid place-items-center !rounded-full', `tone-${tone}`)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--tone-soft)" strokeWidth="10" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--tone)" strokeWidth="10" strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ type: 'spring', bounce: 0, duration: 1.2 }}
        />
      </svg>
      <div className="text-center">
        <div className="text-2xl font-black text-ink"><AnimatedNumber value={value} springOptions={{ bounce: 0, duration: 1200 }} />%</div>
        {label && <div className="text-[11px] font-bold text-muted">{label}</div>}
      </div>
    </div>
  )
}

const initials = (n = '') => n.replace(/^Dr\.\s*/, '').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()

export const Avatar = ({ user, size = 36, className }) => (
  <span
    title={user?.name}
    className={cx('clay-tone inline-grid shrink-0 place-items-center !rounded-full font-black', `tone-${user?.tone || 'primary'}`, className)}
    style={{ width: size, height: size, fontSize: size * 0.36 }}
  >
    {initials(user?.name)}
  </span>
)

export function AvatarStack({ users, max = 4, size = 30 }) {
  const shown = users.slice(0, max)
  return (
    <div className="flex items-center">
      {shown.map((u, i) => (
        <motion.span key={u.id} whileHover={{ y: -3, zIndex: 10 }} className={cx('relative inline-flex rounded-full', i && '-ml-2.5')}>
          <Avatar user={u} size={size} className="ring-2 ring-surface" />
        </motion.span>
      ))}
      {users.length > max && (
        <span className="clay-sm -ml-2.5 grid place-items-center !rounded-full text-[11px] font-black text-muted ring-2 ring-surface" style={{ width: size, height: size }}>
          +{users.length - max}
        </span>
      )}
    </div>
  )
}

export function IconBlob({ icon: Icon, tone = 'primary', size = 44, soft }) {
  return (
    <span className={cx(soft ? 'clay-soft' : 'clay-tone', `tone-${tone}`, 'inline-grid shrink-0 place-items-center')} style={{ width: size, height: size }}>
      <Icon size={size * 0.46} strokeWidth={2.4} />
    </span>
  )
}

/** Animates "42", "60%" or "85/100" — any value that starts with a number. */
function AnimatedValue({ value }) {
  const m = typeof value === 'number' ? [null, value, ''] : String(value).match(/^(\d+)(.*)$/)
  if (!m) return value
  return <><AnimatedNumber value={Number(m[1])} springOptions={{ bounce: 0, duration: 1000 }} />{m[2]}</>
}

export function StatCard({ icon, label, value, tone, hint }) {
  return (
    <Tilt rotationFactor={5} isRevese springOptions={{ stiffness: 260, damping: 26 }} className="h-full">
      <Card className="flex h-full items-center gap-4">
        <IconBlob icon={icon} tone={tone} size={54} />
        <div className="min-w-0">
          <div className="text-sm font-bold text-muted">{label}</div>
          <div className="text-3xl font-black leading-tight text-ink"><AnimatedValue value={value} /></div>
          {hint && <div className="truncate text-xs font-semibold text-muted">{hint}</div>}
        </div>
      </Card>
    </Tilt>
  )
}

/** Word-by-word reveal for plain-string text (Motion Primitives TextEffect). */
export const AnimatedText = ({ children, as = 'span', className, preset = 'fade-in-blur', per = 'word', delay = 0 }) =>
  typeof children === 'string' ? (
    <TextEffect as={as} className={className} preset={preset} per={per} delay={delay} speedReveal={1.4}>{children}</TextEffect>
  ) : (
    (() => { const Tag = as; return <Tag className={className}>{children}</Tag> })()
  )

export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
      <AnimatedText as="h1" className="text-2xl font-black tracking-tight text-ink sm:text-3xl">{title}</AnimatedText>
      {subtitle && <AnimatedText as="p" preset="fade" delay={0.15} className="mt-1 text-sm font-semibold text-muted">{subtitle}</AnimatedText>}
    </div>
    {actions && (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-wrap items-center gap-3">
        {actions}
      </motion.div>
    )}
  </div>
)

export const SectionTitle = ({ children, action }) => (
  <div className="mb-4 flex items-center justify-between gap-3">
    <h2 className="text-lg font-black text-ink">{children}</h2>
    {action}
  </div>
)

/** Segmented tabs with a sliding clay pill (Motion Primitives AnimatedBackground). */
export function Tabs({ tabs, active, onChange, className }) {
  return (
    <div className={cx('clay-inset inline-flex max-w-full gap-1 overflow-x-auto p-1.5', className)}>
      <AnimatedBackground
        defaultValue={active}
        onValueChange={(id) => id && id !== active && onChange(id)}
        className="clay-sm !rounded-2xl"
        transition={spring}
      >
        {tabs.map((t) => {
          const key = typeof t === 'string' ? t : t.key
          const label = typeof t === 'string' ? t : t.label
          return (
            <button key={key} data-id={key} type="button" className="tab data-[checked=true]:text-accent">
              {label}
            </button>
          )
        })}
      </AnimatedBackground>
    </div>
  )
}

/** Animated tab content (Motion Primitives TransitionPanel). `children` = one panel per tab, in order. */
export const TabPanels = ({ index, children, className }) => (
  <TransitionPanel
    className={className}
    activeIndex={Math.max(0, index)}
    transition={{ duration: 0.3, ease: 'easeOut' }}
    variants={{
      enter: { opacity: 0, y: 16, filter: 'blur(4px)' },
      center: { opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } },
      exit: { opacity: 0, y: -10, filter: 'blur(4px)' },
    }}
  >
    {children}
  </TransitionPanel>
)

export function Modal({ open, onClose, title, children, width = 'max-w-lg', footer }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Portal to <body> so animated (transformed/filtered) ancestors can't trap position: fixed
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal"
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/30 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.div
            className={cx('clay my-8 w-full', width)}
            initial={{ opacity: 0, y: 24, scale: 0.96, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 12, scale: 0.97, filter: 'blur(4px)' }}
            transition={spring}
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between gap-3 px-6 pt-6">
              <AnimatedText as="h3" className="text-xl font-black text-ink">{title}</AnimatedText>
              <IconButton icon={X} label="Close" onClick={onClose} />
            </div>
            <div className="px-6 py-5">{children}</div>
            {footer && <div className="flex justify-end gap-3 px-6 pb-6">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function ConfirmDialog({ open, title = 'Are you sure?', message, confirmLabel = 'Delete', onConfirm, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button tone="rose" onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-sm font-semibold text-muted">{message}</p>
    </Modal>
  )
}

export const Field = ({ label, required, error, children, className, hint }) => (
  <label className={cx('block', className)}>
    <span className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-muted">
      {label} {required && <span className="text-rose">*</span>}
    </span>
    {children}
    <AnimatePresence initial={false}>
      {hint && !error && <span className="mt-1.5 block text-xs font-semibold text-muted">{hint}</span>}
      {error && (
        <motion.span key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0, x: [0, -4, 4, -2, 0] }} exit={{ opacity: 0 }} className="mt-1.5 block text-xs font-bold text-rose">
          {error}
        </motion.span>
      )}
    </AnimatePresence>
  </label>
)

/**
 * Wraps every form field: on focus a cobalt light runs around the border
 * (Motion Primitives BorderTrail).
 */
export function FieldShell({ children, className }) {
  const [focused, setFocused] = useState(false)
  return (
    <div className={cx('relative rounded-2xl', className)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
      {children}
      <AnimatePresence>
        {focused && (
          <motion.div className="pointer-events-none absolute inset-0 rounded-2xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <BorderTrail size={64} className="bg-linear-to-l from-[#2f6fd0] via-accent to-[#0a0a0a]" transition={{ repeat: Infinity, duration: 4, ease: 'linear' }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export const Input = ({ className, shellClassName, ...p }) => (
  <FieldShell className={shellClassName}><input className={cx('input', className)} {...p} /></FieldShell>
)
export const Textarea = ({ className, shellClassName, ...p }) => (
  <FieldShell className={shellClassName}><textarea className={cx('input block min-h-24 resize-y', className)} {...p} /></FieldShell>
)
export const Select = ({ className, shellClassName, options = [], placeholder, ...p }) => (
  <FieldShell className={shellClassName}>
    <select className={cx('input cursor-pointer appearance-none bg-no-repeat pr-10', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%235b6474' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")", backgroundPosition: 'right 14px center' }} {...p}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (typeof o === 'string' ? <option key={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  </FieldShell>
)

export const Switch = ({ checked, onChange, label }) => (
  <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cx('switch', checked && 'on')}>
    <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
  </button>
)

export const Chip = ({ active, children, onClick, tone = 'primary' }) => (
  <motion.button
    type="button"
    layout
    whileTap={{ scale: 0.92 }}
    onClick={onClick}
    className={cx('rounded-2xl px-3.5 py-2 text-xs font-extrabold transition-colors cursor-pointer', active ? `clay-tone tone-${tone}` : 'clay-sm text-muted hover:text-ink')}
  >
    {children}
  </motion.button>
)

export const Empty = ({ icon: Icon = Inbox, title = 'Nothing here yet', text, action }) => (
  <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center gap-3 py-12 text-center">
    <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}>
      <IconBlob icon={Icon} tone="muted" size={64} soft />
    </motion.div>
    <div className="text-base font-black text-ink">{title}</div>
    {text && <p className="max-w-xs text-sm font-semibold text-muted">{text}</p>}
    {action}
  </motion.div>
)
