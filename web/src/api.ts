// Talking to the PharmaGraph server, plus the shapes of the data it returns.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export class ApiError extends Error {
  status: number
  body: any
  constructor(status: number, body: any) {
    const detail = body?.detail
    // FastAPI reports form-validation problems as a list; join them into one readable sentence.
    const message = Array.isArray(detail)
      ? detail.map((d: any) => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join('; ')
      : detail ?? `Request failed (${status})`
    super(message)
    this.status = status
    this.body = body
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, data)
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}

/** Run a change on the server, then refresh everything shown on screen. */
export function useSave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (change: () => Promise<any>) => change(),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

// ---------- Data shapes ----------

export type Status = { code: string; label: string; description: string | null }
export type EntityType = { id: string; label: string; description: string | null }
export type RelationshipType = {
  id: string; label: string; inverse_label: string | null; description: string | null; is_directed: number
}
export type Section = { id: string; label: string; sort_order: number }
export type ContextKind = { id: string; label: string; description: string | null }

export type Lookups = {
  statuses: Status[]
  entity_types: EntityType[]
  relationship_types: RelationshipType[]
  sections: Section[]
  type_sections: { entity_type_id: string; section_id: string }[]
  context_kinds: ContextKind[]
}

export function useLookups() {
  return useQuery({ queryKey: ['lookups'], queryFn: () => api.get<Lookups>('/lookups'), staleTime: Infinity })
}

export type Alias = {
  id: string; alias: string; alias_kind: string; language: string | null; jurisdiction: string | null
}

export type Entity = {
  id: string
  entity_type_id: string
  type_label: string
  name: string
  description: string | null
  status_code: string
  version: number
  created_at: string
  updated_at: string
  archived_at: string | null
  archive_reason: string | null
  aliases: Alias[]
}

export type EntitySummary = {
  id: string; name: string; entity_type_id: string; status_code: string; archived_at: string | null
}

export type Revision = {
  id: string
  version: number
  change_kind: string
  changed_by: string
  reason: string | null
  created_at: string
  snapshot: Record<string, any>
}

export type HistoryKind = 'entities' | 'entries' | 'relationships'
