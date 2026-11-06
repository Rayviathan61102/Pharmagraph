// "Related concepts": typed relationships, worded from this entity's point of view.
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import Markdown from 'react-markdown'
import {
  api, useLectures, useLookups, useSave, type Entity, type EntitySummary, type Relationship, type Scope,
} from '../api'
import { EntityPicker } from '../EntityPicker'
import { History } from '../History'
import { Dialog, ErrorText, StatusBadge, askReason, entityLink } from '../ui'
import { Conditions } from './Conditions'

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'general', label: 'General scientific knowledge' },
  { value: 'lecture', label: 'Lecture-specific' },
  { value: 'personal', label: 'Personal (your own link)' },
]

function RelationshipForm({ entity, onClose }: { entity: Entity; onClose: () => void }) {
  const { data: lookups } = useLookups()
  const { data: lectures } = useLectures()
  const save = useSave()
  const [typeAndDirection, setTypeAndDirection] = useState('')
  const [other, setOther] = useState<EntitySummary | null>(null)
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState<Scope>('general')
  const [lectureId, setLectureId] = useState('')
  const [status, setStatus] = useState('proposed')
  const [conditionKind, setConditionKind] = useState('population')
  const [conditionValue, setConditionValue] = useState('')

  // Each directed type can be read both ways: "Paracetamol inhibits …" or "Paracetamol is inhibited by …".
  const options = (lookups?.relationship_types ?? []).flatMap((t) => [
    { value: `${t.id}|out`, label: t.label },
    ...(t.is_directed ? [{ value: `${t.id}|in`, label: t.inverse_label ?? `(reverse of) ${t.label}` }] : []),
  ]).sort((a, b) => a.label.localeCompare(b.label))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const [typeId, direction] = typeAndDirection.split('|')
    const [source, target] = direction === 'out' ? [entity.id, other!.id] : [other!.id, entity.id]
    await save.mutateAsync(() => api.post('/relationships', {
      source_entity_id: source, target_entity_id: target, relationship_type_id: typeId,
      description: description.trim() || null, scope, lecture_id: scope === 'lecture' ? lectureId || null : null,
      status_code: status,
      contexts: conditionValue.trim() ? [{ context_kind_id: conditionKind, value_text: conditionValue.trim() }] : [],
    }))
    onClose()
  }

  return (
    <Dialog title={`New relationship for ${entity.name}`} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label>{entity.name} …
          <select value={typeAndDirection} onChange={(e) => setTypeAndDirection(e.target.value)} required>
            <option value="" disabled>choose a relationship</option>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label>… which entity?
          <EntityPicker value={other} onChange={setOther} excludeId={entity.id} />
        </label>
        <label>Mechanism / explanation <span className="hint">(optional)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <label>Condition <span className="hint">(optional — only true when…; more can be added later)</span>
          <span className="inline-form">
            <select value={conditionKind} onChange={(e) => setConditionKind(e.target.value)} aria-label="Kind of condition">
              {lookups?.context_kinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
            <input value={conditionValue} onChange={(e) => setConditionValue(e.target.value)}
              placeholder="e.g. adults" aria-label="Condition value" />
          </span>
        </label>
        <label>Kind of knowledge
          <select value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
            {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        {scope === 'lecture' && (
          <label>Lecture
            <select value={lectureId} onChange={(e) => setLectureId(e.target.value)}>
              <option value="">— not recorded —</option>
              {lectures?.map((l) => <option key={l.id} value={l.id}>{[l.course_code, l.title].filter(Boolean).join(' · ')}</option>)}
            </select>
          </label>
        )}
        <label>Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {lookups?.statuses.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
          </select>
        </label>
        <ErrorText error={save.error} />
        <div className="actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={save.isPending || !other}>Add relationship</button>
        </div>
      </form>
    </Dialog>
  )
}

function EditRelationship({ rel, onClose }: { rel: Relationship; onClose: () => void }) {
  const save = useSave()
  const [description, setDescription] = useState(rel.description ?? '')
  const [reason, setReason] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    await save.mutateAsync(() => api.patch(`/relationships/${rel.id}`, {
      description: description.trim() || null, reason: reason.trim() || null,
    }))
    onClose()
  }
  return (
    <Dialog title={`Edit: ${rel.label} ${rel.other_name}`} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label>Mechanism / explanation
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        </label>
        <label>Reason for this change <span className="hint">(optional)</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <p className="hint">To connect different entities or change the type, archive this relationship and add a new one.</p>
        <ErrorText error={save.error} />
        <div className="actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={save.isPending}>Save</button>
        </div>
      </form>
    </Dialog>
  )
}

function RelationshipRow({ rel, readOnly }: { rel: Relationship; readOnly: boolean }) {
  const save = useSave()
  const [editing, setEditing] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const archived = !!rel.archived_at
  const archive = () => {
    const reason = askReason(`Archive "${rel.label} ${rel.other_name}"? The two entities are not affected.`)
    if (reason !== null) save.mutate(() => api.post(`/relationships/${rel.id}/archive`, { reason: reason || null }))
  }
  return (
    <li className={`relationship scope-${rel.scope}${archived ? ' archived' : ''}`}>
      <div className="entry-meta">
        <a href={entityLink(rel.other_id)} className={rel.other_archived ? 'archived' : ''}>{rel.other_name}</a>
        {rel.scope !== 'general' && (
          <span className="scope-label">{rel.scope}{rel.lecture_title && ` · ${rel.lecture_title}`}</span>
        )}
        <StatusBadge code={rel.status_code} />
        {archived && <span className="muted">archived{rel.archive_reason && `: ${rel.archive_reason}`}</span>}
      </div>
      {rel.description && <div className="markdown"><Markdown>{rel.description}</Markdown></div>}
      <Conditions owner="relationships" ownerId={rel.id} conditions={rel.contexts} readOnly={readOnly || archived} />
      <div className="entry-actions">
        {!readOnly && !archived && <button className="link" onClick={() => setEditing(true)}>Edit</button>}
        {!readOnly && !archived && <button className="link" onClick={archive}>Archive</button>}
        {!readOnly && archived && (
          <button className="link" onClick={() => save.mutate(() => api.post(`/relationships/${rel.id}/unarchive`))}>Restore</button>
        )}
        <button className="link" onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? 'Hide history' : `History (v${rel.version})`}
        </button>
      </div>
      <ErrorText error={save.error} />
      {showHistory && <History kind="relationships" id={rel.id} />}
      {editing && <EditRelationship rel={rel} onClose={() => setEditing(false)} />}
    </li>
  )
}

export function Relationships({ entity, showArchived }: { entity: Entity; showArchived: boolean }) {
  const [adding, setAdding] = useState(false)
  const { data } = useQuery({
    queryKey: ['relationships', entity.id, showArchived],
    queryFn: () => api.get<Relationship[]>(`/entities/${entity.id}/relationships?include_archived=${showArchived}`),
  })
  const readOnly = !!entity.archived_at
  const groups = new Map<string, Relationship[]>()
  data?.forEach((r) => groups.set(r.label, [...(groups.get(r.label) ?? []), r]))

  return (
    <section className="knowledge-section">
      <div className="section-head">
        <h2>Related concepts</h2>
        {!readOnly && <button className="link" onClick={() => setAdding(true)}>+ Add relationship</button>}
      </div>
      {data?.length === 0 && <p className="muted">No relationships yet.</p>}
      {[...groups].map(([label, rels]) => (
        <div key={label} className="rel-group">
          <h3>{entity.name} <em>{label}</em></h3>
          <ul>{rels.map((r) => <RelationshipRow key={r.id} rel={r} readOnly={readOnly} />)}</ul>
        </div>
      ))}
      {adding && <RelationshipForm entity={entity} onClose={() => setAdding(false)} />}
    </section>
  )
}
