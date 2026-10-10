import { Component } from 'react'
import { TriangleAlert, RotateCcw } from 'lucide-react'

/**
 * Catches render errors anywhere below it and shows a recovery screen instead of a blank page.
 * A failed lazy-loaded page (e.g. after a new deployment replaced its file) is retried with a reload.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('APMS crashed:', error, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const chunk = /Loading chunk|dynamically imported module|Importing a module script failed/i.test(String(error?.message))
    return (
      <div className="grid min-h-[60vh] place-items-center p-6" role="alert">
        <div className="clay flex max-w-md flex-col items-center gap-4 p-8 text-center">
          <span className="clay-tone tone-rose grid h-16 w-16 place-items-center !rounded-full"><TriangleAlert size={30} aria-hidden="true" /></span>
          <h1 className="text-xl font-black text-ink">{chunk ? 'A new version is available' : 'Something went wrong'}</h1>
          <p className="text-sm font-semibold text-muted">
            {chunk ? 'This page was updated while you had it open. Reload to get the latest version.' : 'This page hit an unexpected error. Your data is safe — reloading usually fixes it.'}
          </p>
          <div className="flex gap-3">
            <button type="button" className="btn-tone tone-primary" onClick={() => window.location.reload()}><RotateCcw size={16} aria-hidden="true" /> Reload</button>
            <a href="/dashboard" className="btn-ghost">Dashboard</a>
          </div>
        </div>
      </div>
    )
  }
}
