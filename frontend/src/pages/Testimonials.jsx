import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Star, MessageSquareQuote, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'
import { usePageMeta } from '../lib/seo'
import { SITE } from '../config/site'
import { fmtDate } from '../lib/utils'
import PublicShell from '../components/PublicShell'
import { Avatar, Button, Card, ConfirmDialog, Empty, Field, Input, Stagger, Textarea } from '../components/ui'

function Stars({ value, size = 18, onChange, label }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  if (!onChange) {
    return (
      <span className="inline-flex gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} className={n <= Math.round(value) ? 'fill-accent text-accent' : 'text-line'} aria-hidden="true" />)}
      </span>
    )
  }
  return (
    <div className="inline-flex gap-1" role="radiogroup" aria-label={label} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onMouseEnter={() => setHover(n)} onClick={() => onChange(n)} className="cursor-pointer rounded-lg p-0.5 focus-visible:ring-2 focus-visible:ring-accent">
          <Star size={size} className={n <= shown ? 'fill-accent text-accent' : 'text-line'} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}

/** schema.org rating markup so search engines can show the average rating. */
function RatingJsonLd({ summary }) {
  useEffect(() => {
    if (!summary?.count) return undefined
    const el = document.createElement('script')
    el.type = 'application/ld+json'
    el.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: SITE.fullName,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web',
      aggregateRating: { '@type': 'AggregateRating', ratingValue: summary.average, reviewCount: summary.count, bestRating: 5, worstRating: 1 },
      review: summary.reviews.slice(0, 10).map((r) => ({
        '@type': 'Review', name: r.title, reviewBody: r.comment, datePublished: r.createdAt?.slice(0, 10),
        author: { '@type': 'Person', name: r.authorName }, reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
      })),
    })
    document.head.appendChild(el)
    return () => el.remove()
  }, [summary])
  return null
}

const EMPTY = { rating: 0, title: '', comment: '' }

function validate(f) {
  const e = {}
  if (!f.rating) e.rating = 'Choose a star rating'
  if (f.title.trim().length < 3) e.title = 'Title must be at least 3 characters'
  else if (f.title.length > 120) e.title = 'Title must be 120 characters or fewer'
  if (f.comment.trim().length < 10) e.comment = 'Review must be at least 10 characters'
  else if (f.comment.length > 2000) e.comment = 'Review must be 2000 characters or fewer'
  return e
}

export default function Testimonials() {
  usePageMeta({ title: 'User Reviews', description: `What students, mentors and project managers say about ${SITE.name}, the academic project management system.`, noindex: false, path: '/testimonials' })
  const { me, toast } = useApp()
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [mine, setMine] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const load = useCallback(async () => {
    try {
      setSummary(await api.get('/testimonials'))
      setError('')
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!me) return
    api.get('/testimonials/mine').then((r) => {
      setMine(r)
      if (r) setForm({ rating: r.rating, title: r.title, comment: r.comment })
    }).catch(() => {})
  }, [me])

  const submit = async (e) => {
    e.preventDefault()
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      const r = await api.put('/testimonials/mine', { rating: form.rating, title: form.title.trim(), comment: form.comment.trim() })
      setMine(r)
      toast(mine ? 'Your review was updated' : 'Thanks — your review is published')
      load()
    } catch (err) {
      toast(err.message, 'rose', 4500)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    try {
      await api.del('/testimonials/mine')
      setMine(null)
      setForm(EMPTY)
      toast('Your review was deleted', 'rose')
      load()
    } catch (err) {
      toast(err.message, 'rose', 4500)
    }
  }

  const total = summary?.count || 0

  return (
    <PublicShell wide>
      <RatingJsonLd summary={summary} />
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight text-ink">User Reviews</h1>
        <p className="mt-1 text-sm font-semibold text-muted">What people using {SITE.name} say about it. Reviews are written by signed-in users and shown with their name.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-6">
          <Card className="text-center">
            <div className="text-5xl font-black text-ink">{total ? summary.average.toFixed(1) : '–'}</div>
            <div className="mt-2"><Stars value={summary?.average || 0} size={22} /></div>
            <p className="mt-1 text-sm font-bold text-muted">{total} review{total === 1 ? '' : 's'}</p>
            <div className="mt-4 flex flex-col gap-1.5">
              {[5, 4, 3, 2, 1].map((n) => {
                const c = summary?.distribution?.[n] || 0
                return (
                  <div key={n} className="flex items-center gap-2 text-xs font-bold text-muted">
                    <span className="w-6">{n}★</span>
                    <div className="clay-inset h-2.5 flex-1 overflow-hidden !rounded-full p-[2px]" role="img" aria-label={`${c} ${n}-star reviews`}>
                      <div className="h-full rounded-full bg-accent" style={{ width: `${total ? (c / total) * 100 : 0}%` }} />
                    </div>
                    <span className="w-5 text-right">{c}</span>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-black text-ink">{mine ? 'Your review' : 'Write a review'}</h2>
            {!me ? (
              <p className="text-sm font-semibold text-muted"><Link to="/login" className="font-bold text-accent hover:underline">Sign in</Link> to share your experience.</p>
            ) : (
              <form onSubmit={submit} noValidate className="flex flex-col gap-4">
                <div>
                  <span className="mb-2 block text-xs font-extrabold tracking-wide text-muted uppercase">Rating <span className="text-rose">*</span></span>
                  <Stars value={form.rating} size={26} label="Your rating" onChange={(rating) => setForm({ ...form, rating })} />
                  {errors.rating && <span className="mt-1.5 block text-xs font-bold text-rose" role="alert">{errors.rating}</span>}
                </div>
                <Field label="Title" required error={errors.title}>
                  <Input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Sum it up in a few words" aria-invalid={!!errors.title} />
                </Field>
                <Field label="Review" required error={errors.comment} hint={`${form.comment.length}/2000`}>
                  <Textarea value={form.comment} maxLength={2000} rows={4} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="What works well? What could be better?" aria-invalid={!!errors.comment} />
                </Field>
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={saving}>{saving ? 'Saving…' : mine ? 'Update review' : 'Publish review'}</Button>
                  {mine && <Button type="button" variant="ghost" icon={Trash2} className="!text-rose" onClick={() => setConfirm(true)}>Delete</Button>}
                </div>
              </form>
            )}
          </Card>
        </div>

        <div>
          {error ? (
            <Card><Empty title="Couldn't load reviews" text={error} action={<Button variant="ghost" onClick={load}>Try again</Button>} /></Card>
          ) : !summary ? (
            <Card><p className="py-10 text-center text-sm font-bold text-muted">Loading reviews…</p></Card>
          ) : total === 0 ? (
            <Card><Empty icon={MessageSquareQuote} title="No reviews yet" text="Be the first to share how APMS works for your projects." /></Card>
          ) : (
            <Stagger stagger={0.05} className="flex flex-col gap-4">
              {summary.reviews.map((r) => (
                <Card key={r.id}>
                  <div className="flex items-start gap-3">
                    <Avatar user={{ name: r.authorName, tone: r.authorTone }} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-black text-ink">{r.title}</h3>
                        <Stars value={r.rating} size={16} />
                      </div>
                      <p className="text-xs font-bold text-muted">{r.authorName}{r.authorTitle ? ` · ${r.authorTitle}` : ''} · {fmtDate(r.createdAt)}</p>
                      <p className="mt-2 text-sm leading-relaxed font-semibold whitespace-pre-line text-ink">{r.comment}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </Stagger>
          )}
        </div>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Delete your review?" message="Your review will be removed from the public page." onConfirm={remove} />
    </PublicShell>
  )
}
