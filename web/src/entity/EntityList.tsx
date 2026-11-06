// Sidebar list of entities, with a quick name filter.
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api, type EntitySummary } from '../api'
import { entityLink } from '../ui'

export function EntityList({ currentId }: { currentId?: string }) {
  const [q, setQ] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const { data } = useQuery({
    queryKey: ['entities', q, showArchived],
    queryFn: () => api.get<EntitySummary[]>(
      `/entities?q=${encodeURIComponent(q)}&include_archived=${showArchived}`),
  })

  return (
    <section className="entity-list">
      <input type="search" placeholder="Filter by name…" value={q} onChange={(e) => setQ(e.target.value)}
        aria-label="Filter entities by name" />
      <label className="check">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Show archived
      </label>
      <ul>
        {data?.map((e) => (
          <li key={e.id}>
            <a href={entityLink(e.id)} className={[e.id === currentId && 'current', e.archived_at && 'archived']
              .filter(Boolean).join(' ')}>{e.name}</a>
          </li>
        ))}
        {data?.length === 0 && <li className="muted">Nothing found.</li>}
      </ul>
    </section>
  )
}
