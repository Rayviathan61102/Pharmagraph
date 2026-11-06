// Change (or re-confirm) the verification status of an entity, entry or relationship.
// Every change needs a reason and is kept as a permanent review record.
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api, useLookups, useSave, type HistoryKind, type Review } from '../api'
import { Dialog, ErrorText, StatusBadge, formatTime } from '../ui'

type Props = { kind: HistoryKind; id: string; current: string; readOnly: boolean }

export function StatusButton({ kind, id, current, readOnly }: Props) {
  const [open, setOpen] = useState(false)
  if (readOnly) return <StatusBadge code={current} />
  return (
    <>
      <button className="badge-button" onClick={() => setOpen(true)} title="Change or confirm status">
        <StatusBadge code={current} />
      </button>
      {open && <StatusDialog kind={kind} id={id} current={current} onClose={() => setOpen(false)} />}
    </>
  )
}

function StatusDialog({ kind, id, current, onClose }: Omit<Props, 'readOnly'> & { onClose: () => void }) {
  const { data: lookups } = useLookups()
  const save = useSave()
  const { data: reviews } = useQuery({
    queryKey: ['reviews', kind, id], queryFn: () => api.get<Review[]>(`/${kind}/${id}/reviews`),
  })
  const [status, setStatus] = useState(current)
  const [notes, setNotes] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    await save.mutateAsync(() => api.post(`/${kind}/${id}/status`, { status_code: status, notes }))
    onClose()
  }

  return (
    <Dialog title="Verification status" onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label>Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {lookups?.statuses.map((s) => (
              <option key={s.code} value={s.code}>{s.label}{s.code === current ? ' (current)' : ''}</option>
            ))}
          </select>
        </label>
        <p className="hint">{lookups?.statuses.find((s) => s.code === status)?.description}</p>
        <label>{status === current ? 'What did you check?' : 'Why?'} <span className="hint">(required)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} required
            placeholder="e.g. Checked against Goodman & Gilman 14th ed., p. 601" />
        </label>
        <ErrorText error={save.error} />
        <div className="actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={save.isPending}>
            {status === current ? 'Record review' : 'Change status'}
          </button>
        </div>
      </form>
      {reviews && reviews.length > 0 && (
        <>
          <h3 className="subhead">Past reviews</h3>
          <ol className="history">
            {reviews.map((r) => (
              <li key={r.id}>
                {formatTime(r.created_at)} · {r.from_status_code === r.to_status_code
                  ? <>confirmed <StatusBadge code={r.to_status_code} /></>
                  : <><StatusBadge code={r.from_status_code ?? ''} /> → <StatusBadge code={r.to_status_code} /></>}
                {r.notes && <div className="muted">{r.notes}</div>}
              </li>
            ))}
          </ol>
        </>
      )}
    </Dialog>
  )
}
