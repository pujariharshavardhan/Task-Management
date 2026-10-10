import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { AnimatePresence, motion, useAnimate } from 'motion/react'
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Button, Modal } from '../components/ui'
import { SITE } from '../config/site'
import { rhf } from '../lib/validate'
import { usePageMeta } from '../lib/seo'
import { BorderTrail } from '../components/motion-primitives/border-trail'
import { GlowEffect } from '../components/motion-primitives/glow-effect'
import { TextEffect } from '../components/motion-primitives/text-effect'
import { TextLoop } from '../components/motion-primitives/text-loop'
import { TextShimmer } from '../components/motion-primitives/text-shimmer'
import { Tilt } from '../components/motion-primitives/tilt'

function AuthField({ icon: Icon, error, right, ...p }) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <div className="auth-field rounded-[14px]" onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
        <Icon size={17} fill="currentColor" strokeWidth={1.5} />
        <input className="auth-input" {...p} />
        {right && <div className="absolute top-1/2 right-3 z-10 -translate-y-1/2">{right}</div>}
        <AnimatePresence>
          {focused && (
            <motion.div className="pointer-events-none absolute inset-0 rounded-[14px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <BorderTrail size={70} className="bg-linear-to-l from-[#2f6fd0] via-[#0047ab] to-[#0a0a0a]" transition={{ repeat: Infinity, duration: 4, ease: 'linear' }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {error && (
          <motion.span key={error} className="auth-error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0, x: [0, -4, 4, -2, 0] }} exit={{ opacity: 0 }}>
            {error}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

function PasswordField({ registration, error, placeholder = 'Password' }) {
  const [show, setShow] = useState(false)
  return (
    <AuthField
      icon={Lock}
      type={show ? 'text' : 'password'}
      placeholder={placeholder}
      autoComplete="current-password"
      error={error}
      {...registration}
      right={
        <button type="button" onClick={() => setShow(!show)} className="cursor-pointer p-1 text-[#9ca3af] hover:text-[#0a0a0a]" aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      }
    />
  )
}

function SubmitButton({ loading, label, loadingLabel, className }) {
  return (
    <div className={`relative ${className}`}>
      <GlowEffect colors={['#0047ab', '#2f6fd0', '#0a0a0a', '#002e6e']} mode="colorShift" blur="strong" duration={4} className="rounded-[14px] opacity-30" />
      <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.97 }} className="auth-btn relative">
        {loading ? <TextShimmer as="span" duration={1.2} className="[--base-color:#5b6474] [--base-gradient-color:#0047ab]">{loadingLabel}</TextShimmer> : label}
      </motion.button>
    </div>
  )
}

/**
 * Shared clay disc for /login and /register (stays mounted across both routes).
 * Switching pages spins only the circle's rim a full 360° — the form itself never rotates:
 * it fades out during the first half-turn and the other form fades in during the second.
 */
export function AuthLayout() {
  const { pathname } = useLocation()
  const outlet = useOutlet()
  const [shown, setShown] = useState({ path: pathname, el: outlet })
  const [ringScope, animate] = useAnimate()
  const angle = useRef(0)
  const run = useRef(0)
  const target = useRef(pathname)
  const formRef = useRef(null)

  useEffect(() => {
    // React StrictMode runs effects twice in development; only start one spin per route change
    if (pathname === target.current) return
    target.current = pathname
    const id = ++run.current
    const next = { path: pathname, el: outlet }
    const start = angle.current
    angle.current = start + 360
    animate(ringScope.current, { rotate: start + 360 }, { duration: 1, ease: [0.65, 0, 0.35, 1] })
    ;(async () => {
      await animate(formRef.current, { opacity: 0, filter: 'blur(6px)', scale: 0.96 }, { duration: 0.45, ease: 'easeIn' })
      if (id !== run.current) return
      setShown(next)
      await animate(formRef.current, { opacity: 1, filter: 'blur(0px)', scale: 1 }, { duration: 0.5, ease: 'easeOut' })
      if (formRef.current) formRef.current.style.filter = 'none'
    })()
  }, [pathname])

  return (
    <main id="main" className="auth-page">
      <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.25, duration: 0.8 }}>
        <Tilt rotationFactor={4} isRevese springOptions={{ stiffness: 200, damping: 24 }}>
          <div className="auth-disc">
            <div ref={ringScope} className="auth-spin" aria-hidden="true" />
            <div className="auth-face">
              <div ref={formRef} className="w-full">{shown.el}</div>
            </div>
          </div>
        </Tilt>
      </motion.div>
      <nav aria-label="Legal" className="auth-foot mt-8 flex gap-5">
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/terms">Terms &amp; Conditions</Link>
        <Link to="/testimonials">User Reviews</Link>
      </nav>
    </main>
  )
}

function AuthShell({ title, subtitle, children }) {
  return (
    <>
      <TextEffect as="h1" per="char" preset="blur" className="auth-title" speedReveal={1.6}>{title}</TextEffect>
      <div className="auth-sub">{subtitle}</div>
      {children}
    </>
  )
}

function FormError({ message }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p key={message} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0, x: [0, -5, 5, -2, 0] }} exit={{ opacity: 0 }} className="auth-error !m-0 text-center" role="alert">
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

function ForgotPasswordDialog({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Reset your password" width="max-w-md" footer={<Button onClick={onClose}>Got it</Button>}>
      <div className="flex flex-col gap-3 text-sm font-semibold text-muted">
        <p>For security, passwords are reset by your administrator — email delivery is not enabled on this server.</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>If a project owner invited you, ask them to re-invite you; you will get a new one-time password.</li>
          <li>Otherwise contact <a className="font-bold text-accent hover:underline" href={`mailto:${SITE.contactEmail}?subject=APMS%20password%20reset`}>{SITE.contactEmail}</a> from your account email.</li>
        </ul>
        <p>Once signed in, you can change your password any time in <b className="text-ink">Settings → Security</b>.</p>
      </div>
    </Modal>
  )
}

export function Login() {
  const [forgot, setForgot] = useState(false)
  usePageMeta({ title: 'Sign in', description: 'Sign in to APMS to plan, track and review your academic projects, tasks, milestones and team.', noindex: false, path: '/login' })
  const { login } = useApp()
  const navigate = useNavigate()
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm()

  const submit = async (d) => {
    try {
      await login(d.email.trim(), d.password)
      navigate('/dashboard')
    } catch (e) {
      setError('root', { message: e.message })
    }
  }

  return (
    <AuthShell
      title="Login"
      subtitle={
        <TextLoop interval={2.6} className="justify-center">
          <span>Welcome back to APMS</span>
          <span>Plan your academic projects</span>
          <span>Track every deadline</span>
          <span>Review your team's progress</span>
        </TextLoop>
      }
    >
      <form onSubmit={handleSubmit(submit)} noValidate className="mt-8 flex flex-col gap-4">
        <AuthField icon={Mail} type="email" placeholder="Email" autoComplete="email" error={errors.email?.message}
          {...register('email', { required: 'Email is required', ...rhf.email })} />
        <PasswordField error={errors.password?.message}
          registration={register('password', { required: 'Password is required' })} />
        <div className="-mt-1 text-right text-xs"><button type="button" className="auth-link -my-1 inline-block py-1" onClick={() => setForgot(true)}>Forgot password?</button></div>
        <FormError message={errors.root?.message} />
        <SubmitButton loading={isSubmitting} label="Login" loadingLabel="Logging in…" className="mt-2" />
        <p className="auth-foot mt-1">Don't have an account? <Link to="/register">Sign Up</Link></p>
        <ForgotPasswordDialog open={forgot} onClose={() => setForgot(false)} />
      </form>
    </AuthShell>
  )
}

export function Register() {
  usePageMeta({ title: 'Create your account', description: 'Create a free APMS account to manage academic projects, student teams, deadlines and mentor reviews.', noindex: false, path: '/register' })
  const { register: signUp } = useApp()
  const navigate = useNavigate()
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm()

  const submit = async (d) => {
    try {
      await signUp(d.name.trim(), d.email.trim(), d.password)
      navigate('/dashboard')
    } catch (e) {
      setError('root', { message: e.message })
    }
  }

  return (
    <AuthShell title="Sign Up" subtitle={<TextEffect per="word" preset="fade" delay={0.3}>Create your account</TextEffect>}>
      <form onSubmit={handleSubmit(submit)} noValidate className="mt-8 flex flex-col gap-4">
        <AuthField icon={User} placeholder="Full name" autoComplete="name" error={errors.name?.message}
          {...register('name', { required: 'Name is required', maxLength: { value: 120, message: 'Name must be 120 characters or fewer' } })} />
        <AuthField icon={Mail} type="email" placeholder="Email" autoComplete="email" error={errors.email?.message}
          {...register('email', { required: 'Email is required', ...rhf.email })} />
        <PasswordField error={errors.password?.message} placeholder="Password (8+ chars, letter & number)"
          registration={register('password', { required: 'Password is required', ...rhf.password })} />
        <FormError message={errors.root?.message} />
        <SubmitButton loading={isSubmitting} label="Create Account" loadingLabel="Creating…" className="mt-3" />
        <p className="auth-foot mt-1">Already have an account? <Link to="/login">Login</Link></p>
        <p className="auth-foot -mt-2 text-[0.72rem]">By creating an account you agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.</p>
      </form>
    </AuthShell>
  )
}
