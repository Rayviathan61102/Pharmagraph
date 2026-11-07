// One interactive graph panel (M10). Shows a focused neighbourhood and loads more on demand;
// it never loads the whole database. Self-contained, so two panels can sit side by side (M11).
//
//   Click node ........ select (inspector shows details)
//   Double-click ...... expand its neighbours / collapse what that expansion added
//   Alt + click ....... make it the new focus (Back returns to the previous focus)
//   Right-click ....... menu
//   Drag node / background, mouse wheel ... move, pan, zoom
import cytoscape, { type Core } from 'cytoscape'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useReducer, useRef, useState } from 'react'
import { api, useLookups, type Entity, type Scope } from '../api'
import { ErrorText, StatusBadge, entityLink } from '../ui'

type GNode = { id: string; name: string; entity_type_id: string; status_code: string }
type GEdge = { id: string; source: string; target: string; label: string; is_directed: number; scope: Scope }
type ExpandResult = { neighbors: GNode[]; remaining: number }
type ViewResult = { edges: GEdge[]; hidden: Record<string, number> }
type Menu = { x: number; y: number; id: string }

const SCOPES: Scope[] = ['general', 'lecture', 'personal']
const WARN_AT = 300 // spec 7.1: keep the view focused; suggest collapsing beyond this

// Node colours by kind of entity (same muted palette as theme.css; Cytoscape cannot read CSS variables).
const COLOR_GROUPS: [string, string[]][] = [
  ['#6b8fbf', ['drug', 'drug_class', 'medicinal_product', 'regimen']],
  ['#b97272', ['disease', 'clinical_condition', 'population']],
  ['#b99a5f', ['pathogen']],
  ['#6fa58a', ['protein', 'receptor', 'enzyme', 'pathway', 'physiological_process', 'cell']],
  ['#8f7fc0', ['organ_system', 'organ', 'tissue']],
  ['#5fa3a3', ['dosage_form', 'formulation', 'excipient', 'manufacturing_process', 'equipment', 'analytical_technique']],
]
const colorOf = (type: string) => COLOR_GROUPS.find(([, types]) => types.includes(type))?.[0] ?? '#8b919c'
const nodeData = (n: GNode) => ({ id: n.id, name: n.name, label: n.name, type: n.entity_type_id, color: colorOf(n.entity_type_id) })

const STYLE: cytoscape.StylesheetJson = [
  { selector: 'node', style: {
    'background-color': 'data(color)', label: 'data(label)', color: '#d7dae0', 'font-size': 11,
    'font-family': 'Inter, Noto Sans Thai, sans-serif', 'text-valign': 'bottom', 'text-margin-y': 4,
    'text-wrap': 'wrap', 'text-max-width': '130px', width: 18, height: 18,
    'text-background-color': '#16181d', 'text-background-opacity': 0.7, 'text-background-padding': '1px' } },
  { selector: 'node[?focus]', style: { width: 30, height: 30, 'border-width': 2, 'border-color': '#d7dae0', 'font-weight': 600 } },
  { selector: 'node:selected', style: { 'border-width': 3, 'border-color': '#e8ebf0' } },
  { selector: 'edge', style: {
    width: 1.2, 'line-color': '#4a515e', 'target-arrow-color': '#4a515e', 'target-arrow-shape': 'triangle',
    'curve-style': 'bezier', label: 'data(label)', 'font-size': 9, color: '#8b919c', 'text-rotation': 'autorotate',
    'text-background-color': '#16181d', 'text-background-opacity': 1, 'text-background-padding': '1px',
    'min-zoomed-font-size': 8 } },
  { selector: 'edge[directed = 0]', style: { 'target-arrow-shape': 'none' } },
  { selector: 'edge[scope = "lecture"]', style: { 'line-style': 'dashed', 'line-color': '#8f7fc0', 'target-arrow-color': '#8f7fc0' } },
  { selector: 'edge[scope = "personal"]', style: { 'line-style': 'dotted', 'line-color': '#6fa58a', 'target-arrow-color': '#6fa58a' } },
]

function Inspector({ id, hidden, onFocus, onExpand }: { id: string; hidden: number; onFocus: () => void; onExpand: () => void }) {
  const { data: e } = useQuery({ queryKey: ['entity', id], queryFn: () => api.get<Entity>(`/entities/${id}`) })
  if (!e) return null
  return (
    <aside className="graph-inspector" aria-label="Selected entity">
      <p className="muted">{e.type_label}</p>
      <h3>{e.name} <StatusBadge code={e.status_code} /></h3>
      {e.aliases.length > 0 && <p className="muted">{e.aliases.map((a) => a.alias).join(' · ')}</p>}
      {e.description && <p>{e.description}</p>}
      <div className="actions">
        <a href={entityLink(e.id)}>Open details</a>
        <button className="link" onClick={onFocus}>Make focus</button>
        {hidden > 0 && <button className="link" onClick={onExpand}>Show {Math.min(hidden, 25)} more of {hidden}</button>}
      </div>
    </aside>
  )
}

export function GraphPanel({ initialFocus }: { initialFocus: string }) {
  const { data: lookups } = useLookups()
  const container = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const expandedFrom = useRef(new Map<string, string>()) // node -> the node whose expansion added it
  const expanded = useRef(new Set<string>())
  const focusId = useRef(initialFocus)
  const back = useRef<string[]>([])
  const forward = useRef<string[]>([])
  const filters = useRef<{ type: string; scopes: Scope[] }>({ type: '', scopes: [...SCOPES] })
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  const [selected, setSelected] = useState<string | null>(initialFocus)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [error, setError] = useState<unknown>(null)

  const live = () => (cyRef.current && !cyRef.current.destroyed() ? cyRef.current : null)
  const filterBody = () => ({
    types: filters.current.type ? [filters.current.type] : null, scopes: filters.current.scopes,
  })
  const run = (task: () => Promise<void>) => { setMenu(null); task().catch(setError) }

  /** Fetch the links among the visible nodes and each node's number of hidden neighbours. */
  async function sync() {
    const g = live()
    if (!g) return
    const view = await api.post<ViewResult>('/graph/view', { ids: g.nodes().map((n) => n.id()), ...filterBody() })
    const keep = new Set(view.edges.map((e) => e.id))
    g.edges().filter((e) => !keep.has(e.id())).remove()
    g.add(view.edges.filter((e) => g.getElementById(e.id).empty()).map((e) => ({
      group: 'edges' as const,
      data: { id: e.id, source: e.source, target: e.target, label: e.label, scope: e.scope, directed: e.is_directed },
    })))
    g.nodes().forEach((n) => {
      const hidden = view.hidden[n.id()] ?? 0
      n.data({ hidden, label: hidden ? `${n.data('name')}\n+${hidden}` : n.data('name') })
    })
    refresh()
  }

  /** New neighbours go in a ring (or, for a node that was itself expanded from another, an outward arc). */
  function positionsAround(g: Core, id: string, count: number) {
    const p = g.getElementById(id).position()
    const parent = g.getElementById(expandedFrom.current.get(id) ?? '')
    const radius = Math.max(160, count * 13)
    let start = 0
    let spread = 2 * Math.PI
    if (parent.nonempty()) {
      const away = Math.atan2(p.y - parent.position().y, p.x - parent.position().x)
      spread = Math.PI * 1.2
      start = away - spread / 2
    }
    return Array.from({ length: count }, (_, i) => {
      const angle = start + (spread * (i + 0.5)) / count
      return { x: p.x + radius * Math.cos(angle), y: p.y + radius * Math.sin(angle) }
    })
  }

  async function expand(id: string) {
    const g = live()
    if (!g) return
    const result = await api.post<ExpandResult>('/graph/expand', {
      entity_id: id, exclude: g.nodes().map((n) => n.id()), ...filterBody(),
    })
    if (!live()) return
    const places = positionsAround(g, id, result.neighbors.length)
    g.add(result.neighbors.map((n, i) => ({ group: 'nodes' as const, data: nodeData(n), position: places[i] })))
    result.neighbors.forEach((n) => expandedFrom.current.set(n.id, id))
    expanded.current.add(id)
    await sync()
  }

  async function collapse(id: string) {
    const g = live()
    if (!g) return
    const remove = new Set<string>()
    const walk = (parent: string) => expandedFrom.current.forEach((p, child) => {
      if (p === parent && child !== focusId.current && !remove.has(child)) { remove.add(child); walk(child) }
    })
    walk(id)
    remove.forEach((child) => {
      g.getElementById(child).remove()
      expandedFrom.current.delete(child)
      expanded.current.delete(child)
    })
    expanded.current.delete(id)
    if (selected && remove.has(selected)) setSelected(null)
    await sync()
  }

  async function focus(id: string, record = true) {
    const g = live()
    if (!g) return
    if (record && id !== focusId.current) {
      back.current.push(focusId.current)
      forward.current = []
    }
    focusId.current = id
    g.elements().remove()
    expandedFrom.current.clear()
    expanded.current.clear()
    const node = await api.get<GNode>(`/graph/node/${id}`)
    if (!live()) return
    g.add({ group: 'nodes', data: { ...nodeData(node), focus: true }, position: { x: 0, y: 0 } })
    await expand(id)
    g.fit(undefined, 60)
    setSelected(id)
  }

  function goBack() {
    const previous = back.current.pop()
    if (!previous) return
    forward.current.push(focusId.current)
    run(() => focus(previous, false))
  }
  function goForward() {
    const next = forward.current.pop()
    if (!next) return
    back.current.push(focusId.current)
    run(() => focus(next, false))
  }

  // Create the graph once; event handlers read the latest state through refs.
  useEffect(() => {
    const g = cytoscape({ container: container.current, style: STYLE, minZoom: 0.15, maxZoom: 3 })
    cyRef.current = g
    g.on('tap', 'node', (e) => {
      const id = e.target.id()
      if ((e.originalEvent as MouseEvent | undefined)?.altKey) run(() => focus(id))
      else { setSelected(id); setMenu(null) }
    })
    g.on('dbltap', 'node', (e) => {
      const id = e.target.id()
      run(() => (expanded.current.has(id) ? collapse(id) : expand(id)))
    })
    g.on('cxttap', 'node', (e) => setMenu({ x: e.renderedPosition.x, y: e.renderedPosition.y, id: e.target.id() }))
    g.on('tap', (e) => { if (e.target === g) { setSelected(null); setMenu(null) } })
    run(() => focus(initialFocus, false))
    return () => g.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const g = live()
  const count = g?.nodes().length ?? 0
  const hiddenOf = (id: string) => (g?.getElementById(id).data('hidden') as number | undefined) ?? 0
  const setFilter = (change: Partial<typeof filters.current>) => {
    filters.current = { ...filters.current, ...change }
    run(() => focus(focusId.current, false))
  }

  return (
    <section className="graph-panel">
      <div className="graph-toolbar">
        <button onClick={goBack} disabled={back.current.length === 0} aria-label="Back">←</button>
        <button onClick={goForward} disabled={forward.current.length === 0} aria-label="Forward">→</button>
        <button onClick={() => live()?.fit(undefined, 60)}>Fit</button>
        <select value={filters.current.type} onChange={(e) => setFilter({ type: e.target.value })}
          aria-label="Relationship type filter">
          <option value="">All relationship types</option>
          {lookups?.relationship_types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        {SCOPES.map((s) => (
          <label key={s} className={`check scope-${s}`}>
            <input type="checkbox" checked={filters.current.scopes.includes(s)}
              onChange={(e) => setFilter({
                scopes: e.target.checked ? [...filters.current.scopes, s] : filters.current.scopes.filter((x) => x !== s),
              })} />
            {s}
          </label>
        ))}
        <span className="muted">{count} shown</span>
        {count > WARN_AT && <span className="caution">Many items on screen. Collapse some or use filters.</span>}
      </div>
      <p className="graph-help muted">
        Click: select · Double-click: expand / collapse · Alt+click: focus · Right-click: menu · Drag: move
      </p>
      <ErrorText error={error} />
      <div className="graph-stage">
        <div className="graph-canvas" ref={container} onContextMenu={(e) => e.preventDefault()} />
        {menu && (
          <div className="graph-menu" role="menu" style={{ left: menu.x, top: menu.y }}>
            <a role="menuitem" href={entityLink(menu.id)}>Open details</a>
            <button role="menuitem" onClick={() => run(() => focus(menu.id))}>Make focus</button>
            {hiddenOf(menu.id) > 0 && (
              <button role="menuitem" onClick={() => run(() => expand(menu.id))}>Show more ({hiddenOf(menu.id)})</button>
            )}
            {expanded.current.has(menu.id) && (
              <button role="menuitem" onClick={() => run(() => collapse(menu.id))}>Collapse</button>
            )}
            <button role="menuitem" onClick={() => setMenu(null)}>Close</button>
          </div>
        )}
        {selected && g?.getElementById(selected).nonempty() && (
          <Inspector id={selected} hidden={hiddenOf(selected)}
            onFocus={() => run(() => focus(selected))} onExpand={() => run(() => expand(selected))} />
        )}
      </div>
    </section>
  )
}
