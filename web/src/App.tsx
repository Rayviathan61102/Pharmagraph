import { useState } from 'react'
import { EntityForm } from './entity/EntityForm'
import { EntityList } from './entity/EntityList'
import { EntityPage } from './entity/EntityPage'
import { useRoute } from './ui'

export default function App() {
  const [page, id] = useRoute()
  const [creating, setCreating] = useState(false)
  const entityId = page === 'entity' ? id : undefined

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand"><a href="#/">PharmaGraph</a></div>
        <button className="primary wide" onClick={() => setCreating(true)}>+ New entity</button>
        <EntityList currentId={entityId} />
      </aside>
      <main className="main">
        {entityId
          ? <EntityPage key={entityId} id={entityId} />
          : <div className="empty"><p className="muted">Select an entity on the left, or create a new one.</p></div>}
      </main>
      {creating && <EntityForm onClose={() => setCreating(false)} />}
    </div>
  )
}
