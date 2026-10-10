import { useEffect } from 'react'
import { SITE } from '../config/site'

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.rel = 'canonical'
    document.head.appendChild(el)
  }
  el.href = href
}

/**
 * Per-page <title>, meta description, Open Graph / Twitter tags, canonical URL and robots.
 * Pages behind login are `noindex` (private data); public pages are indexable.
 */
export function usePageMeta({ title, description = SITE.description, noindex = true, path }) {
  useEffect(() => {
    const full = title ? `${title} · ${SITE.name}` : `${SITE.name} · ${SITE.fullName}`
    const url = `${SITE.url}${path ?? window.location.pathname}`
    document.title = full
    setMeta('name', 'description', description)
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')
    setMeta('property', 'og:title', full)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:url', url)
    setMeta('name', 'twitter:title', full)
    setMeta('name', 'twitter:description', description)
    setCanonical(url)
  }, [title, description, noindex, path])
}
