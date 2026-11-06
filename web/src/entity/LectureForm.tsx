// Create a lecture (and, if needed, its professor) so lecture-specific knowledge can say where it came from.
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api, useSave, type Lecture, type Professor } from '../api'
import { Dialog, ErrorText } from '../ui'

export function LectureForm({ onClose, onCreated }: { onClose: () => void; onCreated: (lecture: Lecture) => void }) {
  const save = useSave()
  const { data: professors } = useQuery({
    queryKey: ['professors'], queryFn: () => api.get<Professor[]>('/professors'),
  })
  const [title, setTitle] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [lectureDate, setLectureDate] = useState('')
  const [professorId, setProfessorId] = useState('')
  const [newProfessor, setNewProfessor] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    e.stopPropagation() // this dialog can open on top of another form: don't submit that one too
    const lecture: Lecture = await save.mutateAsync(async () => {
      let profId = professorId || null
      if (profId === 'new') {
        const professor: Professor = await api.post('/professors', { name: newProfessor })
        profId = professor.id
      }
      return api.post('/lectures', {
        title, course_code: courseCode || null, lecture_date: lectureDate || null, professor_id: profId,
      })
    })
    onCreated(lecture)
    onClose()
  }

  return (
    <Dialog title="New lecture" onClose={onClose}>
      <form onSubmit={submit} className="form">
        <label>Lecture title<input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus /></label>
        <label>Course code <span className="hint">(optional)</span>
          <input value={courseCode} onChange={(e) => setCourseCode(e.target.value)} placeholder="PHA301" />
        </label>
        <label>Date <span className="hint">(optional, e.g. 2026-08 or 2026-08-14)</span>
          <input value={lectureDate} onChange={(e) => setLectureDate(e.target.value)} />
        </label>
        <label>Professor
          <select value={professorId} onChange={(e) => setProfessorId(e.target.value)}>
            <option value="">— not recorded —</option>
            {professors?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="new">+ New professor…</option>
          </select>
        </label>
        {professorId === 'new' && (
          <label>New professor's name
            <input value={newProfessor} onChange={(e) => setNewProfessor(e.target.value)} required />
          </label>
        )}
        <ErrorText error={save.error} />
        <div className="actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={save.isPending}>Create lecture</button>
        </div>
      </form>
    </Dialog>
  )
}
