"""PharmaGraph server: the HTTP API, plus the built web interface."""
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from . import config
from .routes import (backups, categories, entities, entries, graph, history, lookups, notes, relationships, search,
                     sources, structures, study, templates)
from .services import backup
from .services.errors import Conflict, Invalid, NotFound

WEB_DIST = Path(__file__).resolve().parent.parent / "web" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    applied = backup.prepare_database()  # backs up (if upgrading), then creates or upgrades the database
    print(f"Data folder: {config.data_dir()}" + (f"  (applied: {', '.join(applied)})" if applied else ""))
    yield


app = FastAPI(title="PharmaGraph", version=config.APP_VERSION, lifespan=lifespan)
# history goes last: its general "/api/{kind}/{id}/archive" pattern must not catch e.g. /api/sources/{id}/archive.
for module in (lookups, backups, search, graph, categories, structures, notes, study, templates, entities, entries, relationships, sources,
               history):
    app.include_router(module.router)


# Turn service-layer problems into clear HTTP errors with a readable "detail" message.
@app.exception_handler(NotFound)
def not_found(request: Request, exc: NotFound):
    return JSONResponse({"detail": str(exc)}, status_code=404)


@app.exception_handler(Invalid)
def invalid(request: Request, exc: Invalid):
    return JSONResponse({"detail": str(exc)}, status_code=400)


@app.exception_handler(Conflict)
def conflict(request: Request, exc: Conflict):
    return JSONResponse({"detail": str(exc), **exc.details}, status_code=409)


@app.exception_handler(sqlite3.IntegrityError)
def rejected_by_database(request: Request, exc: sqlite3.IntegrityError):
    # The database's own rules (foreign keys, CHECKs, triggers) caught something the services did not.
    return JSONResponse({"detail": f"Rejected by the database: {exc}"}, status_code=400)


@app.get("/api/health")
def health():
    """Lets the interface (and you) check that the server is running."""
    return {"status": "ok", "app": "PharmaGraph", "version": app.version}


# Serve the built interface at "/". Mounted last so /api/... and /docs are matched first.
if WEB_DIST.is_dir():
    app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")
