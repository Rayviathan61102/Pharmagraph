// Add knowledge to an entity, or edit one entry.
// When adding, the form first asks what KIND of information it is (spec 3.3).
import { useState, type FormEvent } from 'react'
import { api, useLectures, useLookups, useSave, type Entry } from '../api'
import { Dialog, ErrorText } from '../ui'
import { LectureForm } from './LectureForm'

type Choice = 'general' | 'lecture' | 'personal' | 'both'

const CHOICES: { value: Choice; label: string; hint: string }[] = [
  { value: 'general', label: 'General scientific knowledge', hint: 'Established science, ideally with a source' },
  { value: 'lecture', label: 'Lecture-specific', hint: "A professor's explanation, terminology or exam focus" },
  { value: 'personal', label: 'Personal', hint: 'Your own notes, mnemonics, unverified ideas' },
  { value: 'both', label: 'Both general and lecture', hint: 'Saved as two linked entries that never overwrite each other' },
]

type Props = { entityId: string; entry?: Entry; sectionId?: string; onClose: () => void }

export function EntryForm({ entityId, entry, sectionId, onClose }: Props) {
  const { data: lookups } = useLookups()
  const { data: lectures } = useLectures()
  const save = useSave()
  const [choice, setChoice] = useState<Choice>(entry?.scope ?? 'general')
  const [section, setSection] = useState(entry?.section_id ?? sectionId ?? 'overview')
  const [title, setTitle] = useState(entry?.title ?? '')
  const [body, setBody] = useState(entry?.body ?? '')
  const [lectureBody, setLectureBody] = useState('')
  const [lectureId, setLectureId] = useState(entry?.lecture_id ?? '')
  const [status, setStatus] = useState('proposed')
  const [reason, setReason] = useState('')
  const [addingLecture, setAddingLecture] = useState(false)
  const usesLecture = choice === 'lecture' || choice === 'both'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const common = { section_id: section, title: title.trim() || null, body, lecture_id: usesLecture ? lectureId || null : null }
    await save.mutateAsync(() => entry
      ? api.patch(`/entries/${entry.id}`, { ...common, reason: reason.trim() || null })
      : api.post(`/entities/${entityId}/entries`, {
        ...common, scope: choice, status_code: status, lecture_body: choice === 'both' ? lectureBody.trim() || null : null,
      }))
    onClose()
  }

  return (
    <Dialog title={entry ? 'Edit knowledge' : 'Add knowledge'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        {!entry && (
          <fieldset className="choices">
            <legend>What kind of information is this?</legend>
            {CHOICES.map((c) => (
              <label key={c.value} className={`choice scope-${c.value}`}>
                <input type="radio" name="scope" value={c.value} checked={choice === c.value}
                  onChange={() => setChoice(c.value)} />
                <span><strong>{c.label}</strong><span className="hint"> — {c.hint}</span></span>
              </label>
            ))}
          </fieldset>
        )}

        <label>Section
          <select value={section} onChange={(e) => setSection(e.target.value)}>
            {lookups?.sections.filter((s) => s.id !== 'image').map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>

        {usesLecture && (
          <label>Lecture <span className="hint">(recommended)</span>
            <span className="inline-form">
              <select value={lectureId} onChange={(e) => setLectureId(e.target.value)}>
                <option value="">— not recorded —</option>
                {lectures?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {[l.course_code, l.title, l.professor_name].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setAddingLecture(true)}>+ New lecture</button>
            </span>
          </label>
        )}

        <label>Title <span className="hint">(optional)</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>{choice === 'both' ? 'General version' : 'Text'} <span className="hint">(Markdown: **bold**, - lists, # headings)</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} required />
        </label>
        {choice === 'both' && !entry && (
          <label>Lecture version <span className="hint">(leave empty to start with the same text)</span>
            <textarea value={lectureBody} onChange={(e) => setLectureBody(e.target.value)} rows={4} />
          </label>
        )}

        {!entry && (
          <label>Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {lookups?.statuses.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
            </select>
          </label>
        )}
        {entry && (
          <label>Reason for this change <span className="hint">(optional)</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
        )}

        <ErrorText error={save.error} />
        <div className="actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={save.isPending}>{entry ? 'Save' : 'Add'}</button>
        </div>
      </form>
      {addingLecture && (
        <LectureForm onClose={() => setAddingLecture(false)} onCreated={(l) => setLectureId(l.id)} />
      )}
    </Dialog>
  )
}
