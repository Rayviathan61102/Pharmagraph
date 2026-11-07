// The two-panel workspace (spec 8): at most TWO panels, each with its own view and Back/Forward history,
// sharing one data cache (so an edit in one panel shows up in the other). The layout is remembered.
//
// Navigation: every link in the app points at an address like "#/entity/<id>". When the address changes,
// the ACTIVE panel (the one you last clicked in) shows it. The address bar always mirrors the active panel.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

type Panel = { history: string[]; index: number } // history of paths like "/entity/0193..."
type State = { panels: Panel[]; active: number; arrangement: 'side' | 'stacked'; size: number } // size: % for panel 1

const STORAGE_KEY = 'pharmagraph.workspace'
const MAX_PANELS = 2 // spec 8: never more than two
const HISTORY_LIMIT = 50
const HOME = '/'

const current = (p: Panel) => p.history[p.index] ?? HOME
const hashPath = () => window.location.hash.replace(/^#/, '') || HOME

function load(): State {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as State | null
    if (saved && Array.isArray(saved.panels) && saved.panels.length >= 1 && saved.panels.length <= MAX_PANELS) {
      const active = Math.min(saved.active, saved.panels.length - 1)
      const panels = [...saved.panels]
      // An address opened directly (bookmark, typed link) wins over the remembered view.
      if (window.location.hash) panels[active] = visit(panels[active], hashPath())
      return { ...saved, panels, active }
    }
  } catch { /* storage unavailable or damaged: start fresh */ }
  return { panels: [{ history: [hashPath()], index: 0 }], active: 0, arrangement: 'side', size: 55 }
}

function visit(panel: Panel, path: string): Panel {
  if (current(panel) === path) return panel
  const history = [...panel.history.slice(0, panel.index + 1), path].slice(-HISTORY_LIMIT)
  return { history, index: history.length - 1 }
}

type Api = {
  state: State
  path: (i: number) => string
  activate: (i: number) => void
  back: (i: number) => void
  forward: (i: number) => void
  openInOther: (from: number, path: string) => void
  close: (i: number) => void
  swap: () => void
  setArrangement: (a: State['arrangement']) => void
  setSize: (size: number) => void
}

export function useWorkspaceState(): Api {
  const [state, setState] = useState<State>(load)
  const activeRef = useRef(state.active) // read synchronously by the address-change listener
  activeRef.current = state.active

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* not essential */ }
  }, [state])

  // Keep the address bar showing the active panel (replaceState does not fire hashchange).
  useEffect(() => {
    const path = current(state.panels[state.active])
    if (hashPath() !== path) window.history.replaceState(null, '', `#${path}`)
  }, [state])

  // A link was followed (or the address typed): show it in the active panel.
  useEffect(() => {
    const onHash = () => setState((s) => {
      const panels = [...s.panels]
      panels[activeRef.current] = visit(panels[activeRef.current], hashPath())
      return { ...s, panels }
    })
    onHash() // an address opened from a bookmark goes into the active panel
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const update = useCallback((change: (s: State) => State) => setState(change), [])
  const step = (i: number, by: number) => update((s) => {
    const panels = [...s.panels]
    const p = panels[i]
    panels[i] = { ...p, index: Math.max(0, Math.min(p.history.length - 1, p.index + by)) }
    return { ...s, panels }
  })

  return {
    state,
    path: (i) => current(state.panels[i]),
    activate: (i) => {
      if (activeRef.current === i) return
      activeRef.current = i // before the click's link changes the address
      window.history.replaceState(null, '', `#${current(state.panels[i])}`)
      update((s) => ({ ...s, active: i }))
    },
    back: (i) => step(i, -1),
    forward: (i) => step(i, +1),
    openInOther: (from, path) => update((s) => {
      if (s.panels.length < MAX_PANELS) return { ...s, panels: [...s.panels, { history: [path], index: 0 }] }
      const panels = [...s.panels]
      const other = 1 - from
      panels[other] = visit(panels[other], path) // the old view stays in that panel's Back history
      return { ...s, panels }
    }),
    close: (i) => update((s) => (s.panels.length < 2 ? s : { ...s, panels: s.panels.filter((_, j) => j !== i), active: 0 })),
    swap: () => update((s) => (s.panels.length < 2 ? s : { ...s, panels: [s.panels[1], s.panels[0]], active: 1 - s.active })),
    setArrangement: (arrangement) => update((s) => ({ ...s, arrangement })),
    setSize: (size) => update((s) => ({ ...s, size: Math.max(25, Math.min(75, size)) })),
  }
}

// ---------- What a page inside a panel can ask for ----------

type PanelContext = { index: number; panelCount: number; openInOther: (path: string) => void }
const Ctx = createContext<PanelContext>({ index: 0, panelCount: 1, openInOther: () => {} })
export const usePanel = () => useContext(Ctx)
export const PanelProvider = ({ value, children }: { value: PanelContext; children: ReactNode }) =>
  <Ctx.Provider value={value}>{children}</Ctx.Provider>

/** "Open in other panel" button (opens the second panel if there is only one). */
export function OpenInOther({ path, what = 'Open', className = 'link' }: { path: string; what?: string; className?: string }) {
  const { openInOther, panelCount } = usePanel()
  return (
    <button className={className} onClick={() => openInOther(path)}>
      {what} in {panelCount < 2 ? 'second' : 'other'} panel
    </button>
  )
}

// ---------- The draggable divider between the two panels ----------

export function Divider({ arrangement, size, onSize }: { arrangement: State['arrangement']; size: number; onSize: (n: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!ref.current?.hasPointerCapture(e.pointerId)) return
    const box = ref.current.parentElement!.getBoundingClientRect()
    onSize(arrangement === 'side' ? ((e.clientX - box.left) / box.width) * 100 : ((e.clientY - box.top) / box.height) * 100)
  }
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const by = { ArrowLeft: -5, ArrowUp: -5, ArrowRight: 5, ArrowDown: 5 }[e.key]
    if (by) { e.preventDefault(); onSize(size + by) }
  }
  return (
    <div ref={ref} className={`divider ${arrangement}`} role="separator" tabIndex={0}
      aria-orientation={arrangement === 'side' ? 'vertical' : 'horizontal'} aria-label="Resize panels (arrow keys)"
      aria-valuenow={Math.round(size)} aria-valuemin={25} aria-valuemax={75}
      onPointerDown={(e) => ref.current?.setPointerCapture(e.pointerId)} onPointerMove={move}
      onPointerUp={(e) => ref.current?.releasePointerCapture(e.pointerId)} onKeyDown={keys} />
  )
}

/** True when the window is narrow: panels then become tabs (both stay open, one is shown). */
export function useNarrow(width = 900) {
  const [narrow, setNarrow] = useState(() => window.innerWidth <= width)
  useEffect(() => {
    const update = () => setNarrow(window.innerWidth <= width)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [width])
  return narrow
}
