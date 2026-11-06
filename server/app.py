"""PharmaGraph server: the HTTP API, plus the built web interface."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

WEB_DIST = Path(__file__).resolve().parent.parent / "web" / "dist"

app = FastAPI(title="PharmaGraph", version="0.1.0")


@app.get("/api/health")
def health():
    """Lets the interface (and you) check that the server is running."""
    return {"status": "ok", "app": "PharmaGraph", "version": app.version}


# Serve the built interface at "/". Mounted last so /api/... and /docs are matched first.
if WEB_DIST.is_dir():
    app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")
