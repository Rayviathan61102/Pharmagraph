// The folder-style navigation tree. Each level is loaded only when it is opened.
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api, type CategoryNode, type EntitySummary } from '../api'
import { entityLink } from '../ui'
import { CategoryForm } from './CategoryForm'

type Level = { categories: CategoryNode[]; entities: EntitySummary[] }

function LevelList({ parentId, currentId }: { parentId: string | null; currentId?: string }) {
  const { data } = useQuery({
    queryKey: ['categories', 'children', parentId],
    queryFn: () => api.get<Level>(`/categories/children${parentId ? `?parent_id=${parentId}` : ''}`),
  })
  if (!data) return null
  if (parentId && data.categories.length === 0 && data.entities.length === 0) {
    return <p className="muted tree-empty">Empty</p>
  }
  return (
    <ul className="tree">
      {data.categories.map((c) => <CategoryItem key={c.id} node={c} currentId={currentId} />)}
      {data.entities.map((e) => (
        <li key={e.id}>
          <a href={entityLink(e.id)} className={`tree-entity${e.id === currentId ? ' current' : ''}`}>{e.name}</a>
        </li>
      ))}
    </ul>
  )
}

function CategoryItem({ node, currentId }: { node: CategoryNode; currentId?: string }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [addingChild, setAddingChild] = useState(false)
  return (
    <li>
      <div className="tree-row">
        <button className="tree-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="tree-arrow" aria-hidden>{open ? '▾' : '▸'}</span>
          {node.name}
          {node.entity_count > 0 && <span className="tree-count">{node.entity_count}</span>}
        </button>
        <button className="tree-tool" aria-label={`Add a subcategory to ${node.name}`} title="Add subcategory"
          onClick={() => setAddingChild(true)}>+</button>
        <button className="tree-tool" aria-label={`Edit category ${node.name}`} title="Rename, move or archive"
          onClick={() => setEditing(true)}>⋯</button>
      </div>
      {open && <LevelList parentId={node.id} currentId={currentId} />}
      {editing && <CategoryForm category={node} onClose={() => setEditing(false)} />}
      {addingChild && <CategoryForm parentId={node.id} onClose={() => { setAddingChild(false); setOpen(true) }} />}
    </li>
  )
}

export function CategoryTree({ currentId }: { currentId?: string }) {
  const [creating, setCreating] = useState(false)
  return (
    <section className="category-tree">
      <div className="section-head">
        <h2>Categories</h2>
        <button className="link" onClick={() => setCreating(true)}>+ New</button>
      </div>
      <LevelList parentId={null} currentId={currentId} />
      {creating && <CategoryForm onClose={() => setCreating(false)} />}
    </section>
  )
}
