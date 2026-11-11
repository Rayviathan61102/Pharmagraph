// Entity templates: which topics an entity type shows, and in what order. Custom templates are new entity types.
import { useState, type FormEvent } from 'react'
import { api, templateSections, useLookups, useSave, type EntityType, type Lookups, type Section } from '../api'
import { ErrorText } from '../ui'

function TemplateEditor({ type, lookups, onDeleted }: { type: EntityType; lookups: Lookups; onDeleted: () => void }) {
  const save = useSave()
  const [label, setLabel] = useState(type.label)
  const [sections, setSections] = useState<Section[]>(templateSections(lookups, type.id))
  const [newTopic, setNewTopic] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [saved, setSaved] = useState(false)
  const available = lookups.sections.filter((s) => !sections.some((x) => x.id === s.id))

  const change = (next: Section[]) => { setSections(next); setSaved(false) }
  const move = (i: number, by: number) => {
    const next = [...sections]
    next.splice(i + by, 0, ...next.splice(i, 1))
    change(next)
  }
  const addNew = async () => {
    const created: Section = await save.mutateAsync(() => api.post('/sections', { label: newTopic.trim() }))
    if (!sections.some((s) => s.id === created.id)) change([...sections, created])
    setNewTopic('')
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    await save.mutateAsync(() => api.patch(`/templates/${type.id}`, { label, sections: sections.map((s) => s.id) }))
    setSaved(true)
  }
  const remove = async () => {
    await save.mutateAsync(() => api.post(`/templates/${type.id}/archive`))
    onDeleted()
  }

  return (
    <form onSubmit={submit} className="form template-editor">
      <label>Template name<input value={label} onChange={(e) => { setLabel(e.target.value); setSaved(false) }} required /></label>
      <ol className="template-topics" aria-label="Topics in this template">
        {sections.map((s, i) => (
          <li key={s.id}>
            <span>{s.label}</span>
            <button type="button" disabled={i === 0} aria-label={`Move ${s.label} up`} onClick={() => move(i, -1)}>↑</button>
            <button type="button" disabled={i === sections.length - 1} aria-label={`Move ${s.label} down`} onClick={() => move(i, 1)}>↓</button>
            <button type="button" aria-label={`Remove ${s.label}`} onClick={() => change(sections.filter((x) => x.id !== s.id))}>✕</button>
          </li>
        ))}
        {sections.length === 0 && <li className="muted">No topics yet.</li>}
      </ol>
      <p className="hint">Removing a topic never deletes what you wrote; existing entries still appear on the page.</p>
      <label>Add an existing topic
        <select value="" onChange={(e) => { const s = available.find((x) => x.id === e.target.value); if (s) change([...sections, s]) }}>
          <option value="">Choose…</option>
          {available.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
      <label>Or create a new topic
        <span className="inline-form">
          <input value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder="e.g. Mode of transmission" aria-label="New topic name" />
          <button type="button" disabled={!newTopic.trim() || save.isPending} onClick={addNew}>Add topic</button>
        </span>
      </label>
      <ErrorText error={save.error} />
      {saved && <p className="ok" role="status">Template saved.</p>}
      {confirmingDelete && <p className="warning" role="alert">Delete the template “{type.label}”?</p>}
      <div className="actions">
        {!type.is_builtin && !confirmingDelete && <button type="button" className="danger" onClick={() => setConfirmingDelete(true)}>Delete template</button>}
        {confirmingDelete && <button type="button" className="danger" disabled={save.isPending} onClick={remove}>Yes, delete</button>}
        <span style={{ flex: 1 }} />
        <button type="submit" className="primary" disabled={save.isPending}>Save template</button>
      </div>
    </form>
  )
}

export function TemplatesPage() {
  const { data: lookups } = useLookups()
  const save = useSave()
  const [typeId, setTypeId] = useState('drug')
  const [name, setName] = useState('')
  if (!lookups) return null
  const type = lookups.entity_types.find((t) => t.id === typeId)

  const create = async (e: FormEvent) => {
    e.preventDefault()
    const created: EntityType = await save.mutateAsync(() => api.post('/templates', { label: name.trim() }))
    setName('')
    setTypeId(created.id)
  }

  return (
    <article className="templates-page">
      <h1>Templates</h1>
      <p className="muted">A template is the list of topics an entity type shows, and the optional boxes in “New entity”.</p>
      <form onSubmit={create} className="inline-form">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New template name, e.g. Vaccine" required aria-label="New template name" />
        <button type="submit" disabled={save.isPending}>+ Create template</button>
      </form>
      <ErrorText error={save.error} />
      <label className="template-choice">Template
        <select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          {lookups.entity_types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </label>
      {type && <TemplateEditor key={type.id} type={type} lookups={lookups} onDeleted={() => setTypeId('drug')} />}
    </article>
  )
}
