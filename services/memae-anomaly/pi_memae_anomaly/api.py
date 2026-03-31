from __future__ import annotations

import base64
import io
from typing import Any, Literal

import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from PIL import Image
from pydantic import BaseModel, Field

from .model import MemAE, anomaly_score


class AnomalyInput(BaseModel):
    data: str = Field(..., min_length=1, description="Image data as base64 (optionally data: URL).")
    mime_type: str | None = Field(default=None)


class AnomalyParams(BaseModel):
    # Keep it simple for MVP
    resize: int = Field(default=128, ge=32, le=512)


class AnomalyRequest(BaseModel):
    input: AnomalyInput
    params: AnomalyParams | None = None


class AnomalyResponse(BaseModel):
    object: Literal["surveillance.anomaly"] = "surveillance.anomaly"
    score: float
    meta: dict[str, Any] | None = None


app = FastAPI(title="pi-memae-anomaly", version="0.1.0")

_model: MemAE | None = None


def _get_model() -> MemAE:
    global _model
    if _model is None:
        _model = MemAE()
        _model.eval()
    return _model


def _decode_image_to_tensor(data: str, *, size: int) -> torch.Tensor:
    s = data.strip()
    if s.startswith("data:") and "base64," in s:
        s = s.split("base64,", 1)[1]
    raw = base64.b64decode(s, validate=True)
    img = Image.open(io.BytesIO(raw)).convert("RGB").resize((size, size))
    arr = np.asarray(img, dtype=np.float32) / 255.0
    t = torch.from_numpy(arr).permute(2, 0, 1).unsqueeze(0)
    return t


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/anomaly", response_model=AnomalyResponse)
def anomaly(req: AnomalyRequest) -> AnomalyResponse:
    if not req.input.data.strip():
        raise HTTPException(status_code=400, detail="input.data is required")
    params = req.params or AnomalyParams()
    try:
        x = _decode_image_to_tensor(req.input.data, size=params.resize)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"invalid image data: {e}") from e

    m = _get_model()
    with torch.no_grad():
        recon, _z = m(x)
        score_t = anomaly_score(x, recon)
    return AnomalyResponse(score=float(score_t.item()), meta={"backend": "memae-lite", "resize": params.resize})

