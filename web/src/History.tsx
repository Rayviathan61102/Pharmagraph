// Revision history of an entity, entry or relationship: every version, with its reason.
import { useQuery } from '@tanstack/react-query'
import { api, type HistoryKind, type Revision } from './api'
import { formatTime } from './ui'

// Snapshot fields worth showing to a reader (ids and timestamps are left out).
const FIELDS = ['name', 'entity_type_id', 'description', 'title', 'body', 'scope', 'section_id',
  'relationship_type_id', 'status_code', 'archive_reason']

function SnapshotView({ snapshot }: { snapshot: Record<string, any> }) {
  return (
    <dl className="snapshot">
      {FIELDS.filter((f) => snapshot[f] != null && snapshot[f] !== '').map((f) => (
        <div key={f}><dt>{f.replace(/_/g, ' ')}</dt><dd>{String(snapshot[f])}</dd></div>
      ))}
      {snapshot.aliases?.length > 0 && (
        <div><dt>aliases</dt><dd>{snapshot.aliases.filter((a: any) => !a.archived_at).map((a: any) => a.alias).join(', ') || '—'}</dd></div>
      )}
      {snapshot.contexts?.length > 0 && (
        <div><dt>conditions</dt><dd>{snapshot.contexts.map((c: any) => `${c.context_kind_id}: ${c.value_text}`).join('; ')}</dd></div>
      )}
    </dl>
  )
}

export function History({ kind, id }: { kind: HistoryKind; id: string }) {
  const { data, error } = useQuery({
    queryKey: ['revisions', kind, id],
    queryFn: () => api.get<Revision[]>(`/${kind}/${id}/revisions`),
  })
  if (error) return <p className="error">{String(error)}</p>
  return (
    <ol className="history">
      {data?.map((r) => (
        <li key={r.id}>
          <details>
            <summary>
              <strong>v{r.version}</strong> · {r.change_kind.replace('_', ' ')} · {formatTime(r.created_at)}
              {r.reason && <> · <em>{r.reason}</em></>}
            </summary>
            <SnapshotView snapshot={r.snapshot} />
          </details>
        </li>
      ))}
    </ol>
  )
}
