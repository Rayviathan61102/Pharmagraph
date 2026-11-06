# PharmaGraph

A local-first scientific knowledge base and learning environment for pharmaceutical sciences.
Design and database plan: [docs/PharmaGraph-Analysis.md](docs/PharmaGraph-Analysis.md).

Current milestone: **M0 — project setup** (empty app, no database yet).

## Layout

```
server/     Python server (FastAPI): HTTP API + serves the built interface
web/        React + TypeScript interface (built into web/dist)
docs/       design documents
```

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

## Run the tests

```bash
.venv\Scripts\python -m pytest
```
