// Create, rename, move or archive a category.
import { useState, type FormEvent } from 'react'
import { api, useAllCategories, useSave, type CategoryNode } from '../api'
import { Dialog, ErrorText } from '../ui'

type Props = { category?: CategoryNode; parentId?: string | null; onClose: () => void }

export function CategoryForm({ category, parentId = null, onClose }: Props) {
  const save = useSave()
  const { data: all } = useAllCategories()
  const [name, setName] = useState(category?.name ?? '')
  const [parent, setParent] = useState(category?.parent_id ?? parentId ?? '')
  const [description, setDescription] = useState(category?.description ?? '')

  // A category cannot go inside itself or its own subcategories (the server checks this too).
  const isInsideThis = (id: string | null) => {
    for (let c = all?.find((x) => x.id === id); c; c = all?.find((x) => x.id === c!.parent_id)) {
      if (c.id === category?.id) return true
    }
    return false
  }
  const parents = (all ?? []).filter((c) => !isInsideThis(c.id))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const body = { name, parent_id: parent || null, description: description.trim() || null }
    await save.mutateAsync(() => category ? api.patch(`/categories/${category.id}`, body) : api.post('/categories', body))
    onClose()
  }
  const archive = async () => {
    if (!window.confirm(`Archive the category "${category!.name}"? Its entities are not affected.`)) return
    await save.mutateAsync(() => api.post(`/categories/${category!.id}/archive`))
    onClose()
  }

  return (
    <Dialog title={category ? `Category: ${category.name}` : 'New category'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></label>
        <label>Inside
          <select value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="">(top level)</option>
            {parents.map((c) => <option key={c.id} value={c.id}>{c.path}</option>)}
          </select>
        </label>
        <label>Description <span className="hint">(optional)</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <ErrorText error={save.error} />
        <div className="actions">
          {category && <button type="button" onClick={archive}>Archive category</button>}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={save.isPending}>{category ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </Dialog>
  )
}
