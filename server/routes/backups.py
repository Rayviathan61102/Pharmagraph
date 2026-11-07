"""HTTP API for backups. These routes open the database themselves (no per-request connection),
because restore replaces the database contents."""
from fastapi import APIRouter
from fastapi.responses import FileResponse

from ..services import backup

router = APIRouter(prefix="/api/backups", tags=["backups"])


@router.get("")
def list_backups():
    return backup.list_backups()


@router.get("/status")
def status():
    return backup.status()


@router.post("", status_code=201)
def create_backup():
    return backup.create_backup("manual")


@router.post("/{name}/validate")
def validate_backup(name: str):
    return backup.validate_backup(name)


@router.post("/{name}/restore")
def restore_backup(name: str):
    return backup.restore_backup(name)


@router.get("/{name}/download")
def download_backup(name: str):
    return FileResponse(backup.backup_path(name), filename=name, media_type="application/zip")
