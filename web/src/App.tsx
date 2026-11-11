import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api, type Entity } from './api'
import { BackupReminder, BackupsPage } from './BackupsPage'
import { StructurePage } from './chem/StructurePage'
import { ComparePage } from './compare/ComparePage'
import { TemplatesPage } from './templates/TemplatesPage'
import { EntityForm } from './entity/EntityForm'
import { EntityList } from './entity/EntityList'
import { EntityPage } from './entity/EntityPage'
import { GraphPanel } from './graph/GraphPanel'
import { HomePage } from './home/HomePage'
import { StudyPage } from './study/StudyPage'
import { NotesPage, useInboxCount } from './notes/Notes'
import { Icon } from './ui'
import { Divider, PanelProvider, useNarrow, useWorkspaceState } from './workspace/Workspace'

const parts = (path: string) => path.split('/').filter(Boolean)

/** What a panel shows for an address like "/entity/<id>". */
function PanelBody({ path }: { path: string }) {
  const [page, id, second] = parts(path)
  if (page === 'compare') return <ComparePage first={id} second={second} />
  if (page === 'templates') return <TemplatesPage />
  if (page === 'graph' && id) return <GraphPanel key={id} initialFocus={id} />
  if (page === 'entity' && id) return <EntityPage key={id} id={id} />
  if (page === 'structure' && id) return <StructurePage key={id} id={id} />
  if (page === 'backups') return <BackupsPage />
  if (page === 'notes') return <NotesPage />
  if (page === 'study') return <StudyPage />
  return <HomePage />
}

function useTitle(path: string) {
  const [page, id] = parts(path)
  const { data } = useQuery({
    queryKey: ['entity', id], queryFn: () => api.get<Entity>(`/entities/${id}`),
    enabled: !!id && (page === 'entity' || page === 'graph'),
  })
  if (page === 'entity') return data?.name ?? 'Entity'
  if (page === 'graph') return `Graph · ${data?.name ?? ''}`
  if (page === 'structure') return 'Structure'
  if (page === 'backups') return 'Backups'
  if (page === 'notes') return 'Notes'
  if (page === 'compare') return 'Compare'
  if (page === 'templates') return 'Templates'
  if (page === 'study') return 'Study'
  return 'Home'
}

function PanelTitle({ path }: { path: string }) {
  return <>{useTitle(path)}</>
}

export default function App() {
  const ws = useWorkspaceState()
  const narrow = useNarrow()
  const [creating, setCreating] = useState(false)
  const { data: inbox } = useInboxCount()
  const { panels, active, arrangement, size } = ws.state
  const two = panels.length === 2
  const [activePage, activeId] = parts(ws.path(active))
  const currentEntity = activePage === 'entity' || activePage === 'graph' ? activeId : undefined

  const panel = (i: number) => {
    const p = panels[i]
    const flex = two && !narrow ? `0 0 calc(${i === 0 ? size : 100 - size}% - 3px)` : '1 1 auto'
    return (
      <section key={i} className={`panel${i === active ? ' active' : ''}`} style={{ flex }}
        onPointerDownCapture={() => ws.activate(i)} onFocusCapture={() => ws.activate(i)}
        aria-label={`Panel ${i + 1}`}>
        <header className="panel-bar">
          <button className="icon-button" onClick={() => ws.back(i)} disabled={p.index === 0} aria-label="Back" title="Back"><Icon name="back" /></button>
          <button className="icon-button" onClick={() => ws.forward(i)} disabled={p.index >= p.history.length - 1} aria-label="Forward" title="Forward"><Icon name="forward" /></button>
          <span className="panel-title"><PanelTitle path={ws.path(i)} /></span>
          {!two && <button onClick={() => ws.openInOther(i, '/')}><Icon name="panel" /> Second panel</button>}
          {two && !narrow && i === 0 && <button onClick={ws.swap} title="Swap the two panels"><Icon name="swap" /> Swap</button>}
          {two && <button className="icon-button" onClick={() => ws.close(i)} aria-label={`Close panel ${i + 1}`} title="Close panel"><Icon name="x" /></button>}
        </header>
        <div className="panel-body">
          <PanelProvider value={{ index: i, panelCount: panels.length, openInOther: (path) => ws.openInOther(i, path) }}>
            <PanelBody path={ws.path(i)} />
          </PanelProvider>
        </div>
      </section>
    )
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand"><a href="#/"><span className="brand-mark"><Icon name="logo" size={18} /></span>PharmaGraph</a></div>
        <button className="primary wide" onClick={() => setCreating(true)}><Icon name="plus" /> New entity</button>
        <EntityList currentId={currentEntity} />
        <nav className="side-nav" aria-label="Tools">
          <a href="#/study" className={activePage === 'study' ? 'current' : ''}><Icon name="study" /> Study</a>
          <a href="#/notes" className={activePage === 'notes' ? 'current' : ''}>
            <Icon name="note" /> Notes
            {!!inbox?.count && <span className="nav-count" title={`${inbox.count} in inbox`}>{inbox.count}</span>}
          </a>
          <a href="#/compare" className={activePage === 'compare' ? 'current' : ''}><Icon name="compare" /> Compare</a>
          <a href="#/templates" className={activePage === 'templates' ? 'current' : ''}><Icon name="template" /> Templates</a>
          <a href="#/backups" className={activePage === 'backups' ? 'current' : ''}><Icon name="backup" /> Backups</a>
        </nav>
      </aside>
      <main className="workspace-area">
        <BackupReminder />
        {two && (
          <div className="workspace-bar">
            {narrow ? (
              <span className="tabs" role="tablist">
                {[0, 1].map((i) => (
                  <button key={i} role="tab" aria-selected={i === active} className={i === active ? 'current' : ''}
                    onClick={() => ws.activate(i)}>
                    <PanelTitle path={ws.path(i)} />
                  </button>
                ))}
              </span>
            ) : (
              <label className="check">
                <input type="checkbox" checked={arrangement === 'stacked'}
                  onChange={(e) => ws.setArrangement(e.target.checked ? 'stacked' : 'side')} />
                Stack panels vertically
              </label>
            )}
          </div>
        )}
        <div className={`workspace ${narrow ? 'side' : arrangement}`}>
          {two && narrow ? panel(active) : panel(0)}
          {two && !narrow && <Divider arrangement={arrangement} size={size} onSize={ws.setSize} />}
          {two && !narrow && panel(1)}
        </div>
      </main>
      {creating && <EntityForm onClose={() => setCreating(false)} />}
    </div>
  )
}
