// Thin client for the FastAPI backend (backend/app). JSON is camelCase both ways.
// Dev: the API runs on :8001. Production build: same origin (the backend serves the built app over HTTPS).
export const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8001/api/v1' : '/api/v1')).replace(/\/$/, '')

const TOKEN_KEY = 'apms_token'

export const token = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } },
  set: (t) => { try { localStorage.setItem(TOKEN_KEY, t) } catch { /* ignore */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ } },
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

function errorMessage(body, status) {
  const d = body?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d) && d.length) {
    const first = d[0]
    const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : ''
    return field ? `${field}: ${first.msg}` : first.msg
  }
  return status === 0 ? 'Cannot reach the server' : `Request failed (${status})`
}

async function request(method, path, { body, query, form, raw } = {}) {
  const url = new URL(API_URL + path, window.location.origin)
  Object.entries(query || {}).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && url.searchParams.set(k, v))
  const headers = {}
  const t = token.get()
  if (t) headers.Authorization = `Bearer ${t}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(url, { method, headers, body: form || (body !== undefined ? JSON.stringify(body) : undefined) })
  } catch {
    throw new ApiError(0, 'Cannot reach the server — is the backend running?')
  }
  if (res.status === 401 && path !== '/auth/login') onUnauthorized()
  if (!res.ok) {
    let data = null
    try { data = await res.json() } catch { /* not json */ }
    throw new ApiError(res.status, errorMessage(data, res.status))
  }
  if (raw) return res
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  get: (path, query) => request('GET', path, { query }),
  post: (path, body) => request('POST', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  del: (path) => request('DELETE', path),
  upload: (path, form) => request('POST', path, { form }),
  raw: (path, query) => request('GET', path, { query, raw: true }),
}

/** Download an authenticated file (document, report export) and hand it to the browser. */
export async function downloadFile(path, query, fallbackName = 'download') {
  const res = await api.raw(path, query)
  const cd = res.headers.get('content-disposition') || ''
  const name = decodeURIComponent((cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i) || [])[1] || fallbackName)
  const url = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const wsUrl = (path) => {
  const base = new URL(API_URL, window.location.origin)  // https -> wss automatically
  return `${base.protocol === 'https:' ? 'wss:' : 'ws:'}//${base.host}${base.pathname.replace(/\/$/, '')}${path}`
}
