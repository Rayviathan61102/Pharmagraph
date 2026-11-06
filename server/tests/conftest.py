"""Shared test setup: every test gets its own empty data folder, never your real one."""
import pytest
from fastapi.testclient import TestClient

from server import config
from server.app import app
from server.db.connection import connect
from server.db.migrate import migrate


@pytest.fixture
def data_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("PHARMAGRAPH_DATA", str(tmp_path))
    return tmp_path


@pytest.fixture
def conn(data_dir):
    migrate(config.db_path())
    c = connect(config.db_path())
    yield c
    c.close()


@pytest.fixture
def client(data_dir):
    with TestClient(app) as c:  # "with" runs startup, which creates the database
        yield c
