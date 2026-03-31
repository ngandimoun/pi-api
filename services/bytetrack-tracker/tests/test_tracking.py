from __future__ import annotations

from fastapi.testclient import TestClient

from pi_bytetrack_tracker.api import app


def test_healthz() -> None:
    c = TestClient(app)
    r = c.get("/healthz")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_tracking_consistent_ids_across_frames() -> None:
    c = TestClient(app)
    r = c.post(
        "/v1/track",
        json={
            "stream_id": "cam-1",
            "frames": [
                {"frame_index": 0, "detections": [{"xyxy": [10, 10, 30, 30], "conf": 0.9, "cls": 0}]},
                {"frame_index": 1, "detections": [{"xyxy": [12, 10, 32, 30], "conf": 0.9, "cls": 0}]},
                {"frame_index": 2, "detections": [{"xyxy": [14, 10, 34, 30], "conf": 0.9, "cls": 0}]},
            ],
        },
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["object"] == "surveillance.tracks"
    assert j["stream_id"] == "cam-1"
    frames = j["frames"]
    assert len(frames) == 3
    ids = []
    for f in frames:
        assert len(f["tracks"]) >= 1
        ids.append(f["tracks"][0]["track_id"])
    assert len(set(ids)) == 1

