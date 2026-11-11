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

// ---------- Icons ----------
// Small line icons drawn right here (no icon library to download). They take the colour of the text around them.
const ICONS = {
  logo: <><path d="M12 2.5 20.2 7.25v9.5L12 21.5l-8.2-4.75v-9.5Z" /><circle cx="12" cy="12" r="3.4" /></>,
  plus: <path d="M5 12h14M12 5v14" />,
  search: <><circle cx="11" cy="11" r="7.5" /><path d="m20.5 20.5-4.2-4.2" /></>,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  back: <path d="m12 19-7-7 7-7M19 12H5" />,
  forward: <path d="M5 12h14m-7-7 7 7-7 7" />,
  edit: <><path d="M21.17 6.81a1 1 0 0 0-3.98-3.98L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.36a.5.5 0 0 0 .62.62l4.36-1.32a2 2 0 0 0 .83-.5z" /><path d="m15 5 4 4" /></>,
  archive: <><rect x="2" y="3" width="20" height="5" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4" /></>,
  note: <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8" /></>,
  compare: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M12 3v18" /></>,
  template: <><rect x="3" y="3" width="18" height="7" rx="1" /><rect x="3" y="14" width="9" height="7" rx="1" /><rect x="16" y="14" width="5" height="7" rx="1" /></>,
  backup: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0" /></>,
  graph: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></>,
  swap: <path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4" />,
  panel: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M15 3v18" /></>,
  folder: <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />,
  history: <><circle cx="12" cy="12" r="9.5" /><path d="M12 6.5V12l3.5 2" /></>,
  restore: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></>,
  download: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  fit: <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />,
  check: <path d="M20 6 9 17l-5-5" />,
  book: <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />,
  study: <><path d="M21.4 10.9a1 1 0 0 0 0-1.8l-8.6-3.9a2 2 0 0 0-1.6 0L2.6 9.1a1 1 0 0 0 0 1.8l8.6 3.9a2 2 0 0 0 1.6 0z" /><path d="M22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5" /></>,
  flame: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
  alert: <path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3M12 9v4M12 17h.01" />,
}
export type IconName = keyof typeof ICONS

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}
