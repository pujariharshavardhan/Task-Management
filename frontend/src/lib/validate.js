// Client-side validation that mirrors the API's rules, so users get instant, specific messages.
// The server re-checks everything; these only spare a round trip.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const blank = (v) => v === undefined || v === null || String(v).trim() === ''

export const rules = {
  required: (label) => (v) => (blank(v) ? `${label} is required` : null),
  email: () => (v) => (blank(v) || EMAIL_RE.test(String(v).trim()) ? null : 'Enter a valid email address, like name@college.edu'),
  min: (n, label) => (v) => (blank(v) || String(v).trim().length >= n ? null : `${label} must be at least ${n} characters`),
  max: (n, label) => (v) => (blank(v) || String(v).length <= n ? null : `${label} must be ${n} characters or fewer`),
  password: () => (v) => (blank(v) || (String(v).length >= 8 && /[a-z]/i.test(v) && /\d/.test(v)) ? null : 'Use at least 8 characters with a letter and a number'),
  time: () => (v) => (blank(v) || TIME_RE.test(v) ? null : 'Enter a time like 14:30'),
  range: (lo, hi, label) => (v) => (blank(v) || (Number(v) >= lo && Number(v) <= hi) ? null : `${label} must be between ${lo} and ${hi}`),
  after: (otherKey, label, otherLabel) => (v, all) => (blank(v) || blank(all[otherKey]) || v >= all[otherKey] ? null : `${label} must be on or after the ${otherLabel.toLowerCase()}`),
  matches: (otherKey, msg) => (v, all) => (v === all[otherKey] ? null : msg),
}

/** Run `schema` ({ field: [rule, …] }) over `values`; returns { field: firstMessage } for failures only. */
export function check(values, schema) {
  const errors = {}
  for (const [field, list] of Object.entries(schema)) {
    for (const rule of list) {
      const msg = rule(values[field], values)
      if (msg) { errors[field] = msg; break }
    }
  }
  return errors
}

// react-hook-form equivalents (for the forms built with it)
export const rhf = {
  email: { pattern: { value: EMAIL_RE, message: 'Enter a valid email address, like name@college.edu' } },
  password: { validate: (v) => rules.password()(v) || true },
}
