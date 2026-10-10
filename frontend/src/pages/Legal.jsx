import { Link } from 'react-router-dom'
import { Card } from '../components/ui'
import PublicShell from '../components/PublicShell'
import { SITE } from '../config/site'
import { fmtDate } from '../lib/utils'
import { usePageMeta } from '../lib/seo'

function LegalDoc({ title, intro, sections }) {
  return (
    <PublicShell>
      <Card className="!p-6 sm:!p-10">
        <h1 className="text-3xl font-black tracking-tight text-ink">{title}</h1>
        <p className="mt-2 text-sm font-semibold text-muted">Last updated {fmtDate(SITE.legalUpdated)}</p>
        <p className="mt-5 leading-relaxed font-semibold text-ink">{intro}</p>
        <nav aria-label="Contents" className="clay-inset mt-6 p-4">
          <ol className="grid list-decimal gap-1 pl-5 text-sm font-bold text-accent sm:grid-cols-2">
            {sections.map((s) => <li key={s.id}><a href={`#${s.id}`} className="hover:underline">{s.title}</a></li>)}
          </ol>
        </nav>
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="mt-8 scroll-mt-6">
            <h2 className="text-xl font-black text-ink">{i + 1}. {s.title}</h2>
            <div className="mt-3 flex flex-col gap-3 leading-relaxed font-semibold text-ink/90 [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">{s.body}</div>
          </section>
        ))}
      </Card>
    </PublicShell>
  )
}

const contact = <a href={`mailto:${SITE.contactEmail}`} className="font-bold text-accent hover:underline">{SITE.contactEmail}</a>

export function PrivacyPolicy() {
  usePageMeta({ title: 'Privacy Policy', description: `How ${SITE.name} collects, uses, stores and protects your personal data and project content.`, noindex: false, path: '/privacy' })
  return (
    <LegalDoc
      title="Privacy Policy"
      intro={`This policy explains what personal data ${SITE.organization} collects when you use ${SITE.fullName} (“${SITE.name}”, “the service”), why we collect it, and the choices you have.`}
      sections={[
        { id: 'data-we-collect', title: 'Data we collect', body: <>
          <ul>
            <li><b>Account data</b> — your name, email address and password. Passwords are stored only as a salted bcrypt hash; we never see or store the plain password.</li>
            <li><b>Profile data</b> — your job title, avatar colour and notification preferences.</li>
            <li><b>Project content</b> — projects, tasks, checklists, comments, milestones, calendar events, discussions, academic reviews and the files you upload.</li>
            <li><b>Activity data</b> — an audit log of actions in a project (for example “Rahul completed Login API”) and the notifications generated from them.</li>
            <li><b>Technical data</b> — IP address and request details in server logs, used for security and troubleshooting.</li>
          </ul>
        </> },
        { id: 'how-we-use', title: 'How we use your data', body: <>
          <p>We use your data only to run the service: to sign you in, show your projects to the people you work with, send in-app notifications, generate reports and keep the service secure.</p>
          <p>We do not sell your data, show advertising, or use third-party analytics or tracking.</p>
        </> },
        { id: 'sharing', title: 'Who can see your data', body: <>
          <p>Project content is visible to the members of that project according to their role (owner, manager, member, mentor or viewer). Your name and email are visible to people who share a project with you.</p>
          <p>We use these service providers to operate {SITE.name}:</p>
          <ul>
            <li><b>Database hosting</b> — Neon (serverless PostgreSQL) stores account and project data.</li>
            <li><b>File storage</b> — uploaded files are stored on our server or in S3-compatible object storage.</li>
          </ul>
          <p>We disclose data to authorities only when required by law.</p>
        </> },
        { id: 'cookies', title: 'Cookies and local storage', body: <>
          <p>{SITE.name} does not use cookies. After you sign in, a session token is kept in your browser’s local storage so you stay signed in; it is removed when you log out. A few display preferences (such as a collapsed sidebar) are also kept there.</p>
        </> },
        { id: 'retention', title: 'How long we keep data', body: <>
          <p>We keep your data while your account is active. When a project is deleted, its tasks, files, comments and activity are deleted with it. When your account is closed we delete or anonymise your personal data within 30 days, except where we must keep it by law.</p>
        </> },
        { id: 'security', title: 'Security', body: <>
          <p>All traffic is encrypted with HTTPS. Access to every project is checked on the server for each request, sign-in attempts are rate-limited, and uploads are size- and type-checked. No system is perfectly secure; tell us at {contact} if you find a problem.</p>
        </> },
        { id: 'your-rights', title: 'Your rights', body: <>
          <p>You can view and update your profile in <b>Settings</b> at any time. You can ask us to give you a copy of your data, correct it, or delete your account by writing to {contact}. We answer within 30 days.</p>
        </> },
        { id: 'students', title: 'Students and institutions', body: <>
          <p>{SITE.name} is used for academic work. Where an institution creates accounts for its students, the institution is responsible for informing them and, where required, obtaining consent.</p>
        </> },
        { id: 'changes', title: 'Changes to this policy', body: <>
          <p>We will post any change on this page and update the date above. For significant changes we will also notify you in the app.</p>
        </> },
        { id: 'contact', title: 'Contact', body: <p>Questions about privacy: {contact}. See also our <Link to="/terms" className="font-bold text-accent hover:underline">Terms &amp; Conditions</Link>.</p> },
      ]}
    />
  )
}

export function Terms() {
  usePageMeta({ title: 'Terms & Conditions', description: `The terms that apply when you create an account and use ${SITE.name} to manage academic projects.`, noindex: false, path: '/terms' })
  return (
    <LegalDoc
      title="Terms & Conditions"
      intro={`These terms apply when you create an account on or use ${SITE.fullName} (“${SITE.name}”), provided by ${SITE.organization}. By creating an account you agree to them.`}
      sections={[
        { id: 'accounts', title: 'Your account', body: <>
          <ul>
            <li>Give accurate information and keep your password secret. You are responsible for activity under your account.</li>
            <li>Tell us straight away at {contact} if you think your account has been used without permission.</li>
            <li>Accounts created for you by a project owner use a one-time password; change it after your first sign-in.</li>
          </ul>
        </> },
        { id: 'acceptable-use', title: 'Acceptable use', body: <>
          <p>You agree not to:</p>
          <ul>
            <li>upload malware, illegal content, or material you do not have the right to share;</li>
            <li>try to access projects, accounts or data you have not been given access to;</li>
            <li>overload, probe or disrupt the service, or bypass its security or rate limits;</li>
            <li>use the service to harass others or to commit academic misconduct such as plagiarism.</li>
          </ul>
        </> },
        { id: 'content', title: 'Your content', body: <>
          <p>You keep ownership of everything you add — projects, tasks, comments, files and reviews. You give {SITE.organization} permission to store, process and display that content only as needed to provide the service to you and your project members.</p>
          <p>Project owners decide who can see a project and can remove members or delete the project at any time.</p>
        </> },
        { id: 'reviews', title: 'Academic reviews', body: <>
          <p>Scores and feedback entered by mentors and guides are their own assessment. {SITE.organization} does not verify or change them, and they are not an official transcript unless your institution says so.</p>
        </> },
        { id: 'availability', title: 'Availability and changes', body: <>
          <p>We work to keep {SITE.name} available but do not guarantee it will be uninterrupted or error-free. We may change, add or remove features, and will give notice of changes that significantly affect you.</p>
        </> },
        { id: 'termination', title: 'Suspension and closing accounts', body: <>
          <p>You can stop using the service at any time and ask us to delete your account. We may suspend accounts that break these terms or put the service or other users at risk.</p>
        </> },
        { id: 'liability', title: 'Disclaimer and liability', body: <>
          <p>The service is provided “as is”. To the extent permitted by law, {SITE.organization} is not liable for indirect or consequential losses, or for loss of data you could have avoided by keeping your own copies. Nothing in these terms limits liability that cannot be limited by law.</p>
        </> },
        { id: 'privacy', title: 'Privacy', body: <p>How we handle personal data is described in our <Link to="/privacy" className="font-bold text-accent hover:underline">Privacy Policy</Link>.</p> },
        { id: 'contact', title: 'Contact', body: <p>Questions about these terms: {contact}.</p> },
      ]}
    />
  )
}
