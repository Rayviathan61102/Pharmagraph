// Backups: make one, check one, restore one (spec 16). Also the monthly reminder banner.
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api, useSave } from './api'
import { ErrorText, Icon, formatTime } from './ui'

type Backup = {
  name: string; kind?: string; created_at?: string; schema_version?: number; entities?: number
  size_bytes: number; error?: string
}
type Status = { last_backup_at: string | null; backups_folder: string; reminder: boolean }
type Report = { name: string; ok: boolean; problems: string[] }

const KIND_LABEL: Record<string, string> = {
  manual: 'Manual', 'pre-migration': 'Automatic — before an upgrade', 'pre-restore': 'Automatic — before a restore',
}

export function useBackupStatus() {
  return useQuery({ queryKey: ['backups', 'status'], queryFn: () => api.get<Status>('/backups/status') })
}

export function BackupReminder() {
  const { data } = useBackupStatus()
  if (!data?.reminder) return null
  return (
    <div className="reminder" role="status">
      <Icon name="alert" />
      <span>{data.last_backup_at
        ? `Your last backup was on ${formatTime(data.last_backup_at)}. It's time for a new one.`
        : 'You have not made a backup yet.'}{' '}
      <a href="#/backups">Go to Backups</a></span>
    </div>
  )
}

export function BackupsPage() {
  const save = useSave()
  const { data: status } = useBackupStatus()
  const { data: backups } = useQuery({ queryKey: ['backups', 'list'], queryFn: () => api.get<Backup[]>('/backups') })
  const [report, setReport] = useState<Report | null>(null)
  const [message, setMessage] = useState('')

  const check = async (name: string) => setReport(await save.mutateAsync(() => api.post<Report>(`/backups/${name}/validate`)))
  const restore = async (b: Backup) => {
    const ok = window.confirm(
      `Restore the backup from ${b.created_at ? formatTime(b.created_at) : b.name}?\n\n` +
      'Your current knowledge base will be replaced by this backup. A backup of the current state is made ' +
      'first, so you can undo this by restoring that one.')
    if (!ok) return
    const result = await save.mutateAsync(() => api.post<{ safety_backup: string | null }>(`/backups/${b.name}/restore`))
    setMessage(`Restored. Your previous state was saved as ${result.safety_backup ?? '(nothing to save)'}.`)
  }

  return (
    <article className="backups-page">
      <h1>Backups</h1>
      <p className="muted">
        Backups are saved in <code>{status?.backups_folder}</code>. To move PharmaGraph to another computer,
        copy a backup .zip into the same folder there and restore it.
      </p>
      <div className="actions">
        <button className="primary" disabled={save.isPending}
          onClick={async () => { await save.mutateAsync(() => api.post('/backups')); setMessage('Backup made and checked.') }}>
          <Icon name="backup" /> Back up now
        </button>
      </div>
      {message && <p className="ok" role="status">{message}</p>}
      <ErrorText error={save.error} />
      {report && (
        <div className={report.ok ? 'ok-box' : 'warning'} role="status">
          <strong>{report.ok ? 'Backup is complete and healthy.' : 'Problems found:'}</strong>
          {!report.ok && <ul>{report.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
        </div>
      )}

      <table className="table">
        <thead>
          <tr><th>Made</th><th>Kind</th><th>Entities</th><th>Size</th><th /></tr>
        </thead>
        <tbody>
          {backups?.map((b) => (
            <tr key={b.name}>
              <td>{b.created_at ? formatTime(b.created_at) : b.name}</td>
              <td>{b.error ? <span className="error">unreadable</span> : KIND_LABEL[b.kind ?? ''] ?? b.kind}</td>
              <td>{b.entities ?? '—'}</td>
              <td>{(b.size_bytes / 1024).toFixed(0)} KB</td>
              <td className="row-actions">
                <button onClick={() => check(b.name)}><Icon name="check" size={14} /> Check</button>
                <a href={`/api/backups/${b.name}/download`} download><Icon name="download" size={14} /> Download</a>
                <button onClick={() => restore(b)} disabled={!!b.error}><Icon name="restore" size={14} /> Restore</button>
              </td>
            </tr>
          ))}
          {backups?.length === 0 && <tr><td colSpan={5} className="muted">No backups yet.</td></tr>}
        </tbody>
      </table>
    </article>
  )
}
