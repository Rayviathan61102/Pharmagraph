import { useEffect, useState } from 'react'

export default function App() {
  const [server, setServer] = useState('checking…')

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setServer(`connected (v${d.version})`))
      .catch(() => setServer('not reachable'))
  }, [])

  return (
    <main className="empty">
      <h1>PharmaGraph</h1>
      <p className="muted">The knowledge base is empty. Milestone M0: project setup.</p>
      <p className="muted">Thai text check: พาราเซตามอล</p>
      <p className="status">Server: {server}</p>
    </main>
  )
}
