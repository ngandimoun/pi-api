from __future__ import annotations

import base64
import io

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image

from pi_yolo_detection.api import app


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


def test_detect_accepts_image_and_returns_shape() -> None:
    c = TestClient(app)

    # Tiny synthetic image (black with a white square). We don't assert a detection exists;
    # we assert the service executes end-to-end and returns a valid schema.
    rgb = np.zeros((128, 128, 3), dtype=np.uint8)
    rgb[32:96, 32:96] = 255
    payload = _img_to_b64_png(rgb)

    r = c.post(
        "/v1/detect",
        json={
            "input": {"data": payload, "mime_type": "image/png"},
            "params": {"conf": 0.25, "iou": 0.7, "imgsz": 320},
        },
    )
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["object"] == "surveillance.detections"
    assert isinstance(j["model"], str) and j["model"]
    assert isinstance(j["detections"], list)
    for d in j["detections"]:
        assert {"cls", "label", "conf", "xyxy"} <= set(d.keys())
        assert isinstance(d["cls"], int)
        assert isinstance(d["label"], str)
        assert 0.0 <= float(d["conf"]) <= 1.0
        assert isinstance(d["xyxy"], list) and len(d["xyxy"]) == 4

