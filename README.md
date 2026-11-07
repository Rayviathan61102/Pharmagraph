# PharmaGraph

A local-first scientific knowledge base and learning environment for pharmaceutical sciences.
Design and database plan: [docs/PharmaGraph-Analysis.md](docs/PharmaGraph-Analysis.md).
Decisions and differences from the plan: [docs/DECISIONS.md](docs/DECISIONS.md).

Status: **MVP complete (M0–M13)** — all 12 criteria of spec Section 21 are met
([docs/ACCEPTANCE.md](docs/ACCEPTANCE.md)). How to use it: **[docs/USER-GUIDE.md](docs/USER-GUIDE.md)**.

Entities, knowledge entries (general / lecture / personal / both), typed relationships with conditions,
sources and evidence, statuses and reviews, search (incl. Thai), category sidebar, entity pages, chemical
structures with explained highlights, metabolites, the interactive graph, a two-panel workspace,
personal notes, and backup/restore. Every change is kept in revision history; nothing is ever deleted.

## Backups

Open **Backups** at the bottom of the sidebar. "Back up now" makes a checked .zip in
`<data folder>\backups`. A backup is also made automatically before every restore and before the
database structure is upgraded. You are reminded when the last backup is more than 30 days old.
To move to another computer: copy a backup .zip into the new computer's `backups` folder and restore it.

## Speed check

```bash
.venv\Scripts\python -m server.tools.benchmark
```

Builds a throw-away 50,000-entity database in a temporary folder and times the main queries.

## Layout

```
server/     Python server (FastAPI): HTTP API + serves the built interface
  db/         connection, migration runner, numbered .sql migrations
  services/   all the rules (history, archiving, statuses, search ...)
  routes/     thin HTTP layer over the services
  tests/      pytest tests
web/        React + TypeScript interface (built into web/dist)
docs/       design documents
```

## Where your data lives

By default: `C:\Users\<you>\PharmaGraph-Data\pharmagraph.db`.
Set the `PHARMAGRAPH_DATA` environment variable to use another folder.
The preview inside Claude Code uses `dev-data/` in this project (ignored by git) so test data never
mixes with your own.

## First-time setup (once per computer)

Needs Python 3.12+ and Node.js.

```bash
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
cd web
npm install
npm run build
```

## Start PharmaGraph

```bash
.venv\Scripts\python -m server
```

Then open http://127.0.0.1:8000 (HTTP API test page: http://127.0.0.1:8000/docs).
The server only accepts connections from this computer.

After changing anything in `web/`, run `npm run build` in `web/` again
(or run `npm run dev` there for a live-reloading version at http://localhost:5173).
After changing anything in `server/`, restart the server.

## Run the tests

```bash
.venv\Scripts\python -m pytest
```
