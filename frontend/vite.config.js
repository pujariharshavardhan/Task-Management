import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Preload the Latin web fonts used above the fold, so text renders in its final font on the
 * first paint (no reflow/layout shift when the font swaps in). File names are content-hashed,
 * so the links are added after the bundle is written.
 */
function preloadFonts() {
  const WANTED = [/nunito-latin-wght-normal/, /poppins-latin-(500|700|800)-normal/]
  return {
    name: 'apms-preload-fonts',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const files = Object.keys(ctx.bundle || {}).filter((f) => f.endsWith('.woff2') && WANTED.some((rx) => rx.test(f)))
        const links = files.map((f) => `    <link rel="preload" href="/${f}" as="font" type="font/woff2" crossorigin />`).join('\n')
        return html.replace('</head>', `${links}\n  </head>`)
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadFonts()],
  resolve: {
    // Motion Primitives components import from "@/lib/utils"
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173 },
})
