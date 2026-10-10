// Generates public/sitemap.xml and public/robots.txt before every build.
// Set SITE_URL (or VITE_SITE_URL) to the public https address, e.g. SITE_URL=https://apms.example.com npm run build
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Read VITE_SITE_URL from frontend/.env too, so the address is configured in one place
const envFile = fileURLToPath(new URL('../.env', import.meta.url))
const fromEnvFile = existsSync(envFile) ? (readFileSync(envFile, 'utf8').match(/^\s*VITE_SITE_URL\s*=\s*(.+)\s*$/m) || [])[1] : undefined
const site = (process.env.SITE_URL || process.env.VITE_SITE_URL || fromEnvFile || 'http://localhost:8001').trim().replace(/^["']|["']$/g, '').replace(/\/$/, '')
const today = new Date().toISOString().slice(0, 10)
const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url))

// Only public pages belong in the sitemap; everything else needs a login and holds private data.
const pages = [
  { path: '/login', priority: '1.0', changefreq: 'monthly' },
  { path: '/register', priority: '0.9', changefreq: 'monthly' },
  { path: '/testimonials', priority: '0.8', changefreq: 'weekly' },
  { path: '/privacy', priority: '0.4', changefreq: 'yearly' },
  { path: '/terms', priority: '0.4', changefreq: 'yearly' },
]

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url>
    <loc>${site}${p.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>
`

const privateRoutes = ['/dashboard', '/projects', '/tasks', '/calendar', '/team', '/documents', '/reviews', '/reports', '/notifications', '/discussions', '/settings', '/api/']
const robots = `# APMS — ${site}
User-agent: *
${pages.map((p) => `Allow: ${p.path}`).join('\n')}
${privateRoutes.map((r) => `Disallow: ${r}`).join('\n')}

Sitemap: ${site}/sitemap.xml
`

writeFileSync(out('sitemap.xml'), sitemap)
writeFileSync(out('robots.txt'), robots)
console.log(`sitemap.xml + robots.txt written for ${site} (${pages.length} public pages)`)
