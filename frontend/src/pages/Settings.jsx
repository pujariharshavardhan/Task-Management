import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Save, Camera, LogOut } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { check, rules } from '../lib/validate'
import { usePageMeta } from '../lib/seo'
import { Avatar, Button, Card, Field, Input, PageHeader, SectionTitle, Stagger, Switch, TabPanels, Tabs } from '../components/ui'
import { cx } from '../lib/utils'

const NOTIF = [
  ['deadline', 'Task deadline tomorrow'],
  ['assigned', 'New task assigned'],
  ['project_deadline', 'Project deadline approaching'],
  ['comment', 'New comment'],
  ['completed', 'Task completed'],
  ['milestone', 'Milestone updated'],
  ['document', 'New document uploaded'],
  ['review', 'Review scheduled'],
]
const TONES = ['primary', 'mint', 'pink', 'sky', 'peach', 'sun']

export default function Settings() {
  usePageMeta({ title: 'Settings', description: 'Manage your profile, notification preferences and password.' })
  const { me, updateProfile, changePassword, logout, toast } = useApp()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'Profile'
  const [profile, setProfile] = useState({ name: me.name, email: me.email, title: me.title || '', tone: me.tone || 'primary' })
  const [prefs, setPrefs] = useState(() => Object.fromEntries(NOTIF.map(([k]) => [k, { app: me.notificationPrefs?.[k]?.app !== false }])))
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [profileErrors, setProfileErrors] = useState({})
  const [pwErrors, setPwErrors] = useState({})
  const saveProfile = async () => {
    const errs = check(profile, { name: [rules.required('Full name'), rules.max(120, 'Full name')], title: [rules.max(120, 'Title')] })
    setProfileErrors(errs)
    if (Object.keys(errs).length) return
    if (await updateProfile({ name: profile.name.trim(), title: profile.title.trim(), tone: profile.tone })) toast('Profile updated')
  }
  const savePassword = async (e) => {
    e.preventDefault()
    const errs = check(pw, {
      current: [rules.required('Current password')],
      next: [rules.required('New password'), rules.password()],
      confirm: [rules.required('Confirm password'), rules.matches('next', 'Passwords do not match')],
    })
    setPwErrors(errs)
    if (Object.keys(errs).length) return
    if (await changePassword(pw.current, pw.next)) setPw({ current: '', next: '', confirm: '' })
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" subtitle="Manage your profile, notifications and security." />
      <Tabs tabs={['Profile', 'Notifications', 'Security']} active={tab} onChange={(t) => setParams({ tab: t })} className="mb-6" />

      <TabPanels index={['Profile', 'Notifications', 'Security'].indexOf(tab)}>
        <Card className="!p-7">
          <div className="mb-7 flex flex-wrap items-center gap-5">
            <div className="relative">
              <Avatar user={{ ...me, ...profile }} size={88} />
              <button type="button" onClick={() => setProfile({ ...profile, tone: TONES[(TONES.indexOf(profile.tone) + 1) % TONES.length] })} className="clay-sm absolute -right-1 -bottom-1 grid h-9 w-9 cursor-pointer place-items-center !rounded-full text-muted hover:text-accent" aria-label="Change avatar color" title="Change avatar color"><Camera size={16} /></button>
            </div>
            <div>
              <div className="text-xl font-black text-ink">{profile.name}</div>
              <div className="text-sm font-semibold text-muted">{me.role}</div>
              <div className="mt-3 flex gap-2">
                {TONES.map((t) => (
                  <button key={t} onClick={() => setProfile({ ...profile, tone: t })} className={cx('clay-tone h-7 w-7 cursor-pointer !rounded-full', `tone-${t}`, profile.tone === t && 'ring-4 ring-accent-soft')} aria-label={`Avatar color ${t}`} />
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name" required error={profileErrors.name}><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={profile.email} disabled className="opacity-70" /></Field>
            <Field label="Title" error={profileErrors.title}><Input value={profile.title} onChange={(e) => setProfile({ ...profile, title: e.target.value })} /></Field>
            <Field label="Role"><Input value={me.role} disabled className="opacity-70" /></Field>
          </div>
          <div className="mt-6 flex justify-end"><Button icon={Save} onClick={saveProfile}>Save Changes</Button></div>
        </Card>
        <Card className="!p-7">
          <SectionTitle>Notification Preferences</SectionTitle>
          <div className="mb-2 grid grid-cols-[1fr_70px] px-2 text-xs font-black tracking-wide text-muted uppercase"><span>Event</span><span className="text-center">In-app</span></div>
          <Stagger stagger={0.04} className="flex flex-col gap-1">
            {NOTIF.map(([k, label]) => (
              <div key={k} className="row-hover grid grid-cols-[1fr_70px] items-center rounded-2xl px-2 py-3">
                <span className="text-sm font-bold text-ink">{label}</span>
                <span className="grid place-items-center"><Switch label={`${label} in-app`} checked={prefs[k].app} onChange={(v) => setPrefs({ ...prefs, [k]: { ...prefs[k], app: v } })} /></span>
              </div>
            ))}
          </Stagger>
          <div className="mt-6 flex justify-end"><Button icon={Save} onClick={async () => { if (await updateProfile({ notificationPrefs: prefs })) toast('Preferences saved') }}>Save Preferences</Button></div>
        </Card>
        <div className="flex flex-col gap-6">
          <Card className="!p-7">
            <SectionTitle>Change Password</SectionTitle>
            <form onSubmit={savePassword} noValidate className="grid gap-4 sm:grid-cols-3">
              <Field label="Current Password" required error={pwErrors.current}><Input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
              <Field label="New Password" required error={pwErrors.next} hint="At least 8 characters, with a letter and a number"><Input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
              <Field label="Confirm Password" required error={pwErrors.confirm}><Input type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
              <div className="flex justify-end sm:col-span-3"><Button type="submit">Update Password</Button></div>
            </form>
          </Card>
          <Card className="flex flex-wrap items-center justify-between gap-4 !p-7">
            <div><div className="font-black text-ink">Sign out</div><div className="text-sm font-semibold text-muted">End your session on this device.</div></div>
            <Button tone="rose" icon={LogOut} onClick={logout}>Log out</Button>
          </Card>
        </div>
      </TabPanels>



    </div>
  )
}
