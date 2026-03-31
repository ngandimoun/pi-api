from fastapi.testclient import TestClient

from pi_ros2_bridge.api import app


def test_healthz() -> None:
    client = TestClient(app)
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json().get("ok") is True

