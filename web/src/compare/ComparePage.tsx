// Compare two entities side by side, topic by topic. Address: #/compare/<first>/<second>, so it can be bookmarked.
import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import Markdown from 'react-markdown'
import {
  api, templateSections, useLookups, type Entity, type EntitySummary, type Entry, type Relationship, type Scope,
} from '../api'
import type { Structure } from '../chem/ChemistrySection'
import { StructureView } from '../chem/StructureView'
import { EntityPicker } from '../EntityPicker'
import { CLINICAL_SECTIONS } from '../entity/Entries'
import { conditionText } from '../entity/Conditions'
import { StatusBadge, entityLink, go } from '../ui'

const EMPTY = '-' // placeholder in the address when a side is not chosen yet
const SCOPES: Scope[] = ['general', 'lecture', 'personal']

function useSide(id?: string) {
  const enabled = !!id
  const entity = useQuery({ queryKey: ['entity', id], queryFn: () => api.get<Entity>(`/entities/${id}`), enabled })
  const entries = useQuery({
    queryKey: ['entries', id, false], queryFn: () => api.get<Entry[]>(`/entities/${id}/entries?include_archived=false`), enabled,
  })
  const relationships = useQuery({
    queryKey: ['relationships', id, false],
    queryFn: () => api.get<Relationship[]>(`/entities/${id}/relationships?include_archived=false`), enabled,
  })
  const structures = useQuery({
    queryKey: ['structures', id], queryFn: () => api.get<Structure[]>(`/entities/${id}/structures`), enabled,
  })
  return { entity: entity.data, entries: entries.data ?? [], relationships: relationships.data ?? [], structures: structures.data ?? [] }
}
type Side = ReturnType<typeof useSide>

const summary = (e?: Entity): EntitySummary | null => e
  ? { id: e.id, name: e.name, entity_type_id: e.entity_type_id, status_code: e.status_code, archived_at: e.archived_at } : null

function EntriesCell({ entries, sectionId }: { entries: Entry[]; sectionId: string }) {
  return <>{entries.map((e) => (
    <div key={e.id} className={`compare-entry scope-${e.scope}`}>
      <div className="markdown"><Markdown>{e.body}</Markdown></div>
      <div className="entry-meta">
        {e.scope !== 'general' && <span className="scope-label">{e.scope}</span>}
        <StatusBadge code={e.status_code} />
        {CLINICAL_SECTIONS.has(sectionId) && e.status_code !== 'verified' && <span className="unsourced">not verified</span>}
      </div>
    </div>
  ))}</>
}

function RelationshipsCell({ list, sharedWith }: { list: Relationship[]; sharedWith: Set<string> }) {
  return <ul className="compare-links">{list.map((r) => (
    <li key={r.id}>
      <a href={entityLink(r.other_id)} className={sharedWith.has(r.other_id) ? 'shared' : ''}
        title={sharedWith.has(r.other_id) ? 'Both have this' : undefined}>{r.other_name}</a>
      {r.contexts.length > 0 && <span className="muted"> ({r.contexts.map(conditionText).join('; ')})</span>}
    </li>
  ))}</ul>
}

export function ComparePage({ first, second }: { first?: string; second?: string }) {
  const { data: lookups } = useLookups()
  const [scopes, setScopes] = useState<Scope[]>(['general'])
  const a = first && first !== EMPTY ? first : undefined
  const b = second && second !== EMPTY ? second : undefined
  const left = useSide(a)
  const right = useSide(b)
  const open = (x?: string, y?: string) => go(`#/compare/${x ?? EMPTY}/${y ?? EMPTY}`)
  if (!lookups) return null

  const ready = left.entity && right.entity
  const rows: { key: string; label: string; left: ReactNode; right: ReactNode }[] = []
  if (left.entity && right.entity) {
    const add = (key: string, label: string, l: ReactNode, r: ReactNode) => { if (l || r) rows.push({ key, label, left: l, right: r }) }
    const facts = (get: (s: Side) => string | number | null | undefined, label: string) =>
      add(label, label, get(left) || null, get(right) || null)
    facts((s) => lookups.entity_types.find((t) => t.id === s.entity?.entity_type_id)?.label, 'Type')
    facts((s) => s.entity?.aliases.map((x) => x.alias).join(', '), 'Other names')
    const drawing = (s: Side) => s.structures[0] && <StructureView smiles={s.structures[0].original_smiles} width={280} height={190} />
    add('structure', 'Chemical structure', drawing(left), drawing(right))
    facts((s) => s.structures[0]?.molecular_formula, 'Molecular formula')
    facts((s) => s.structures[0]?.molecular_weight && `${s.structures[0].molecular_weight} g/mol`, 'Molecular weight')

    // Topics: both templates first, then any other topic with content, each once.
    const sections = [...templateSections(lookups, left.entity.entity_type_id), ...templateSections(lookups, right.entity.entity_type_id), ...lookups.sections]
    const inScope = (s: Side, sectionId: string) => s.entries.filter((e) => e.section_id === sectionId && scopes.includes(e.scope))
    for (const section of sections.filter((s, i) => s.id !== 'image' && sections.findIndex((x) => x.id === s.id) === i)) {
      const [l, r] = [inScope(left, section.id), inScope(right, section.id)]
      add(section.id, section.label, l.length > 0 && <EntriesCell entries={l} sectionId={section.id} />,
        r.length > 0 && <EntriesCell entries={r} sectionId={section.id} />)
    }

    // Relationships, grouped by their wording ("treats", "inhibits", "has metabolite" ...).
    const visible = (s: Side) => s.relationships.filter((r) => scopes.includes(r.scope))
    const ids = (s: Side, label: string) => new Set(visible(s).filter((r) => r.label === label).map((r) => r.other_id))
    for (const label of [...new Set([...visible(left), ...visible(right)].map((r) => r.label))].sort()) {
      const cell = (s: Side, other: Side) => {
        const list = visible(s).filter((r) => r.label === label)
        return list.length > 0 && <RelationshipsCell list={list} sharedWith={ids(other, label)} />
      }
      add(`rel-${label}`, label[0].toUpperCase() + label.slice(1), cell(left, right), cell(right, left))
    }
  }

  return (
    <article className="compare-page">
      <h1>Compare</h1>
      <div className="compare-pickers">
        <label>First<EntityPicker value={summary(left.entity)} onChange={(e) => open(e?.id, b)} excludeId={b} /></label>
        <label>Second<EntityPicker value={summary(right.entity)} onChange={(e) => open(a, e?.id)} excludeId={a} /></label>
      </div>
      <div className="compare-scopes">
        {SCOPES.map((s) => (
          <label key={s} className={`check scope-${s}`}>
            <input type="checkbox" checked={scopes.includes(s)}
              onChange={(e) => setScopes(e.target.checked ? [...scopes, s] : scopes.filter((x) => x !== s))} />
            {s}
          </label>
        ))}
      </div>
      {!ready && <p className="muted">Choose two entities to compare, for example Paracetamol and Ibuprofen.</p>}
      {ready && (
        <div className="table-scroll">
          <table className="table compare">
            <thead><tr><th /><th><a href={entityLink(left.entity!.id)}>{left.entity!.name}</a></th>
              <th><a href={entityLink(right.entity!.id)}>{right.entity!.name}</a></th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.label}</th>
                  <td>{row.left || <span className="muted">—</span>}</td>
                  <td>{row.right || <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ready && <p className="hint">Only topics with information on at least one side are shown. Bold-green links appear on both sides.</p>}
    </article>
  )
}
