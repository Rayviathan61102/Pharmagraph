// Everything about one entity.
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api, useSave, type Entity } from '../api'
import { History } from '../History'
import { ErrorText, StatusBadge, askReason, formatTime } from '../ui'
import { Entries } from './Entries'
import { EntityForm } from './EntityForm'
import { Relationships } from './Relationships'

const ALIAS_KINDS = ['synonym', 'abbreviation', 'brand_name', 'inn', 'usan', 'chemical_name', 'local_name',
  'misspelling', 'other']

function AliasAdder({ entityId }: { entityId: string }) {
  const save = useSave()
  const [alias, setAlias] = useState('')
  const [kind, setKind] = useState('synonym')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    await save.mutateAsync(() => api.post(`/entities/${entityId}/aliases`, { alias, alias_kind: kind }))
    setAlias('')
  }
  return (
    <form onSubmit={submit} className="inline-form">
      <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Add another name" required
        aria-label="New alias" />
      <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind of name">
        {ALIAS_KINDS.map((k) => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}
      </select>
      <button type="submit" disabled={save.isPending}>Add</button>
      <ErrorText error={save.error} />
    </form>
  )
}

export function EntityPage({ id }: { id: string }) {
  const save = useSave()
  const [editing, setEditing] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const { data: entity, error } = useQuery({
    queryKey: ['entity', id], queryFn: () => api.get<Entity>(`/entities/${id}`),
  })
  if (error) return <p className="error">{String(error)}</p>
  if (!entity) return null
  const archived = !!entity.archived_at

  const archive = () => {
    const reason = askReason(`Archive "${entity.name}"? It will be hidden but never deleted.`)
    if (reason !== null) save.mutate(() => api.post(`/entities/${id}/archive`, { reason: reason || null }))
  }
  const restore = () => save.mutate(() => api.post(`/entities/${id}/unarchive`))

  return (
    <article className="entity-page">
      {archived && (
        <div className="archived-banner" role="status">
          Archived {formatTime(entity.archived_at!)}{entity.archive_reason && ` — ${entity.archive_reason}`}
          <button onClick={restore}>Restore</button>
        </div>
      )}
      <header>
        <p className="muted">{entity.type_label}</p>
        <h1>{entity.name} <StatusBadge code={entity.status_code} /></h1>
        {entity.aliases.length > 0 && (
          <ul className="chips" aria-label="Other names">
            {entity.aliases.map((a) => (
              <li key={a.id} className="chip" title={a.alias_kind.replace('_', ' ')}>
                {a.alias}
                {!archived && (
                  <button aria-label={`Remove ${a.alias}`} onClick={() =>
                    save.mutate(() => api.post(`/entities/${id}/aliases/${a.id}/archive`))}>×</button>
                )}
              </li>
            ))}
          </ul>
        )}
        {!archived && (
          <div className="actions">
            <button onClick={() => setEditing(true)}>Edit</button>
            <button onClick={archive}>Archive</button>
          </div>
        )}
        <ErrorText error={save.error} />
      </header>

      <section>
        <p className="lead">{entity.description || <span className="muted">No short description yet.</span>}</p>
        {!archived && <AliasAdder entityId={id} />}
        <label className="check">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived entries and relationships
        </label>
      </section>

      <Entries entity={entity} showArchived={showArchived} />
      <Relationships entity={entity} showArchived={showArchived} />

      <section className="page-history">
        <h2>Revision history of this entity</h2>
        <History kind="entities" id={id} />
      </section>

      {editing && <EntityForm entity={entity} onClose={() => setEditing(false)} />}
    </article>
  )
}
