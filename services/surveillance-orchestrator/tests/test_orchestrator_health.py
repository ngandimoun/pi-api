from __future__ import annotations

from fastapi.testclient import TestClient

from pi_surveillance_orchestrator.api import app


def test_healthz() -> None:
    c = TestClient(app)
    r = c.get("/healthz")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

