// Create a new entity, or edit an existing one.
import { useState, type FormEvent } from 'react'
import { api, ApiError, templateSections, uploadImage, useLookups, useSave, type Entity } from '../api'
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
  const [bodies, setBodies] = useState<Record<string, string>>({})
  const [scope, setScope] = useState('general')
  const [image, setImage] = useState<File | null>(null)
  const [imageError, setImageError] = useState('')
  const boxes = lookups ? templateSections(lookups, typeId) : []
  const pickImage = (file: File | null) => {
    const tooBig = !!file && file.size > 8 * 1024 * 1024
    setImageError(tooBig ? 'This image is larger than 8 MB.' : '')
    setImage(tooBig ? null : file)
  }

  async function submit(allowDuplicate = false) {
    const fields = { name, entity_type_id: typeId, description: description.trim() || null }
    try {
      if (entity) {
        await save.mutateAsync(() => api.patch(`/entities/${entity.id}`, { ...fields, reason: reason.trim() || null }))
        onClose()
      } else {
        const aliasList = aliases.split(',').map((a) => a.trim()).filter(Boolean).map((alias) => ({ alias }))
        // Only boxes of the chosen template that were actually filled in (switching type keeps your typing).
        const entries = boxes.filter((s) => bodies[s.id]?.trim()).map((s) => ({ section_id: s.id, body: bodies[s.id] }))
        const created: Entity = await save.mutateAsync(async () => {
          const made = await api.post<Entity>('/entities', {
            ...fields, status_code: status, aliases: aliasList, allow_duplicate: allowDuplicate, entries, entries_scope: scope,
          })
          if (image && boxes.some((s) => s.id === 'image')) {
            // The entity is already saved here, so a failed upload must not look like a failed create.
            await uploadImage(made.id, image).catch((err) => window.alert(`Saved, but the image failed: ${err.message}`))
          }
          return made
        })
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
          {boxes.length > 0 && (
            <fieldset className="choices template-boxes">
              <legend>Details <span className="hint">(all optional — fill in what you have)</span></legend>
              <label>Save this information as
                <select value={scope} onChange={(e) => setScope(e.target.value)}>
                  <option value="general">General scientific knowledge</option>
                  <option value="lecture">Lecture-specific</option>
                  <option value="personal">Personal</option>
                  <option value="both">Both general and lecture (two linked entries)</option>
                </select>
              </label>
              {boxes.map((s) => s.id === 'image' ? (
                <label key={s.id}>{s.label} <span className="hint">(PNG, JPEG, GIF or WebP, up to 8 MB)</span>
                  <input type="file" accept="image/png,image/jpeg,image/gif,image/webp"
                    onChange={(e) => pickImage(e.target.files?.[0] ?? null)} />
                  {imageError && <span className="error">{imageError}</span>}
                </label>
              ) : (
                <label key={s.id}>{s.label}
                  <textarea rows={2} value={bodies[s.id] ?? ''}
                    onChange={(e) => setBodies({ ...bodies, [s.id]: e.target.value })} />
                </label>
              ))}
            </fieldset>
          )}
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
