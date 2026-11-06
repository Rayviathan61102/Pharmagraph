from fastapi.testclient import TestClient

from server import __main__ as main
from server.app import app


def test_health_endpoint_answers():
    response = TestClient(app).get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_server_only_listens_on_this_computer():
    assert main.HOST == "127.0.0.1"
