import { useState } from 'react'
import { BackupReminder, BackupsPage } from './BackupsPage'
import { EntityForm } from './entity/EntityForm'
import { EntityList } from './entity/EntityList'
import { EntityPage } from './entity/EntityPage'
import { StructurePage } from './chem/StructurePage'
import { GraphPanel } from './graph/GraphPanel'
import { useRoute } from './ui'

export default function App() {
  const [page, id] = useRoute()
  const [creating, setCreating] = useState(false)
  const entityId = page === 'entity' || page === 'graph' ? id : undefined

  let content
  if (page === 'graph' && id) content = <GraphPanel key={id} initialFocus={id} />
  else if (page === 'entity' && id) content = <EntityPage key={id} id={id} />
  else if (page === 'structure' && id) content = <StructurePage key={id} id={id} />
  else if (page === 'backups') content = <BackupsPage />
  else content = <div className="empty"><p className="muted">Select an entity on the left, or create a new one.</p></div>

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand"><a href="#/">PharmaGraph</a></div>
        <button className="primary wide" onClick={() => setCreating(true)}>+ New entity</button>
        <EntityList currentId={entityId} />
        <nav className="sidebar-footer">
          <a href="#/backups" className={page === 'backups' ? 'current' : ''}>Backups</a>
        </nav>
      </aside>
      <main className={page === 'graph' || page === 'structure' ? 'main wide' : 'main'}>
        {page !== 'graph' && <BackupReminder />}
        {content}
      </main>
      {creating && <EntityForm onClose={() => setCreating(false)} />}
    </div>
  )
}
