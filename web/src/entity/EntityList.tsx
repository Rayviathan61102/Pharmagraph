// Sidebar: search (names, other names, Thai text, knowledge entries), or browse all entities A–Z.
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api, type EntitySummary } from '../api'
import { entityLink } from '../ui'

type SearchHit = EntitySummary & { type_label: string; matched: string[]; snippet: string | null }

/** The server marks matched text with \u0002 … \u0003; show those parts highlighted. */
function Snippet({ text }: { text: string }) {
  const parts = text.split(/[\u0002\u0003]/)
  return <span className="snippet">{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</span>
}

export function EntityList({ currentId }: { currentId?: string }) {
  const [q, setQ] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const searching = q.trim().length > 0
  const { data: all } = useQuery({
    queryKey: ['entities', '', showArchived],
    queryFn: () => api.get<EntitySummary[]>(`/entities?include_archived=${showArchived}`),
    enabled: !searching,
  })
  const { data: hits } = useQuery({
    queryKey: ['search', q, showArchived],
    queryFn: () => api.get<SearchHit[]>(`/search?q=${encodeURIComponent(q)}&include_archived=${showArchived}`),
    enabled: searching,
  })
  const items: (EntitySummary | SearchHit)[] | undefined = searching ? hits : all
  const linkClass = (e: EntitySummary) =>
    [e.id === currentId && 'current', e.archived_at && 'archived'].filter(Boolean).join(' ')

  return (
    <section className="entity-list">
      <input type="search" placeholder="Search names, other names, notes…" value={q}
        onChange={(e) => setQ(e.target.value)} aria-label="Search" />
      <label className="check">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Include archived
      </label>
      <ul aria-label={searching ? 'Search results' : 'All entities'}>
        {items?.map((e) => (
          <li key={e.id}>
            <a href={entityLink(e.id)} className={linkClass(e)}>
              {e.name}
              {'matched' in e && (
                <span className="hit-detail">
                  {e.type_label}{!e.matched.includes('name') && ` · matched ${e.matched.join(', ')}`}
                  {e.snippet && <Snippet text={e.snippet} />}
                </span>
              )}
            </a>
          </li>
        ))}
        {items?.length === 0 && <li className="muted">Nothing found.</li>}
      </ul>
    </section>
  )
}
