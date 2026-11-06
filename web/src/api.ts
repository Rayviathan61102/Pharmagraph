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

export type Scope = 'general' | 'lecture' | 'personal'

export type Condition = {
  id: string; context_kind_id: string; kind_label: string; value_text: string | null
  value_entity_id: string | null; value_entity_name: string | null
}

export type Relationship = {
  id: string
  source_entity_id: string
  target_entity_id: string
  relationship_type_id: string
  description: string | null
  scope: Scope
  lecture_id: string | null
  lecture_title: string | null
  status_code: string
  origin: string
  version: number
  archived_at: string | null
  archive_reason: string | null
  contexts: Condition[]
  // worded from the point of view of the entity being viewed:
  direction: 'out' | 'in'
  label: string
  other_id: string
  other_name: string
  other_type_id: string
  other_archived: number
}

export type Entry = {
  id: string
  entity_id: string
  scope: Scope
  section_id: string
  section_label: string
  title: string | null
  body: string
  lecture_id: string | null
  lecture_title: string | null
  professor_name: string | null
  counterpart_entry_id: string | null
  status_code: string
  origin: string
  version: number
  created_at: string
  updated_at: string
  archived_at: string | null
  archive_reason: string | null
  contexts: Condition[]
}

export type Professor = { id: string; name: string; department: string | null }
export type Lecture = {
  id: string; title: string; course_code: string | null; course_name: string | null
  professor_id: string | null; professor_name: string | null; lecture_date: string | null
}

export function useLectures() {
  return useQuery({ queryKey: ['lectures'], queryFn: () => api.get<Lecture[]>('/lectures') })
}
