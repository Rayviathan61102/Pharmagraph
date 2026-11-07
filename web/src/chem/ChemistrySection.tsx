// Extra subsections inside "Chemical properties": the drawn structure, and the metabolites.
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api, useLookups, useSave, type Entity, type EntitySummary, type Relationship } from '../api'
import { EntityPicker } from '../EntityPicker'
import { useRelationships } from '../entity/Relationships'
import { StatusButton } from '../entity/StatusDialog'
import { Dialog, ErrorText, askReason, entityLink, go } from '../ui'
import { describe, useRDKit } from './chem'
import { StructureView, type Highlight } from './StructureView'

export type Structure = {
  id: string; entity_id: string; entity_name: string; label: string | null; original_smiles: string
  canonical_smiles: string | null; canonicalizer: string | null; molecular_formula: string | null
  molecular_weight: number | null; annotations: (Highlight & { status_code: string })[]
}

function StructureForm({ entityId, onClose }: { entityId: string; onClose: () => void }) {
  const rdkit = useRDKit()
  const save = useSave()
  const [smiles, setSmiles] = useState('')
  const [label, setLabel] = useState('')
  const info = rdkit && smiles.trim() ? describe(rdkit, smiles.trim()) : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    await save.mutateAsync(() => api.post(`/entities/${entityId}/structures`, {
      original_smiles: smiles.trim(), label: label.trim() || null, ...info,
    }))
    onClose()
  }
  return (
    <Dialog title="Add chemical structure" onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label>SMILES <span className="hint">(e.g. from PubChem: “Isomeric SMILES”)</span>
          <textarea value={smiles} onChange={(e) => setSmiles(e.target.value)} rows={2} required autoFocus
            placeholder="C#C[C@]1(O)CC[C@H]2[C@@H]3CCc4cc(O)ccc4[C@H]3CC[C@@]21C" />
        </label>
        <label>Label <span className="hint">(optional, e.g. “free base”, “sodium salt”)</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        {smiles.trim() && (
          <div className="structure-preview">
            <StructureView smiles={smiles.trim()} width={320} height={200} />
            {info && <p className="muted">{info.molecular_formula} · {info.molecular_weight} g/mol</p>}
          </div>
        )}
        <ErrorText error={save.error} />
        <div className="actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={save.isPending || !info}>Save structure</button>
        </div>
      </form>
    </Dialog>
  )
}

function ChemicalStructure({ entity, readOnly }: { entity: Entity; readOnly: boolean }) {
  const [adding, setAdding] = useState(false)
  const { data: structures } = useQuery({
    queryKey: ['structures', entity.id], queryFn: () => api.get<Structure[]>(`/entities/${entity.id}/structures`),
  })
  return (
    <div className="subsection">
      <div className="section-head">
        <h3>Chemical structure</h3>
        {!readOnly && <button className="link" onClick={() => setAdding(true)}>+ Add structure</button>}
      </div>
      {structures?.length === 0 && <p className="muted">No structure yet.</p>}
      <div className="structures">
        {structures?.map((s) => (
          <figure key={s.id} className="structure-card" title="Double-click to open the structure details">
            <StructureView smiles={s.original_smiles} highlights={s.annotations} width={360} height={240}
              label={`Structure of ${entity.name}`} onDoubleClick={() => go(`#/structure/${s.id}`)} />
            <figcaption>
              {s.label && <strong>{s.label} · </strong>}
              {s.molecular_formula} · {s.molecular_weight} g/mol
              {s.annotations.length > 0 && <> · {s.annotations.length} highlighted feature{s.annotations.length > 1 ? 's' : ''}</>}
              {' · '}<a href={`#/structure/${s.id}`}>Open details</a>
            </figcaption>
          </figure>
        ))}
      </div>
      {adding && <StructureForm entityId={entity.id} onClose={() => setAdding(false)} />}
    </div>
  )
}

// ---------- Metabolites ----------

export const ACTIVITIES = ['active', 'inactive', 'hepatotoxic', 'nephrotoxic', 'neurotoxic', 'cardiotoxic', 'reactive']
const activityClass = (a: string) =>
  a === 'active' ? 'act-active' : a === 'inactive' ? 'act-inactive' : a === 'reactive' ? 'act-reactive' : 'act-toxic'
// The conditions this form manages; any other condition on the link (e.g. population) is left alone.
const METABOLITE_KINDS = ['metabolite_activity', 'formed_by', 'metabolic_pathway', 'metabolite_share']
const isPercent = (v: string | null) => !!v && v.trim().endsWith('%')

function MetaboliteForm({ entity, existing, onClose }: { entity: Entity; existing?: Relationship; onClose: () => void }) {
  const { data: lookups } = useLookups()
  const save = useSave()
  const of = (kind: string) => existing?.contexts.filter((c) => c.context_kind_id === kind) ?? []
  const savedActivities = of('metabolite_activity').map((c) => c.value_text ?? '')
  const savedEnzyme = of('formed_by').find((c) => c.value_entity_id)
  const savedShare = of('metabolite_share').map((c) => c.value_text)

  const [metabolite, setMetabolite] = useState<EntitySummary | null>(null)
  const [newName, setNewName] = useState('')
  const [activities, setActivities] = useState(savedActivities.filter((a) => ACTIVITIES.includes(a)))
  const [other, setOther] = useState(savedActivities.filter((a) => !ACTIVITIES.includes(a)).join(', '))
  const [enzyme, setEnzyme] = useState<EntitySummary | null>(savedEnzyme
    ? { id: savedEnzyme.value_entity_id!, name: savedEnzyme.value_entity_name ?? '', entity_type_id: '', status_code: '', archived_at: null }
    : null)
  const [pathway, setPathway] = useState(of('metabolic_pathway').map((c) => c.value_text).join(', '))
  const [share, setShare] = useState(savedShare.find((v) => !isPercent(v)) ?? '')
  const [percent, setPercent] = useState((savedShare.find(isPercent) ?? '').replace('%', '').trim())
  const [status, setStatus] = useState('proposed')
  const [reason, setReason] = useState('')

  const contexts = () => [
    ...[...activities, ...other.split(',').map((s) => s.trim()).filter(Boolean)]
      .map((value_text) => ({ context_kind_id: 'metabolite_activity', value_text })),
    ...(enzyme ? [{ context_kind_id: 'formed_by', value_entity_id: enzyme.id }] : []),
    ...(pathway.trim() ? [{ context_kind_id: 'metabolic_pathway', value_text: pathway.trim() }] : []),
    ...(share ? [{ context_kind_id: 'metabolite_share', value_text: share }] : []),
    ...(percent.trim() ? [{ context_kind_id: 'metabolite_share', value_text: `${percent.trim()}%` }] : []),
  ]

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    await save.mutateAsync(async () => {
      if (existing) {
        return api.put(`/relationships/${existing.id}/contexts`, {
          kinds: METABOLITE_KINDS, contexts: contexts(), reason: reason.trim() || 'Edited metabolite details',
        })
      }
      const targetId = metabolite?.id
        ?? (await api.post<EntitySummary>('/entities', { entity_type_id: 'metabolite', name: newName.trim() })).id
      return api.post('/relationships', {
        source_entity_id: entity.id, target_entity_id: targetId, relationship_type_id: 'HAS_METABOLITE',
        status_code: status, contexts: contexts(),
      })
    })
    onClose()
  }
  const toggle = (a: string) => setActivities(activities.includes(a) ? activities.filter((x) => x !== a) : [...activities, a])

  return (
    <Dialog title={existing ? `Edit metabolite: ${existing.other_name}` : `Metabolite of ${entity.name}`} onClose={onClose}>
      <form onSubmit={submit} className="form">
        {!existing && <>
          <label>Metabolite <span className="hint">(search, or type a new name below)</span>
            <EntityPicker value={metabolite} onChange={setMetabolite} excludeId={entity.id} />
          </label>
          {!metabolite && (
            <label>…or create a new metabolite
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. NAPQI" />
            </label>
          )}
        </>}
        <span className="row">
          <label>Major or minor?
            <select value={share} onChange={(e) => setShare(e.target.value)}>
              <option value="">— not recorded —</option>
              <option value="Major">Major</option>
              <option value="Minor">Minor</option>
            </select>
          </label>
          <label>Share of the dose <span className="hint">(%)</span>
            <input type="number" min={0} max={100} step="any" value={percent}
              onChange={(e) => setPercent(e.target.value)} placeholder="e.g. 55" />
          </label>
        </span>
        <fieldset className="choices">
          <legend>Activity / toxicity</legend>
          <span className="activity-choices">
            {ACTIVITIES.map((a) => (
              <label key={a} className="check"><input type="checkbox" checked={activities.includes(a)} onChange={() => toggle(a)} />{a}</label>
            ))}
          </span>
          <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="other (comma-separated), e.g. ototoxic"
            aria-label="Other activity" />
        </fieldset>
        <label>Formed by <span className="hint">(enzyme, optional)</span>
          <EntityPicker value={enzyme} onChange={setEnzyme} excludeId={entity.id} />
        </label>
        <label>Pathway <span className="hint">(optional)</span>
          <input value={pathway} onChange={(e) => setPathway(e.target.value)} placeholder="e.g. N-hydroxylation, glucuronidation" />
        </label>
        {existing ? (
          <label>Reason for this change <span className="hint">(optional)</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
        ) : (
          <label>Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {lookups?.statuses.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
            </select>
          </label>
        )}
        <ErrorText error={save.error} />
        <div className="actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary"
            disabled={save.isPending || (!existing && !metabolite && !newName.trim())}>
            {existing ? 'Save' : 'Add metabolite'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function Metabolites({ entity, readOnly }: { entity: Entity; readOnly: boolean }) {
  const save = useSave()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Relationship | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const { data: relationships } = useRelationships(entity, false)
  const all = (relationships ?? []).filter((r) => r.relationship_type_id === 'HAS_METABOLITE' && r.direction === 'out')
  const isInactive = (m: Relationship) =>
    m.contexts.some((c) => c.context_kind_id === 'metabolite_activity' && c.value_text === 'inactive')
  const hiddenCount = all.filter(isInactive).length
  const metabolites = showInactive ? all : all.filter((m) => !isInactive(m))
  const remove = (m: Relationship) => {
    const reason = askReason(`Remove ${m.other_name} from the metabolites of ${entity.name}? It is archived, not deleted.`)
    if (reason !== null) save.mutate(() => api.post(`/relationships/${m.id}/archive`, { reason: reason || null }))
  }

  return (
    <div className="subsection">
      <div className="section-head">
        <h3>Metabolites</h3>
        {!readOnly && <button className="link" onClick={() => setAdding(true)}>+ Add metabolite</button>}
      </div>
      {hiddenCount > 0 && (
        <label className="check">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive metabolites ({hiddenCount})
        </label>
      )}
      {metabolites.length === 0 ? <p className="muted">{all.length ? 'Only inactive metabolites are recorded.' : 'No metabolites recorded yet.'}</p> : (
        <table className="table metabolites">
          <thead>
            <tr><th>Metabolite</th><th>Share</th><th>Activity / toxicity</th><th>Formed by</th><th>Pathway</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {metabolites.map((m) => {
              const of = (kind: string) => m.contexts.filter((c) => c.context_kind_id === kind)
              return (
                <tr key={m.id} className={isInactive(m) ? 'inactive-row' : ''}>
                  <td><a href={entityLink(m.other_id)}>{m.other_name}</a></td>
                  <td>{of('metabolite_share').map((c) => c.value_text).join(' · ')}</td>
                  <td>{of('metabolite_activity').map((c) => (
                    <span key={c.id} className={`activity ${activityClass(c.value_text ?? '')}`}>{c.value_text}</span>
                  ))}</td>
                  <td>{of('formed_by').map((c) => c.value_entity_id
                    ? <a key={c.id} href={entityLink(c.value_entity_id)}>{c.value_entity_name}</a>
                    : <span key={c.id}>{c.value_text}</span>)}</td>
                  <td>{of('metabolic_pathway').map((c) => c.value_text).join(', ')}</td>
                  <td><StatusButton kind="relationships" id={m.id} current={m.status_code} readOnly={readOnly} /></td>
                  <td className="row-actions">
                    {!readOnly && <button className="link" onClick={() => setEditing(m)}>Edit</button>}
                    {!readOnly && <button className="link" onClick={() => remove(m)}>Remove</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <ErrorText error={save.error} />
      <p className="hint">Sources and full history for each metabolite are under “Related concepts”.</p>
      {adding && <MetaboliteForm entity={entity} onClose={() => setAdding(false)} />}
      {editing && <MetaboliteForm entity={entity} existing={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

/** Shown at the top of the "Chemical properties" section. */
export function ChemistrySection({ entity, readOnly }: { entity: Entity; readOnly: boolean }) {
  return (
    <>
      <ChemicalStructure entity={entity} readOnly={readOnly} />
      <Metabolites entity={entity} readOnly={readOnly} />
    </>
  )
}
