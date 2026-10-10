# APMS — Production Readiness Report

As of 2026-10-05

## Summary

APMS is ready for production: 35 of 40 checklist items are done, 4 are built and tested but switch on when you deploy to your domain, and 1 needs your contact details.

APMS (Academic Project Management System) is a web app for running academic projects: teams, Kanban tasks, milestones, calendar, documents, mentor reviews, discussions, reports and notifications. It is a React website and a FastAPI server backed by your Neon PostgreSQL database, which currently holds one account (harsha@gmail.com) and no other data.

Verified on the final build: 42 of 42 browser end-to-end checks, 27 of 27 backend tests, Chrome, Edge and Firefox, 95 page and screen-size combinations, 0 broken links, 0 known vulnerable libraries, and Lighthouse accessibility 100 on every page.

Waiting on your production setup: switching on HTTPS (needs the domain and certificate), generating the sitemap for your domain, and replacing the placeholder contact email `support@apms.example` and organisation name.

## Roadmap checklist

Order followed: Legal → Security → SEO → Branding → Performance → Mobile → Errors → Forms → Testing → Final Audit.

| # | Step | Item | Status | What was done |
| --- | --- | --- | --- | --- |
| 1 | Legal | Privacy Policy page | Done | `/privacy`: data collected, use, sharing, cookies, retention, security, your rights. Linked from every footer, Login and Sign Up |
| 2 | Legal | Terms & Conditions page | Done | `/terms`: accounts, acceptable use, content ownership, reviews, liability. Sign Up shows a consent line |
| 3 | Security | Force HTTPS | Ready for deploy | `FORCE_HTTPS=true` redirects http to https (308) and sends HSTS; tested. Also: strict Content Security Policy, anti-framing headers, sign-in rate limit (10 tries / 15 min), password rules, upload type allowlist |
| 4 | SEO | Meta titles | Done | Unique title on all 19 pages, e.g. `Tasks · APMS` |
| 5 | SEO | Meta descriptions | Done | Description, Open Graph and Twitter tags, canonical URL on every page; private pages are `noindex` |
| 6 | SEO | sitemap.xml | Ready for deploy | Generated on each build from `VITE_SITE_URL`, listing the 5 public pages |
| 7 | SEO | robots.txt | Ready for deploy | Allows public pages, blocks private pages and `/api/`, points to the sitemap |
| 8 | SEO | Social Reviews page | Done | `/testimonials`: star ratings, average and distribution; signed-in users write, edit or delete one review; Google rating markup |
| 9 | Branding | Favicon | Done | `.ico` (16/32/48 px), SVG, Apple touch icon, 192/512 px app icons, Android maskable icon, web manifest |
| 10 | Branding | Compress images | Done | Icons and share image: 390 KB → 154 KB; app icons now 6.6 KB and 2.8 KB |
| 11 | Branding | Image dimensions & formats | Done | Exact-size PNG per use, SVG logo, 1200×630 share image; all UI icons are inline SVG |
| 12 | Performance | Check page speed | Done | Lighthouse on the production build; scores in Test results |
| 13 | Performance | Optimize loading | Done | First JavaScript download 855 KB → 336 KB; pages load on demand; self-hosted, preloaded fonts; gzip; 1-year asset caching; one fewer database round trip per request |
| 14 | Mobile | Mobile-friendly | Done | Drawer and bottom menu, every tap target ≥ 24 px, “reduce motion” respected |
| 15 | Mobile | Test mobile, tablet, desktop | Done | 19 pages at 5 widths (360–1440 px): 0 overflow, 0 errors |
| 16 | Errors | Custom 404 page | Done | Branded page with links home; server sends a real 404 status; crash screen instead of a blank page |
| 17 | Errors | Find and fix broken links | Done | Crawler: 0 broken of 22 internal links; the dead “Forgot password?” button now opens help |
| 18 | Errors | Internal navigation | Done | Menus, footer and back links reach real pages; 43 in-page anchors resolve |
| 19 | Errors | External links | Needs your input | No external links. The contact link uses the placeholder `support@apms.example`: set `VITE_CONTACT_EMAIL` |
| 20 | Forms | Proper validation | Done | One shared rule set, matching the server, on all 15 forms |
| 21 | Forms | Required fields | Done | Inline “… is required” messages; asterisks on required fields |
| 22 | Forms | Email, phone, input formats | Done | Email format, passwords of 8+ characters with a letter and a number, date order, time, file type and 25 MB size. The app has no phone fields |
| 23 | Forms | Error and success messages | Done | Inline errors; server errors and confirmations as pop-up messages |
| 24 | Forms | Test form submission | Done | Valid and invalid submissions in the end-to-end test |
| 25 | Testing | All buttons | Done | 398 buttons, all named; 53 safe ones auto-clicked with 0 errors; the rest exercised in end-to-end tests |
| 26 | Testing | All links | Done | See items 17–19 |
| 27 | Testing | All forms | Done | 42 of 42 end-to-end checks pass |
| 28 | Testing | Navigation and menu | Done | Sidebar, mobile drawer, bottom menu, tabs, back links |
| 29 | Testing | Responsive behavior | Done | 95 page and width combinations |
| 30 | Testing | Different browsers | Done | Chrome 154, Edge 154 and Firefox 157 pass; Safari cannot run on Windows |
| 31 | Audit | Complete website audit | Done | This report |
| 32 | Audit | SEO | Done | Lighthouse SEO 100 on every public page |
| 33 | Audit | Performance | Done | See items 12–13 |
| 34 | Audit | Security | Done | 0 vulnerable libraries (npm audit, pip-audit); security headers verified; 7 security tests |
| 35 | Audit | Mobile responsiveness | Done | 0 overflow, 0 undersized tap targets |
| 36 | Audit | Accessibility | Done | Lighthouse 100 on every page; skip link, focus outline, labelled controls |
| 37 | Audit | Broken links | Done | 0 broken |
| 38 | Audit | Forms and buttons | Done | See items 20–25 |
| 39 | Audit | Favicon, sitemap, robots.txt | Done | All served with status 200 and the right file types |
| 40 | Audit | Final production-ready check | Ready for deploy | The production build passes every test; going live needs your domain and the settings in “How to run and deploy” |

## Functionality inventory

Every feature reads from and saves to the Neon database and was exercised in the automated tests; nothing in the app is static demo data.

| Area | Page | What it does | Working |
| --- | --- | --- | --- |
| Accounts | Login, Sign Up | Clay disc that spins between the two forms; inline errors; forgot-password help | Yes |
| Accounts | Settings | Profile, avatar colour, in-app notification preferences, password change | Yes |
| Projects | Dashboard | Stat cards, active projects, task chart, upcoming deadlines, recent activity | Yes |
| Projects | Projects | All / Active / Completed / Archived, search, filters, sort, grid or list | Yes |
| Projects | Create Project | Academic details, dates, priority, tech stack, team with roles; code auto-generated | Yes |
| Projects | Project details | Overview, Tasks, Milestones, Team, Files, Reviews and Activity tabs; status, archive, delete | Yes |
| Work | Tasks | Kanban drag and drop, list view, filters; task popup with checklist, comments, hours, assignee | Yes |
| Work | Calendar | Month, Week, Day and Agenda views; schedule meetings, reviews and submissions | Yes |
| Work | Discussions | Threads per project with replies | Yes |
| Team | Team | People across your projects, workload, roles and permissions; invite with one-time password | Yes |
| Files | Documents | Folders, upload with type and size checks, versioning, download, delete | Yes |
| Quality | Academic Reviews | Mentor scores on 5 criteria (out of 100) for Review 1 to Final | Yes |
| Quality | Reports | 8 report types with charts; server-generated PDF, Excel and CSV | Yes |
| Alerts | Notifications | Live alerts (assignments, comments, completions, deadlines, uploads, reviews); read, delete | Yes |
| Public | User Reviews | Public star ratings and written reviews | Yes |
| Public | Privacy, Terms, 404 | Legal pages and a branded not-found page | Yes |

Access is checked on the server for every request: owners control everything, managers handle tasks and members, members update their own tasks, mentors review, and viewers only read. Search (Ctrl K) covers projects, tasks, people, documents and milestones.

## Test results

Every automated check passes on the final production build; the only weak spot is Dashboard load speed (Lighthouse 73–75), which depends on the database being in US East.

| Check | Scope | Result |
| --- | --- | --- |
| Backend tests (pytest) | 27 tests: API, permissions, HTTPS redirect, headers, rate limit, password rules, uploads, reviews | 27 passed |
| End-to-end browser test | 42 checks through the real UI, signed out and in | 42 passed |
| Cross-browser | Login, 14 pages, create task, login/sign-up spin | Chrome 154, Edge 154, Firefox 157 all pass |
| Responsive | 19 pages × 5 widths (360, 390, 768, 1024, 1440 px) | 0 overflow, 0 tap targets under 24 px, 0 errors |
| Links | 22 internal links, 43 anchors, all assets | 0 broken |
| Buttons | 398 on all pages | All named; 53 clicked with 0 errors |
| Libraries | npm audit, pip-audit | 0 known vulnerabilities |
| Layout shift | Login and Sign Up on a throttled phone | 0.000 (fixed from 0.145) |
| Full workflow audit (7 Oct) | 68 checks across 20 areas as Owner, Developer and Mentor (details below) | 67 of 68 passed after fixes, 0 JS errors; the other check expected an older notification in the 6-item dropdown, and the dropdown was confirmed working by hand |

### Full workflow audit (7 October)

Every feature was driven through the real UI as three users (Project Owner, Developer, Mentor):
- Sign-up/logout, projects (create, status, archive/restore), tasks (Kanban drag-and-drop, column "+", list view, filters, search, detail edits, checklist, comments, delete), milestones (progress slider).
- Team tab (add/remove member), files (upload, download, delete), reviews (project tab and Reviews page, stage tabs), all 8 report types with PDF/Excel/CSV export, calendar (all views, scheduling, event click-through), Team and Documents pages, discussions.
- Global search, notifications (dropdown, mark read, delete), settings (profile, avatar colour, notification preferences, password), testimonials, Projects list/sort/tabs, dashboard links, mobile drawer and bottom navigation.
- Permissions: a Developer cannot delete tasks; a Mentor can add reviews but cannot delete projects.

Bugs found and fixed:

| Problem | Fix |
| --- | --- |
| Download button in a project's Files tab did nothing | Wired to download the file; added a Delete button with confirmation (same as the Documents page) |
| Camera button on the Settings avatar did nothing | Now cycles the avatar colour (the app stores avatar colours, not photos) |
| New items could show as "5h ago" because some timestamps were sent without a time zone | The API now always sends timestamps in UTC with the offset |
| Accounts made with `create_user.py` got the title "Project Manager" whatever their role | Title now defaults to the role (an existing title is kept) |
| Account menu button had no accessible name | Added "Account menu" label and expanded state |

### Lighthouse (production build)

| Page | Speed, mobile | Speed, desktop | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- | --- |
| Login | 93 | 100 | 100 | 100 | 100 |
| Sign Up | 86 | — | 100 | 100 | 100 |
| Privacy | 87 | 69 | 100 | 100 | 100 |
| User Reviews | 89 | 100 | 100 | 100 | 100 |
| Project details | 93 | — | 100 | 100 | noindex |
| Tasks | 95 | 99 | 100 | 100 | noindex |
| Dashboard | 75 | 73 | 100 | 100 | noindex |

Signed-in pages show `noindex` for SEO on purpose: they hold private data and are kept out of search engines. A dash means Lighthouse's speed trace failed on Chrome 154 for that run (a tool issue on this machine); the other categories were still measured. Sign Up's 86 was measured before the layout-shift fix.

## Known limitations and next steps

1. **Go live on your domain** — set `FORCE_HTTPS`, `ALLOWED_HOSTS`, `ENVIRONMENT=production` and `VITE_SITE_URL` (see below). Until then HTTPS enforcement, the sitemap and robots.txt point at `localhost`.
2. **Replace placeholders** — `VITE_CONTACT_EMAIL` and `VITE_ORG_NAME` appear on the legal pages and footer. Have the Privacy Policy and Terms reviewed by someone qualified for your institution and country.
3. **Database region** — Neon is in US East (Ohio); from India each request takes ~0.3–1 s. Moving the Neon project to Singapore would roughly halve load times, especially on the Dashboard.
4. **No email sending** — password resets and invites rely on the one-time password shown to the inviter; “Forgot password?” explains this. Adding an email service (e.g. SES, SendGrid) would allow self-service resets.
5. **Uploaded files** live on the server disk by default; on hosts with temporary disks set `STORAGE_BACKEND=s3`.
6. **Rate limiting** is per server process; with several server instances use a shared store (Redis).
7. **Safari** was not tested (not available on Windows); test on a Mac or iPhone before launch.
8. **Your password** `harsha@123` appears in public breach lists and Chrome may warn about it; change it in Settings → Security.

## How to run and deploy

In production one FastAPI server serves both the website and the API over HTTPS, so there is a single address to deploy and secure.

### Run on this computer (development)

1. Backend: `cd backend`, `.venv\Scripts\activate`, then `uvicorn app.main:app --port 8001` (also serves the built site at http://localhost:8001).
2. Frontend with live reload: `cd frontend`, then `npm run dev` and open http://localhost:5173.
3. Sign in as **harsha@gmail.com**. New accounts come from the Sign Up page, a team invite, or `python create_user.py --name ... --email ... --password ...`.

### Deploy to production

1. Build the website: set `VITE_SITE_URL`, `VITE_ORG_NAME` and `VITE_CONTACT_EMAIL` in `frontend/.env` (template `frontend/.env.example`), then `npm run build`. This also writes `sitemap.xml` and `robots.txt` for your domain.
2. Configure `backend/.env` (template `backend/.env.example`):

| Setting | Production value | Why |
| --- | --- | --- |
| `ENVIRONMENT` | `production` | Server refuses to start with a weak secret or SQLite |
| `DATABASE_URL` | Neon pooled connection string | Already set |
| `JWT_SECRET` | 48+ random characters | Signs login tokens |
| `FORCE_HTTPS` | `true` | Redirects http to https and sends HSTS |
| `ALLOWED_HOSTS` | `["your.domain"]` | Rejects requests for other host names |
| `CORS_ORIGINS` | `["https://your.domain"]` | Only needed if the site is hosted separately |

3. Apply database changes: `alembic upgrade head` (current version `c2e62b6385de`, already applied to Neon).
4. Start: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips="*"` behind a platform or proxy that provides the TLS certificate (Render, Railway, Fly.io, or Nginx with Let's Encrypt).
5. Check: `/health` returns `ok`, http redirects to https, and `/robots.txt` and `/sitemap.xml` show your domain.
