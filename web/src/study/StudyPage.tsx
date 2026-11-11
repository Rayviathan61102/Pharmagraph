// Quiz mode: flashcards made from the relationships and entries already in the knowledge base.
// Nothing is saved: a quiz lives only while this page is open.
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import { api, useAllCategories } from '../api'
import { ErrorText, Icon, entityLink } from '../ui'

type Card = { id: string; kind: 'relationship' | 'entry'; entity_id: string; entity_name: string; prompt: string; answer: string }
type Quiz = {
  queue: Card[]           // cards still to answer; a missed card goes back to the end
  total: number           // how many different cards this quiz started with
  missed: Card[]          // cards missed at least once (each listed once)
  streak: number
  bestStreak: number
}

/** What happens to the quiz when the top card is answered. Kept separate so the rule is easy to read. */
export function answer(quiz: Quiz, knewIt: boolean): Quiz {
  const [card, ...rest] = quiz.queue
  if (knewIt) {
    const streak = quiz.streak + 1
    return { ...quiz, queue: rest, streak, bestStreak: Math.max(quiz.bestStreak, streak) }
  }
  const missed = quiz.missed.some((c) => c.id === card.id) ? quiz.missed : [...quiz.missed, card]
  return { ...quiz, queue: [...rest, card], missed, streak: 0 }
}

/** The ring on the results screen, drawn as a circle whose outline is partly filled. */
function ScoreRing({ percent }: { percent: number }) {
  const length = 2 * Math.PI * 52
  return (
    <svg className="score-ring" viewBox="0 0 120 120" role="img" aria-label={`${percent}% known first time`}>
      <circle cx="60" cy="60" r="52" />
      <circle cx="60" cy="60" r="52" className="score-fill" strokeDasharray={length}
        style={{ strokeDashoffset: length * (1 - percent / 100) }} />
      <text x="60" y="67" textAnchor="middle">{percent}%</text>
    </svg>
  )
}

export function StudyPage() {
  const { data: categories } = useAllCategories()
  const [category, setCategory] = useState('')
  const [size, setSize] = useState(10)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const stage = useRef<HTMLDivElement>(null)

  const start = async () => {
    setError(null)
    setLoading(true)
    try {
      const cards = await api.get<Card[]>(`/quiz?limit=${size}${category ? `&category_id=${category}` : ''}`)
      setQuiz({ queue: cards, total: cards.length, missed: [], streak: 0, bestStreak: 0 })
      setRevealed(false)
    } catch (e) { setError(e) } finally { setLoading(false) }
  }
  const mark = (knewIt: boolean) => { setQuiz((q) => q && answer(q, knewIt)); setRevealed(false) }
  const card = quiz?.queue[0]

  // Keyboard: Space shows the answer; then 1 = didn't know, 2 = knew it. Only while the quiz has focus.
  useEffect(() => { stage.current?.focus() }, [card?.id, revealed])
  const keys = (e: React.KeyboardEvent) => {
    if (!card) return
    if (!revealed && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); setRevealed(true) }
    else if (revealed && e.key === '1') mark(false)
    else if (revealed && e.key === '2') mark(true)
  }

  // ---------- 1. Choose what to study ----------
  if (!quiz) {
    return (
      <article className="study-page">
        <h1>Study</h1>
        <p className="muted">
          Flashcards made from your own entries and relationships. Cards you miss come back until you know them.
        </p>
        <div className="study-setup">
          <label>Topic
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Everything</option>
              {categories?.map((c) => <option key={c.id} value={c.id}>{c.path}</option>)}
            </select>
          </label>
          <label>Cards
            <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
              {[5, 10, 20, 30].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button className="primary" onClick={start} disabled={loading}><Icon name="study" /> Start quiz</button>
        </div>
        <ErrorText error={error} />
      </article>
    )
  }

  // ---------- 2. Nothing to ask ----------
  if (quiz.total === 0) {
    return (
      <article className="study-page">
        <h1>Study</h1>
        <p className="muted">There is nothing to quiz on here yet. Add entries or relationships first, or choose another topic.</p>
        <button onClick={() => setQuiz(null)}><Icon name="back" /> Back</button>
      </article>
    )
  }

  // ---------- 3. Results ----------
  if (!card) {
    const firstTime = quiz.total - quiz.missed.length
    return (
      <article className="study-page study-results">
        <ScoreRing percent={Math.round((firstTime / quiz.total) * 100)} />
        <h1>{quiz.missed.length === 0 ? 'Perfect round!' : 'Quiz finished'}</h1>
        <p className="muted">
          You knew {firstTime} of {quiz.total} first time. Best streak: {quiz.bestStreak}.
        </p>
        {quiz.missed.length > 0 && (
          <section className="home-card">
            <h2>Worth another look</h2>
            <ul className="home-list">
              {quiz.missed.map((c) => (
                <li key={c.id}><a href={entityLink(c.entity_id)}><span>{c.entity_name}</span><span className="muted">{c.prompt}</span></a></li>
              ))}
            </ul>
          </section>
        )}
        <div className="actions">
          <button className="primary" onClick={start} disabled={loading}><Icon name="restore" /> New round</button>
          <button onClick={() => setQuiz(null)}>Change topic</button>
        </div>
        <ErrorText error={error} />
      </article>
    )
  }

  // ---------- 4. One card ----------
  const done = quiz.total - new Set(quiz.queue.map((c) => c.id)).size
  return (
    <article className="study-page">
      <div className="study-top">
        <button className="link" onClick={() => setQuiz(null)}><Icon name="x" size={14} /> End quiz</button>
        <span className="muted">{done} of {quiz.total} known</span>
        {quiz.streak >= 2 && <span key={quiz.streak} className="streak"><Icon name="flame" size={14} /> {quiz.streak} in a row</span>}
      </div>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={quiz.total} aria-valuenow={done}>
        <span style={{ width: `${(done / quiz.total) * 100}%` }} />
      </div>

      <div ref={stage} className="quiz-stage" tabIndex={-1} onKeyDown={keys}>
        <div key={card.id + String(revealed)} className={`quiz-card ${revealed ? 'back' : 'front'}`}>
          <span className="type-tag">{card.kind === 'relationship' ? 'Relationship' : 'Knowledge'}</span>
          <h2>{card.entity_name}</h2>
          <p className="quiz-prompt">{card.prompt}</p>
          {revealed && <div className="markdown quiz-answer"><Markdown>{card.answer}</Markdown></div>}
        </div>
        {!revealed ? (
          <div className="actions quiz-actions">
            <button className="primary" onClick={() => setRevealed(true)}>Show answer <kbd>Space</kbd></button>
          </div>
        ) : (
          <div className="actions quiz-actions">
            <button className="danger" onClick={() => mark(false)}><Icon name="x" /> Didn’t know <kbd>1</kbd></button>
            <button className="good" onClick={() => mark(true)}><Icon name="check" /> Knew it <kbd>2</kbd></button>
          </div>
        )}
      </div>
    </article>
  )
}
