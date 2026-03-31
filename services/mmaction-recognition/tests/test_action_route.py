from __future__ import annotations

from fastapi.testclient import TestClient

from pi_mmaction_recognition.api import app


def test_healthz() -> None:
    c = TestClient(app)
    r = c.get("/healthz")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_action_route_accepts_payload_and_returns_schema() -> None:
    c = TestClient(app)
    r = c.post(
        "/v1/action",
        json={"input": {"video_base64": "ZmFrZQ==", "mime_type": "video/mp4"}},
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["object"] == "surveillance.actions"
    assert isinstance(j["predictions"], list)
    assert isinstance(j["meta"], dict)

