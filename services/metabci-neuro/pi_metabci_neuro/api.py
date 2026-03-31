from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


class EegInput(BaseModel):
    data: str = Field(..., min_length=1, description="EEG payload as base64-encoded binary or JSON string.")
    modality: str | None = Field(default=None, description="Optional modality hint (e.g. eeg).")


class EegRequest(BaseModel):
    input: EegInput


class EegResponse(BaseModel):
    seizure_detected: bool
    confidence: float | None = None
    detail: dict[str, Any] | None = None


app = FastAPI(title="pi-metabci-neuro", version="0.1.0")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/eeg/classify", response_model=EegResponse)
def classify(req: EegRequest) -> EegResponse:
    if not req.input.data.strip():
        raise HTTPException(status_code=400, detail="input.data is required")

    # Placeholder: wire Braindecode EEGNet / MetaBCI pipelines here.
    # The gateway expects a deterministic boolean + optional confidence.
    return EegResponse(
        seizure_detected=False,
        confidence=0.0,
        detail={"status": "not_implemented", "modality": req.input.modality},
    )

