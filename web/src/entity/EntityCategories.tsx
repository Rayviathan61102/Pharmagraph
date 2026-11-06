// Which categories (sidebar folders) an entity appears in. One entity can be in many; it is never copied.
import { useQuery } from '@tanstack/react-query'
import { api, useAllCategories, useSave, type CategoryPath } from '../api'
import { ErrorText } from '../ui'

export function EntityCategories({ entityId, readOnly }: { entityId: string; readOnly: boolean }) {
  const save = useSave()
  const { data: all } = useAllCategories()
  const { data: mine } = useQuery({
    queryKey: ['categories', 'of', entityId],
    queryFn: () => api.get<CategoryPath[]>(`/entities/${entityId}/categories`),
  })
  if (!mine) return null
  const available = (all ?? []).filter((c) => !mine.some((m) => m.id === c.id))

  return (
    <div className="entity-categories">
      <span className="muted">Categories:</span>
      {mine.length === 0 && <span className="muted"> none</span>}
      <ul className="chips">
        {mine.map((c) => (
          <li key={c.id} className="chip">
            {c.path}
            {!readOnly && (
              <button aria-label={`Remove from ${c.path}`}
                onClick={() => save.mutate(() => api.post(`/categories/${c.id}/entities/${entityId}/remove`))}>×</button>
            )}
          </li>
        ))}
      </ul>
      {!readOnly && available.length > 0 && (
        <select value="" aria-label="Add to a category"
          onChange={(e) => {
            const categoryId = e.target.value // read now: the menu resets to "" before the request runs
            save.mutate(() => api.post(`/categories/${categoryId}/entities`, { entity_id: entityId }))
          }}>
          <option value="">+ Add to category…</option>
          {available.map((c) => <option key={c.id} value={c.id}>{c.path}</option>)}
        </select>
      )}
      <ErrorText error={save.error} />
    </div>
  )
}
