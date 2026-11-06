// Small building blocks shared by every screen.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLookups } from './api'

/** The current page, from the address bar after '#', e.g. '#/entity/0193...'. */
export function useRoute(): string[] {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const update = () => setHash(window.location.hash)
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean)
}

export const go = (path: string) => { window.location.hash = path }
export const entityLink = (id: string) => `#/entity/${id}`

/** A modal window (the browser's built-in <dialog>: Escape closes it, focus stays inside). */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal() }, [])
  return (
    <dialog ref={ref} className="dialog" onClose={onClose}>
      <h2>{title}</h2>
      {children}
    </dialog>
  )
}

export function StatusBadge({ code }: { code: string }) {
  const { data } = useLookups()
  const label = data?.statuses.find((s) => s.code === code)?.label ?? code
  return <span className={`badge status-${code}`}>{label}</span>
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null
  return <p className="error" role="alert">{error instanceof Error ? error.message : String(error)}</p>
}

export const formatTime = (iso: string) => new Date(iso).toLocaleString()

/** Ask for an optional reason. Returns null if the user pressed Cancel. */
export const askReason = (question: string) => window.prompt(`${question}\n\nReason (optional):`, '')
