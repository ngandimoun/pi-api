from __future__ import annotations

import base64
import io

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image

from pi_memae_anomaly.api import app


def _img_to_b64_png(rgb: np.ndarray) -> str:
    img = Image.fromarray(rgb.astype("uint8"), mode="RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def test_healthz() -> None:
    c = TestClient(app)
    r = c.get("/healthz")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_anomaly_route_returns_score() -> None:
    c = TestClient(app)
    rgb = np.zeros((64, 64, 3), dtype=np.uint8)
    rgb[16:48, 16:48] = 255
    payload = _img_to_b64_png(rgb)

    r = c.post("/v1/anomaly", json={"input": {"data": payload, "mime_type": "image/png"}, "params": {"resize": 64}})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["object"] == "surveillance.anomaly"
    assert isinstance(j["score"], (int, float))

