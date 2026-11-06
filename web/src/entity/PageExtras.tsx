// Page-level helpers for the entity page: "jump to" navigation with a scope legend, and the Sources summary.
import { useLookups, type Entity, type Evidence } from '../api'
import { useEntries, visibleSections } from './Entries'
import { sourceLabel } from './Evidence'
import { useRelationships } from './Relationships'

// Hash links would change the page route, so jumping uses scrollIntoView instead.
const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

export function PageNav({ entity, showArchived }: { entity: Entity; showArchived: boolean }) {
  const { data: lookups } = useLookups()
  const { data: entries } = useEntries(entity, showArchived)
  if (!lookups || !entries) return null
  const targets = [
    ...visibleSections(lookups, entity, entries).map((s) => ({ id: `sec-${s.id}`, label: s.label })),
    { id: 'sec-related', label: 'Related concepts' },
    { id: 'sec-sources', label: 'Sources' },
    { id: 'sec-history', label: 'History' },
  ]
  return (
    <nav className="page-nav" aria-label="Sections of this page">
      <span className="legend" aria-label="Colour key">
        <span className="scope-general">General</span>
        <span className="scope-lecture">Lecture</span>
        <span className="scope-personal">Personal</span>
      </span>
      {targets.map((t) => <button key={t.id} className="link" onClick={() => jump(t.id)}>{t.label}</button>)}
    </nav>
  )
}

/** Every source cited anywhere on this page, once, with the claims it is attached to (spec 15.2). */
export function SourcesSummary({ entity, showArchived }: { entity: Entity; showArchived: boolean }) {
  const { data: entries } = useEntries(entity, showArchived)
  const { data: relationships } = useRelationships(entity, showArchived)
  if (!entries || !relationships) return null

  const bySource = new Map<string, { label: string; url: string | null; claims: string[] }>()
  const add = (ev: Evidence, claim: string) => {
    const item = bySource.get(ev.source_id) ?? { label: sourceLabel(ev), url: ev.url, claims: [] }
    item.claims.push(ev.locator ? `${claim} (${ev.locator})` : claim)
    bySource.set(ev.source_id, item)
  }
  entries.forEach((e) => e.evidence.forEach((ev) => add(ev, `${e.section_label} — ${e.scope}`)))
  relationships.forEach((r) => r.evidence.forEach((ev) => add(ev, `${r.label} ${r.other_name}`)))

  return (
    <section id="sec-sources" className="knowledge-section">
      <h2>Sources</h2>
      {bySource.size === 0 && <p className="muted">No sources cited on this page yet.</p>}
      <ul className="sources-summary">
        {[...bySource.values()].map((s) => (
          <li key={s.label}>
            {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a> : s.label}
            <span className="muted"> — supports: {s.claims.join('; ')}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
