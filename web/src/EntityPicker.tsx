// Choose an entity by typing part of its name (or one of its other names).
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api, type EntitySummary } from './api'

type Props = { value: EntitySummary | null; onChange: (e: EntitySummary | null) => void; excludeId?: string }

export function EntityPicker({ value, onChange, excludeId }: Props) {
  const [q, setQ] = useState('')
  const { data } = useQuery({
    queryKey: ['entities', q, false],
    queryFn: () => api.get<EntitySummary[]>(`/entities?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length > 0,
  })

  if (value) {
    return (
      <span className="inline-form">
        <span className="chip">{value.name}</span>
        <button type="button" onClick={() => onChange(null)}>Change</button>
      </span>
    )
  }
  const results = (data ?? []).filter((e) => e.id !== excludeId).slice(0, 8)
  return (
    <span className="picker">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to search…" aria-label="Search entity" />
      {q.trim() && (
        <span className="picker-results" role="listbox">
          {results.map((e) => (
            <button type="button" role="option" key={e.id} onClick={() => onChange(e)}>{e.name}</button>
          ))}
          {results.length === 0 && <span className="muted">No match. Create the entity first.</span>}
        </span>
      )}
    </span>
  )
}
