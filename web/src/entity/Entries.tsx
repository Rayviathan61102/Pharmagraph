// The knowledge sections of an entity page: Overview, Mechanism, Pharmacokinetics ... each with its entries.
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import Markdown from 'react-markdown'
import { api, templateSections, useLookups, useSave, type Entity, type Entry, type Lookups, type Section } from '../api'
import { History } from '../History'
import { ErrorText, askReason } from '../ui'
import { ChemistrySection } from '../chem/ChemistrySection'
import { EntryNotes } from '../notes/Notes'
import { Conditions } from './Conditions'
import { EntityImages } from './EntityImages'
import { EntryForm } from './EntryForm'
import { Evidence } from './Evidence'
import { StatusButton } from './StatusDialog'

const SCOPE_LABEL = { general: 'General', lecture: 'Lecture', personal: 'Personal' }

// Clinical sections where unverified text gets a visible caution (spec 13: clinical and dosage claims
// must be clearly distinguished from verified information).
export const CLINICAL_SECTIONS = new Set(['dosage', 'contraindications', 'interactions'])

function EntryCard({ entry, readOnly }: { entry: Entry; readOnly: boolean }) {
  const save = useSave()
  const [editing, setEditing] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const archived = !!entry.archived_at

  const archive = () => {
    const reason = askReason('Archive this entry? It will be hidden but never deleted.')
    if (reason !== null) save.mutate(() => api.post(`/entries/${entry.id}/archive`, { reason: reason || null }))
  }

  return (
    <div className={`entry scope-${entry.scope}${archived ? ' archived' : ''}`}>
      <div className="entry-meta">
        <span className="scope-label">{SCOPE_LABEL[entry.scope]}</span>
        {entry.scope === 'lecture' && (
          <span className="muted">
            {[entry.lecture_title, entry.professor_name].filter(Boolean).join(' · ') || 'lecture not recorded'}
          </span>
        )}
        {entry.counterpart_entry_id && <span className="muted" title="Saved with 'Both'">↔ linked version</span>}
        <StatusButton kind="entries" id={entry.id} current={entry.status_code} readOnly={readOnly || archived} />
        {archived && <span className="muted">archived{entry.archive_reason && `: ${entry.archive_reason}`}</span>}
        {entry.scope === 'general' && entry.evidence.length === 0 && <span className="unsourced">no source yet</span>}
      </div>
      {CLINICAL_SECTIONS.has(entry.section_id) && entry.status_code !== 'verified' && (
        <p className="caution">Not verified — always check current guidelines before any clinical use.</p>
      )}
      {entry.title && <h3>{entry.title}</h3>}
      <div className="markdown"><Markdown>{entry.body}</Markdown></div>
      <Conditions owner="entries" ownerId={entry.id} conditions={entry.contexts} readOnly={readOnly || archived} />
      <Evidence owner="entries" ownerId={entry.id} evidence={entry.evidence} readOnly={readOnly || archived} />
      <EntryNotes entityId={entry.entity_id} entryId={entry.id} readOnly={readOnly || archived} />
      <div className="entry-actions">
        {!readOnly && !archived && <button className="link" onClick={() => setEditing(true)}>Edit</button>}
        {!readOnly && !archived && <button className="link" onClick={archive}>Archive</button>}
        {!readOnly && archived && (
          <button className="link" onClick={() => save.mutate(() => api.post(`/entries/${entry.id}/unarchive`))}>Restore</button>
        )}
        <button className="link" onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? 'Hide history' : `History (v${entry.version})`}
        </button>
      </div>
      <ErrorText error={save.error} />
      {showHistory && <History kind="entries" id={entry.id} />}
      {editing && <EntryForm entityId={entry.entity_id} entry={entry} onClose={() => setEditing(false)} />}
    </div>
  )
}

export function useEntries(entity: Entity, showArchived: boolean) {
  return useQuery({
    queryKey: ['entries', entity.id, showArchived],
    queryFn: () => api.get<Entry[]>(`/entities/${entity.id}/entries?include_archived=${showArchived}`),
  })
}

/** The template's topics in its own order, then any other topic that already has entries. */
export function visibleSections(lookups: Lookups, entity: Entity, entries: Entry[]): Section[] {
  const template = templateSections(lookups, entity.entity_type_id)
  return [...template, ...lookups.sections.filter((s) =>
    !template.some((t) => t.id === s.id) && entries.some((e) => e.section_id === s.id))]
}

export function Entries({ entity, showArchived }: { entity: Entity; showArchived: boolean }) {
  const { data: lookups } = useLookups()
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const { data: entries } = useEntries(entity, showArchived)
  if (!lookups || !entries) return null
  const readOnly = !!entity.archived_at

  return (
    <>
      {visibleSections(lookups, entity, entries).map((section) => {
        const inSection = entries.filter((e) => e.section_id === section.id)
        return (
          <section key={section.id} id={`sec-${section.id}`} className="knowledge-section">
            <div className="section-head">
              <h2>{section.label}</h2>
              {!readOnly && section.id !== 'image' && <button className="link" onClick={() => setAddingTo(section.id)}>+ Add</button>}
            </div>
            {section.id === 'image' && <EntityImages entity={entity} readOnly={readOnly} />}
            {section.id === 'chemistry' && <ChemistrySection entity={entity} readOnly={readOnly} />}
            {section.id === 'chemistry' && inSection.length > 0 && <h3 className="subhead">Notes</h3>}
            {inSection.length === 0 && section.id !== 'chemistry' && section.id !== 'image' && <p className="muted">Nothing recorded yet.</p>}
            {inSection.map((e) => <EntryCard key={e.id} entry={e} readOnly={readOnly} />)}
          </section>
        )
      })}
      {!readOnly && (
        <button onClick={() => setAddingTo('overview')}>+ Add knowledge to another section</button>
      )}
      {addingTo && <EntryForm entityId={entity.id} sectionId={addingTo} onClose={() => setAddingTo(null)} />}
    </>
  )
}
