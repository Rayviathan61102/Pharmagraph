// The start page: where you left off, what needs attention, and a few numbers.
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { Icon, StatusBadge, entityLink, type IconName } from '../ui'

type AttentionEntry = { id: string; entity_id: string; entity_name: string; section_label: string; status_code: string }
type Recent = { id: string; name: string; type_label: string }
type Home = {
  counts: { entities: number; entries: number; verified_entries: number; relationships: number; unsourced: number; inbox: number }
  needs_review: AttentionEntry[]
  unsourced: AttentionEntry[]
  recent: Recent[]
}

// ---------- "Recently opened" is remembered in this browser only ----------
const RECENT_KEY = 'pharmagraph-recent'
const readRecent = (): Recent[] => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as Recent[] } catch { return [] }
}
/** Called by the entity page each time an entity is opened. */
export function rememberOpened(entity: Recent) {
  const { id, name, type_label } = entity
  const list = [{ id, name, type_label }, ...readRecent().filter((r) => r.id !== id)].slice(0, 6)
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)) } catch { /* not essential */ }
}

function Stat({ icon, value, label, detail, href }: { icon: IconName; value: number; label: string; detail?: string; href?: string }) {
  const body = (
    <>
      <span className="stat-icon"><Icon name={icon} size={18} /></span>
      <strong>{value.toLocaleString()}</strong>
      <span className="stat-label">{label}</span>
      {detail && <span className="muted stat-detail">{detail}</span>}
    </>
  )
  return href ? <a className="stat" href={href}>{body}</a> : <div className="stat">{body}</div>
}

function AttentionList({ title, hint, items, total }: { title: string; hint: string; items: AttentionEntry[]; total?: number }) {
  return (
    <section className="home-card">
      <h2>{title} {!!items.length && <span className="count">{total ?? items.length}</span>}</h2>
      {items.length === 0 && <p className="muted all-clear"><Icon name="check" size={14} /> {hint}</p>}
      <ul className="home-list">
        {items.map((e) => (
          <li key={e.id}>
            <a href={entityLink(e.entity_id)}>
              <span>{e.entity_name}</span>
              <span className="muted">{e.section_label}</span>
              {e.status_code !== 'proposed' && <StatusBadge code={e.status_code} />}
            </a>
          </li>
        ))}
      </ul>
      {total !== undefined && total > items.length && <p className="muted more">and {total - items.length} more</p>}
    </section>
  )
}

export function HomePage() {
  const { data } = useQuery({ queryKey: ['home'], queryFn: () => api.get<Home>('/home') })
  if (!data) return null
  const { counts } = data

  if (counts.entities === 0) {
    return (
      <div className="empty">
        <span className="empty-mark"><Icon name="logo" size={34} /></span>
        <h2>Welcome to PharmaGraph</h2>
        <p className="muted">Your knowledge base is empty. Create your first entity with “New entity” on the left.</p>
      </div>
    )
  }

  // Entities opened in this browser come first; on a fresh browser show the latest edits instead.
  const opened = readRecent()
  const recent = opened.length ? opened : data.recent
  const verifiedShare = counts.entries ? Math.round((counts.verified_entries / counts.entries) * 100) : 0

  return (
    <article className="home-page">
      <header className="home-hero">
        <span className="empty-mark"><Icon name="logo" size={30} /></span>
        <div>
          <h1>Welcome back</h1>
          <p className="muted">Pick up where you left off, or test yourself on what you have written.</p>
        </div>
        <a className="button-link primary" href="#/study"><Icon name="study" /> Start a quiz</a>
      </header>

      <div className="stats">
        <Stat icon="logo" value={counts.entities} label="Entities" />
        <Stat icon="book" value={counts.entries} label="Knowledge entries" detail={`${verifiedShare}% verified`} />
        <Stat icon="graph" value={counts.relationships} label="Relationships" />
        <Stat icon="note" value={counts.inbox} label="Notes in inbox" href="#/notes" />
      </div>

      <section className="home-card">
        <h2>{opened.length ? 'Continue where you left off' : 'Recently edited'}</h2>
        <div className="recent-grid">
          {recent.map((r) => (
            <a key={r.id} href={entityLink(r.id)} className="recent-card">
              <span className="type-tag">{r.type_label}</span>
              <strong>{r.name}</strong>
            </a>
          ))}
        </div>
      </section>

      <div className="home-columns">
        <AttentionList title="Needs review" hint="Nothing is waiting for a re-check." items={data.needs_review} />
        <AttentionList title="No source yet" hint="Every general entry has a source." items={data.unsourced} total={counts.unsourced} />
      </div>
    </article>
  )
}
