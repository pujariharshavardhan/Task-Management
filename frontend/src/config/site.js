// Site-wide settings used by the legal pages, SEO tags and footer.
// Override per deployment with VITE_* variables in frontend/.env.
export const SITE = {
  name: 'APMS',
  fullName: 'Academic Project Management System',
  description: 'Plan, track and review academic projects: teams, tasks, milestones, deadlines, documents, mentor reviews and reports in one place.',
  url: (import.meta.env.VITE_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, ''),
  organization: import.meta.env.VITE_ORG_NAME || 'APMS',
  contactEmail: import.meta.env.VITE_CONTACT_EMAIL || 'support@apms.example',
  legalUpdated: '2026-10-05',
}
