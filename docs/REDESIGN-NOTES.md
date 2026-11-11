# Redesign branch: what changed and how to test it

Branch: `redesign-home-quiz-graph`. `main` is untouched.

## What is new
- **New look** (`web/src/theme.css`, `web/src/ui.tsx`): cleaner dark theme, inline SVG icon set, small animations
  (all switched off when the computer asks for reduced motion), scrolling sidebar with a tools menu.
- **Home page** (`web/src/home/HomePage.tsx`, `GET /api/home`): counts, recently opened entities (stored in the
  browser's localStorage only), entries that need review, general entries with no source.
- **Study / quiz** (`web/src/study/StudyPage.tsx`, `GET /api/quiz`): flashcards built from existing relationships and
  entries, optionally limited to a category (subcategories included). Missed cards return until known. Nothing is saved.
- **Graph** (`web/src/graph/GraphPanel.tsx`): hover highlights a node's links, a colour legend, node size grows with connections.

Server code is read-only: `server/services/study.py`, `server/routes/study.py`. No database migration.

## How to test
Needs **Python 3.14** (the code uses `uuid.uuid7`) and Node.js.

```bash
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
cd web && npm install && npm run build && cd ..
.venv\Scripts\python -m pytest            # 115 tests, 3 new in server/tests/test_study.py
.venv\Scripts\python -m server            # then open http://127.0.0.1:8000
```

Check by hand: Home page (click the logo), Study in the sidebar (Space shows the answer, 1 = didn't know, 2 = knew it),
and a graph page (hover a node). Set `PHARMAGRAPH_DATA` to a throw-away folder to avoid touching real data.

## Not done
No frontend tests. Templates and Structure pages were restyled but not checked by eye.
