// Personal notes (M12): an inbox for loose thoughts, and notes attached to entities or knowledge entries.
// Notes are always shown as personal (green, dotted) and never change the scientific entries they sit on.
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import Markdown from 'react-markdown'
import { api, useSave, type EntitySummary } from '../api'
import { EntityPicker } from '../EntityPicker'
import { ErrorText, entityLink, formatTime } from '../ui'

export type Note = {
  id: string; body: string; stage: string; created_at: string; updated_at: string; archived_at: string | null
  entity_id: string | null; knowledge_entry_id: string | null; relationship_id: string | null; source_id: string | null
  about_entity_id: string | null; about_entity_name: string | null; section_label: string | null
  entry_scope: string | null; source_title: string | null
}

const STAGES = ['inbox', 'draft', 'connected', 'reviewed', 'verified']

export const useEntityNotes = (entityId: string) => useQuery({
  queryKey: ['notes', 'entity', entityId], queryFn: () => api.get<Note[]>(`/notes?entity_id=${entityId}`),
})
export const useInboxCount = () => useQuery({
  queryKey: ['notes', 'inbox-count'], queryFn: () => api.get<{ count: number }>('/notes/inbox-count'),
})

/** Where a note is attached, in words. */
function attachedTo(n: Note) {
  if (n.knowledge_entry_id) return <>on <a href={entityLink(n.about_entity_id!)}>{n.about_entity_name}</a> — {n.section_label} ({n.entry_scope})</>
  if (n.entity_id) return <>on <a href={entityLink(n.entity_id)}>{n.about_entity_name}</a></>
  if (n.relationship_id) return <>on a relationship</>
  if (n.source_id) return <>on source “{n.source_title}”</>
  return <>in the inbox</>
}

/** Write a new note. `target` attaches it (e.g. { entity_id }); without one it goes to the inbox. */
export function NoteComposer({ target, placeholder, onDone }: {
  target?: Record<string, string>; placeholder?: string; onDone?: () => void
}) {
  const save = useSave()
  const [body, setBody] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    await save.mutateAsync(() => api.post('/notes', { body, ...target }))
    setBody('')
    onDone?.()
  }
  return (
    <form onSubmit={submit} className="note-composer">
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} required
        placeholder={placeholder ?? 'Write a note (Markdown)…'} aria-label="New note" />
      <div className="actions">
        {onDone && <button type="button" onClick={onDone}>Cancel</button>}
        <button type="submit" className="primary" disabled={save.isPending}>Save note</button>
      </div>
      <ErrorText error={save.error} />
    </form>
  )
}

export function NoteCard({ note, showWhere = true }: { note: Note; showWhere?: boolean }) {
  const save = useSave()
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(note.body)
  const [attaching, setAttaching] = useState(false)
  const [target, setTarget] = useState<EntitySummary | null>(null)
  const archived = !!note.archived_at
  const patch = (changes: object) => save.mutate(() => api.patch(`/notes/${note.id}`, changes))

  return (
    <div className={`note-card${archived ? ' archived' : ''}`}>
      {editing ? (
        <form className="note-composer" onSubmit={(e) => { e.preventDefault(); patch({ body }); setEditing(false) }}>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} required aria-label="Note text" />
          <div className="actions">
            <button type="button" onClick={() => { setBody(note.body); setEditing(false) }}>Cancel</button>
            <button type="submit" className="primary">Save</button>
          </div>
        </form>
      ) : (
        <div className="markdown"><Markdown>{note.body}</Markdown></div>
      )}
      <div className="entry-meta">
        <span className="scope-label scope-personal">Note</span>
        {showWhere && <span className="muted">{attachedTo(note)}</span>}
        <span className="muted">{formatTime(note.updated_at)}</span>
        {!archived && (
          <select value={note.stage} onChange={(e) => { const stage = e.target.value; patch({ stage }) }} aria-label="Note stage">
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>
      <div className="entry-actions">
        {!archived && !editing && <button className="link" onClick={() => setEditing(true)}>Edit</button>}
        {!archived && !note.entity_id && !note.knowledge_entry_id && (
          <button className="link" onClick={() => setAttaching(!attaching)}>Attach to an entity</button>
        )}
        {!archived && <button className="link" onClick={() => save.mutate(() => api.post(`/notes/${note.id}/archive`))}>Archive</button>}
        {archived && <button className="link" onClick={() => save.mutate(() => api.post(`/notes/${note.id}/unarchive`))}>Restore</button>}
      </div>
      {attaching && (
        <div className="inline-form">
          <EntityPicker value={target} onChange={setTarget} />
          <button disabled={!target} onClick={() => { patch({ entity_id: target!.id, stage: 'connected' }); setAttaching(false) }}>Attach</button>
        </div>
      )}
      <ErrorText error={save.error} />
    </div>
  )
}

/** "My notes" on an entity page: notes on the entity itself and on its knowledge entries. */
export function EntityNotes({ entityId, readOnly }: { entityId: string; readOnly: boolean }) {
  const { data } = useEntityNotes(entityId)
  const [adding, setAdding] = useState(false)
  return (
    <section id="sec-notes" className="knowledge-section notes-section">
      <div className="section-head">
        <h2>My notes</h2>
        {!readOnly && !adding && <button className="link" onClick={() => setAdding(true)}>+ Note</button>}
      </div>
      {adding && <NoteComposer target={{ entity_id: entityId }} onDone={() => setAdding(false)} />}
      {data?.length === 0 && !adding && <p className="muted">No personal notes yet. Notes never change the scientific entries above.</p>}
      {data?.map((n) => <NoteCard key={n.id} note={n} />)}
    </section>
  )
}

/** Small "+ Note" for one knowledge entry, and the notes already on it. */
export function EntryNotes({ entityId, entryId, readOnly }: { entityId: string; entryId: string; readOnly: boolean }) {
  const { data } = useEntityNotes(entityId)
  const [adding, setAdding] = useState(false)
  const mine = (data ?? []).filter((n) => n.knowledge_entry_id === entryId)
  return (
    <>
      {mine.map((n) => <NoteCard key={n.id} note={n} showWhere={false} />)}
      {!readOnly && !adding && <button className="link" onClick={() => setAdding(true)}>+ Note</button>}
      {adding && <NoteComposer target={{ knowledge_entry_id: entryId }} onDone={() => setAdding(false)}
        placeholder="A personal note on this entry (it will not change the entry)…" />}
    </>
  )
}

export function NotesPage() {
  const [view, setView] = useState<'inbox' | 'all' | 'archived'>('inbox')
  const { data } = useQuery({
    queryKey: ['notes', 'page', view],
    queryFn: () => api.get<Note[]>(view === 'inbox' ? '/notes?inbox=true' : `/notes?include_archived=${view === 'archived'}`),
  })
  const shown = view === 'archived' ? data?.filter((n) => n.archived_at) : data
  return (
    <article className="notes-page">
      <h1>Notes</h1>
      <p className="muted">Your personal scratchpad. Jot things down here, then attach them to an entity when you know where they belong.</p>
      <NoteComposer placeholder="Quick note to the inbox…" />
      <div className="tabs notes-tabs" role="tablist">
        {(['inbox', 'all', 'archived'] as const).map((v) => (
          <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'current' : ''} onClick={() => setView(v)}>
            {v === 'inbox' ? 'Inbox' : v === 'all' ? 'All notes' : 'Archived'}
          </button>
        ))}
      </div>
      {shown?.length === 0 && <p className="muted">Nothing here.</p>}
      {shown?.map((n) => <NoteCard key={n.id} note={n} />)}
    </article>
  )
}
