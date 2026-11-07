// Structure details: a large drawing with glowing, explained parts. Notes are editable; every edit keeps
// the earlier version (spec: never silently overwrite; SAR claims carry a status like any other claim).
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api, useLookups, useSave } from '../api'
import { Dialog, ErrorText, StatusBadge, askReason, entityLink, formatTime, go } from '../ui'
import { matchPattern, useRDKit } from './chem'
import type { Structure } from './ChemistrySection'
import { GLOW_COLORS, StructureView, type Highlight } from './StructureView'

type Note = Highlight & { status_code: string; created_at: string; replaces_id: string | null; archive_reason: string | null }
type Draft = { id?: string; atom_indices: number[]; note: string; color: string; status_code: string }

function NoteHistory({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useQuery({ queryKey: ['annotation-history', id], queryFn: () => api.get<Note[]>(`/annotations/${id}/history`) })
  return (
    <Dialog title="Earlier versions of this note" onClose={onClose}>
      <ol className="history">
        {data?.map((n, i) => (
          <li key={n.id}>
            <strong>{i === 0 ? 'Current' : `Version ${data.length - i}`}</strong> · {formatTime(n.created_at)} ·{' '}
            <StatusBadge code={n.status_code} />
            <div>{n.note}</div>
            <div className="muted">atoms {n.atom_indices.join(', ')}</div>
          </li>
        ))}
      </ol>
      <div className="actions"><button onClick={onClose}>Close</button></div>
    </Dialog>
  )
}

export function StructurePage({ id }: { id: string }) {
  const rdkit = useRDKit()
  const save = useSave()
  const { data: lookups } = useLookups()
  const { data: s, error } = useQuery({ queryKey: ['structure', id], queryFn: () => api.get<Structure>(`/structures/${id}`) })
  const [draft, setDraft] = useState<Draft | null>(null)
  const [pattern, setPattern] = useState('')
  const [patternError, setPatternError] = useState('')
  const [historyOf, setHistoryOf] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string[]>([]) // features clicked on in the list: they keep glowing
  const togglePin = (noteId: string) =>
    setPinned(pinned.includes(noteId) ? pinned.filter((p) => p !== noteId) : [...pinned, noteId])
  if (error) return <p className="error">{String(error)}</p>
  if (!s) return null
  const notes = s.annotations as Note[]

  const startNew = () => setDraft({
    atom_indices: [], note: '', color: GLOW_COLORS[notes.length % GLOW_COLORS.length], status_code: 'proposed',
  })
  const toggleAtom = (atom: number) => draft && setDraft({
    ...draft,
    atom_indices: draft.atom_indices.includes(atom) ? draft.atom_indices.filter((a) => a !== atom) : [...draft.atom_indices, atom],
  })
  const selectPattern = () => {
    const atoms = rdkit && matchPattern(rdkit, s.original_smiles, pattern)
    if (!atoms) setPatternError('Not a valid pattern.')
    else if (atoms.length === 0) setPatternError('Not found in this molecule.')
    else { setPatternError(''); setDraft({ ...draft!, atom_indices: atoms }) }
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const { id: noteId, ...body } = draft!
    await save.mutateAsync(() => noteId ? api.patch(`/annotations/${noteId}`, body) : api.post(`/structures/${s.id}/annotations`, body))
    setDraft(null)
  }
  const archiveNote = (n: Note) => {
    const reason = askReason('Remove this highlight? It is archived, not deleted.')
    if (reason !== null) save.mutate(() => api.post(`/annotations/${n.id}/archive`, { reason: reason || null }))
  }
  const archiveStructure = async () => {
    const reason = askReason('Archive this structure? Its highlights stay in the archive.')
    if (reason === null) return
    await save.mutateAsync(() => api.post(`/structures/${s.id}/archive`, { reason: reason || null }))
    go(entityLink(s.entity_id))
  }

  // While editing, the edited note shows the live selection instead of its saved atoms.
  const shown: Highlight[] = notes.filter((n) => n.id !== draft?.id)
  const draftId = draft ? draft.id ?? 'draft' : null
  if (draft) shown.push({ id: draftId!, atom_indices: draft.atom_indices, note: draft.note || '…', color: draft.color })

  return (
    <article className="structure-page">
      <p className="muted"><a href={entityLink(s.entity_id)}>← {s.entity_name}</a></p>
      <h1>Structure of {s.entity_name}{s.label && <span className="muted"> ({s.label})</span>}</h1>
      <p className="muted">
        {s.molecular_formula} · {s.molecular_weight} g/mol · SMILES <code className="smiles">{s.original_smiles}</code>
      </p>

      <div className="structure-layout">
        <div className="structure-stage">
          <StructureView smiles={s.original_smiles} highlights={shown} width={520} height={380} showNotes
            pinned={draftId ? [...pinned, draftId] : pinned}
            selection={draft?.atom_indices} onAtomClick={draft ? toggleAtom : undefined}
            label={`Structure of ${s.entity_name} with ${notes.length} highlighted features`} />
          <p className="hint">
            {draft ? 'Click atoms on the drawing to add or remove them from the highlight.'
              : 'Point at a part of the molecule to see what it does, or click a feature on the right to keep it glowing.'}
          </p>
        </div>

        <aside className="structure-notes">
          <div className="section-head">
            <h2>Highlighted features</h2>
            {!draft && <button className="link" onClick={startNew}>+ New highlight</button>}
          </div>
          {notes.length === 0 && !draft && <p className="muted">Nothing highlighted yet.</p>}
          <ul>
            {notes.map((n) => (
              <li key={n.id} className={`structure-note-item${pinned.includes(n.id) ? ' pinned' : ''}`}
                style={{ borderLeftColor: n.color, ['--glow' as string]: n.color }}>
                <button className="note-toggle" aria-pressed={pinned.includes(n.id)} onClick={() => togglePin(n.id)}
                  title={pinned.includes(n.id) ? 'Click to stop highlighting' : 'Click to highlight on the structure'}>
                  {n.note}
                </button>
                <div className="entry-meta">
                  <StatusBadge code={n.status_code} />
                  <button className="link" onClick={() => setDraft({ id: n.id, atom_indices: n.atom_indices, note: n.note, color: n.color, status_code: n.status_code })}>Edit</button>
                  <button className="link" onClick={() => archiveNote(n)}>Remove</button>
                  {n.replaces_id && <button className="link" onClick={() => setHistoryOf(n.id)}>Earlier versions</button>}
                </div>
              </li>
            ))}
          </ul>

          {draft && (
            <form onSubmit={submit} className="form note-form">
              <h3>{draft.id ? 'Edit highlight' : 'New highlight'}</h3>
              <p className="muted">{draft.atom_indices.length} atom{draft.atom_indices.length === 1 ? '' : 's'} selected</p>
              <label>…or select by pattern <span className="hint">(SMARTS: C#C triple bond, [OH] hydroxyl, c1ccccc1 benzene)</span>
                <span className="inline-form">
                  <input value={pattern} onChange={(e) => setPattern(e.target.value)} aria-label="Pattern" />
                  <button type="button" onClick={selectPattern}>Select</button>
                </span>
              </label>
              {patternError && <p className="error">{patternError}</p>}
              <label>Explanation
                <textarea value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} rows={3} required
                  placeholder="e.g. 17α-ethynyl group blocks metabolism, so it can be taken orally" />
              </label>
              <fieldset className="choices">
                <legend>Glow colour</legend>
                <span className="swatches">
                  {GLOW_COLORS.map((c) => (
                    <button type="button" key={c} className={`swatch${draft.color === c ? ' chosen' : ''}`} style={{ background: c }}
                      aria-label={`Colour ${c}`} aria-pressed={draft.color === c} onClick={() => setDraft({ ...draft, color: c })} />
                  ))}
                </span>
              </fieldset>
              <label>Status <span className="hint">(don't mark speculation as Verified)</span>
                <select value={draft.status_code} onChange={(e) => setDraft({ ...draft, status_code: e.target.value })}>
                  {lookups?.statuses.map((st) => <option key={st.code} value={st.code}>{st.label}</option>)}
                </select>
              </label>
              <ErrorText error={save.error} />
              <div className="actions">
                <button type="button" onClick={() => { setDraft(null); setPatternError('') }}>Cancel</button>
                <button type="submit" className="primary" disabled={save.isPending || draft.atom_indices.length === 0}>Save</button>
              </div>
            </form>
          )}

          <details className="structure-info">
            <summary>Structure data</summary>
            <dl className="snapshot">
              <div><dt>Entered SMILES</dt><dd>{s.original_smiles}</dd></div>
              <div><dt>Canonical SMILES</dt><dd>{s.canonical_smiles}</dd></div>
              <div><dt>Computed with</dt><dd>{s.canonicalizer}</dd></div>
            </dl>
            <button onClick={archiveStructure}>Archive this structure</button>
          </details>
        </aside>
      </div>
      {historyOf && <NoteHistory id={historyOf} onClose={() => setHistoryOf(null)} />}
    </article>
  )
}
