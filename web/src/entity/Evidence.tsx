// Sources supporting (or contradicting) one specific claim: a knowledge entry or a relationship.
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api, useSave, type Evidence as EvidenceItem, type Source } from '../api'
import { Dialog, ErrorText } from '../ui'

const SOURCE_TYPES = ['textbook', 'research_paper', 'clinical_guideline', 'drug_monograph', 'lecture_slides',
  'lecture_document', 'regulatory_document', 'website', 'other']
const EVIDENCE_TYPES = ['textbook_statement', 'guideline_recommendation', 'monograph_statement', 'primary_research',
  'systematic_review', 'review', 'lecture_statement', 'expert_opinion', 'other']
const words = (s: string) => s.replace(/_/g, ' ')

export const sourceLabel = (s: { source_title?: string; title?: string; edition: string | null; publication_date: string | null }) =>
  `${s.source_title ?? s.title}${s.edition ? `, ${s.edition} ed.` : ''}${s.publication_date ? ` (${s.publication_date})` : ''}`

type Owner = 'entries' | 'relationships'
const OWNER_FIELD = { entries: 'knowledge_entry_id', relationships: 'relationship_id' }

function EvidenceForm({ owner, ownerId, onClose }: { owner: Owner; ownerId: string; onClose: () => void }) {
  const save = useSave()
  const [q, setQ] = useState('')
  const [chosen, setChosen] = useState<Source | null>(null)
  const [creating, setCreating] = useState(false)
  const [source, setSource] = useState({ source_type: 'textbook', title: '', authors: '', organization: '',
    publication_date: '', edition: '', doi: '', url: '', jurisdiction: '' })
  const [ev, setEv] = useState({ stance: 'supports', evidence_type: 'textbook_statement', locator: '',
    claim_text: '', passage: '', verification_notes: '' })
  const { data: found } = useQuery({
    queryKey: ['sources', q], queryFn: () => api.get<Source[]>(`/sources?q=${encodeURIComponent(q)}`),
  })
  const setS = (k: keyof typeof source) => (e: { target: { value: string } }) => setSource({ ...source, [k]: e.target.value })
  const setE = (k: keyof typeof ev) => (e: { target: { value: string } }) => setEv({ ...ev, [k]: e.target.value })
  const blankToNull = (o: Record<string, string>) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.trim() || null]))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const title = chosen?.title ?? source.title
    const created = await save.mutateAsync(async () => {
      const sourceId = chosen?.id ?? (await api.post<Source>('/sources', blankToNull(source))).id
      return api.post<EvidenceItem & { suggest_disputed: boolean }>('/evidence', {
        ...blankToNull(ev), stance: ev.stance, evidence_type: ev.evidence_type,
        source_id: sourceId, [OWNER_FIELD[owner]]: ownerId,
      })
    })
    // Spec 4.4: a contradicting source must be brought to the user's attention, never acted on silently.
    if (created.suggest_disputed && window.confirm(`"${title}" contradicts this claim.\n\nMark the claim as Disputed?`)) {
      await save.mutateAsync(() => api.post(`/${owner}/${ownerId}/status`, {
        status_code: 'disputed', notes: `Contradicted by "${title}"${ev.locator ? `, ${ev.locator}` : ''}`,
      }))
    }
    onClose()
  }

  return (
    <Dialog title="Add a source for this claim" onClose={onClose}>
      <form onSubmit={submit} className="form">
        <fieldset className="choices">
          <legend>Source</legend>
          {chosen ? (
            <span className="inline-form">
              <span className="chip">{sourceLabel(chosen)}</span>
              <button type="button" onClick={() => setChosen(null)}>Change</button>
            </span>
          ) : creating ? (
            <>
              <label>Type
                <select value={source.source_type} onChange={setS('source_type')}>
                  {SOURCE_TYPES.map((t) => <option key={t} value={t}>{words(t)}</option>)}
                </select>
              </label>
              <label>Title<input value={source.title} onChange={setS('title')} required /></label>
              <label>Authors <span className="hint">(optional)</span><input value={source.authors} onChange={setS('authors')} /></label>
              <label>Organisation <span className="hint">(e.g. WHO, Thai FDA)</span>
                <input value={source.organization} onChange={setS('organization')} /></label>
              <span className="row">
                <label>Edition<input value={source.edition} onChange={setS('edition')} /></label>
                <label>Published<input value={source.publication_date} onChange={setS('publication_date')} placeholder="2024 or 2024-03" /></label>
                <label>Jurisdiction<input value={source.jurisdiction} onChange={setS('jurisdiction')} placeholder="TH, US, EU…" /></label>
              </span>
              <label>DOI or URL <span className="hint">(optional)</span><input value={source.url} onChange={setS('url')} /></label>
              <button type="button" className="link" onClick={() => setCreating(false)}>← choose an existing source instead</button>
            </>
          ) : (
            <>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your sources…"
                aria-label="Search sources" />
              <span className="picker-results">
                {found?.slice(0, 8).map((s) => (
                  <button type="button" key={s.id} onClick={() => setChosen(s)}>{sourceLabel(s)}</button>
                ))}
                {found?.length === 0 && <span className="muted">No sources found.</span>}
              </span>
              <button type="button" className="link" onClick={() => setCreating(true)}>+ New source</button>
            </>
          )}
        </fieldset>

        <span className="row">
          <label>This source…
            <select value={ev.stance} onChange={setE('stance')}>
              <option value="supports">supports the claim</option>
              <option value="contradicts">contradicts the claim</option>
              <option value="mentions">only mentions it</option>
            </select>
          </label>
          <label>Page / slide<input value={ev.locator} onChange={setE('locator')} placeholder="p. 601" /></label>
        </span>
        <label>Kind of evidence
          <select value={ev.evidence_type} onChange={setE('evidence_type')}>
            {EVIDENCE_TYPES.map((t) => <option key={t} value={t}>{words(t)}</option>)}
          </select>
        </label>
        <label>Which exact claim? <span className="hint">(optional, if the entry says several things)</span>
          <input value={ev.claim_text} onChange={setE('claim_text')} /></label>
        <label>Relevant passage <span className="hint">(optional, short)</span>
          <textarea value={ev.passage} onChange={setE('passage')} rows={2} /></label>
        <ErrorText error={save.error} />
        <div className="actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={save.isPending || (!chosen && !creating)}>Add source</button>
        </div>
      </form>
    </Dialog>
  )
}

type Props = { owner: Owner; ownerId: string; evidence: EvidenceItem[]; readOnly: boolean }

export function Evidence({ owner, ownerId, evidence, readOnly }: Props) {
  const save = useSave()
  const [adding, setAdding] = useState(false)
  return (
    <div className="evidence">
      {evidence.length > 0 && (
        <ul>
          {evidence.map((e) => (
            <li key={e.id} className={`stance-${e.stance}`}>
              <span className="stance">{e.stance}</span>{' '}
              {e.url ? <a href={e.url} target="_blank" rel="noreferrer">{sourceLabel(e)}</a> : sourceLabel(e)}
              {e.locator && <>, {e.locator}</>}
              {e.claim_text && <span className="muted"> — “{e.claim_text}”</span>}
              {!readOnly && (
                <button className="link remove" aria-label={`Remove source ${e.source_title}`}
                  onClick={() => save.mutate(() => api.post(`/evidence/${e.id}/archive`))}>×</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && <button className="link" onClick={() => setAdding(true)}>+ Source</button>}
      <ErrorText error={save.error} />
      {adding && <EvidenceForm owner={owner} ownerId={ownerId} onClose={() => setAdding(false)} />}
    </div>
  )
}
