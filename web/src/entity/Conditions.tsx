// Conditions on a claim ("Population: adults", "Jurisdiction: TH"), for entries and relationships.
import { useState, type FormEvent } from 'react'
import { api, useLookups, useSave, type Condition } from '../api'
import { ErrorText } from '../ui'

export const conditionText = (c: Condition) => `${c.kind_label}: ${c.value_text ?? c.value_entity_name}`

type Props = { owner: 'entries' | 'relationships'; ownerId: string; conditions: Condition[]; readOnly: boolean }

export function Conditions({ owner, ownerId, conditions, readOnly }: Props) {
  const { data: lookups } = useLookups()
  const save = useSave()
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState('population')
  const [value, setValue] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    await save.mutateAsync(() => api.post(`/${owner}/${ownerId}/contexts`, { context_kind_id: kind, value_text: value }))
    setValue('')
    setAdding(false)
  }

  return (
    <div className="conditions">
      {conditions.length > 0 && (
        <ul className="chips" aria-label="Conditions">
          {conditions.map((c) => (
            <li key={c.id} className="chip condition">
              {conditionText(c)}
              {!readOnly && (
                <button aria-label={`Remove condition ${conditionText(c)}`}
                  onClick={() => save.mutate(() => api.post(`/${owner}/${ownerId}/contexts/${c.id}/remove`))}>×</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && !adding && <button className="link" onClick={() => setAdding(true)}>+ Condition</button>}
      {adding && (
        <form onSubmit={submit} className="inline-form">
          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind of condition">
            {lookups?.context_kinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          <input value={value} onChange={(e) => setValue(e.target.value)} required autoFocus
            placeholder="e.g. adults, TH, 2024 edition" aria-label="Condition value" />
          <button type="submit" disabled={save.isPending}>Add</button>
          <button type="button" onClick={() => setAdding(false)}>Cancel</button>
        </form>
      )}
      <ErrorText error={save.error} />
    </div>
  )
}
