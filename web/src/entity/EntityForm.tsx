// Create a new entity, or edit an existing one.
import { useState, type FormEvent } from 'react'
import { api, ApiError, useLookups, useSave, type Entity } from '../api'
import { Dialog, ErrorText, entityLink, go } from '../ui'

type Duplicate = { id: string; name: string; entity_type_id: string; archived: number }

export function EntityForm({ entity, onClose }: { entity?: Entity; onClose: () => void }) {
  const { data: lookups } = useLookups()
  const save = useSave()
  const [name, setName] = useState(entity?.name ?? '')
  const [typeId, setTypeId] = useState(entity?.entity_type_id ?? 'drug')
  const [description, setDescription] = useState(entity?.description ?? '')
  const [status, setStatus] = useState('proposed')
  const [aliases, setAliases] = useState('')
  const [reason, setReason] = useState('')
  const [duplicates, setDuplicates] = useState<Duplicate[] | null>(null)

  async function submit(allowDuplicate = false) {
    const fields = { name, entity_type_id: typeId, description: description.trim() || null }
    try {
      if (entity) {
        await save.mutateAsync(() => api.patch(`/entities/${entity.id}`, { ...fields, reason: reason.trim() || null }))
        onClose()
      } else {
        const aliasList = aliases.split(',').map((a) => a.trim()).filter(Boolean).map((alias) => ({ alias }))
        const created: Entity = await save.mutateAsync(() => api.post('/entities', {
          ...fields, status_code: status, aliases: aliasList, allow_duplicate: allowDuplicate,
        }))
        onClose()
        go(entityLink(created.id))
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setDuplicates(e.body.possible_duplicates)
    }
  }

  const onSubmit = (e: FormEvent) => { e.preventDefault(); submit() }

  return (
    <Dialog title={entity ? `Edit ${entity.name}` : 'New entity'} onClose={onClose}>
      <form onSubmit={onSubmit} className="form">
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></label>
        <label>Type
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            {lookups?.entity_types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label>Short description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        {!entity && <>
          <label>Other names <span className="hint">(synonyms, abbreviations, Thai name — separate with commas)</span>
            <input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="Acetaminophen, APAP" />
          </label>
          <label>Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {lookups?.statuses.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
            </select>
          </label>
        </>}
        {entity && (
          <label>Reason for this change <span className="hint">(optional)</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
        )}

        {duplicates && (
          <div className="warning" role="alert">
            <p>This may already exist:</p>
            <ul>
              {duplicates.map((d) => (
                <li key={d.id}>
                  <a href={entityLink(d.id)} onClick={onClose}>{d.name}</a>
                  {d.archived ? ' (archived)' : ''}
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => submit(true)}>Create anyway</button>
          </div>
        )}
        {!duplicates && <ErrorText error={save.error} />}

        <div className="actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={save.isPending}>{entity ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </Dialog>
  )
}
