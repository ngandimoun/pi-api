from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


class SegmentInput(BaseModel):
    data: str = Field(..., min_length=1, description="Image data as base64 (optionally data: URL) or https URL.")
    modality: str = Field(..., min_length=1, description="Free-form modality hint (e.g. xray, ultrasound).")
    mime_type: str | None = Field(default=None, description="Optional image mime type hint.")


class SegmentRequest(BaseModel):
    input: SegmentInput


class SegmentResponse(BaseModel):
    overlay_url: str | None = None
    mask_base64: str | None = None
    detail: dict[str, Any] | None = None


app = FastAPI(title="pi-monai-imaging", version="0.1.0")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/segment", response_model=SegmentResponse)
def segment(req: SegmentRequest) -> SegmentResponse:
    # NOTE: This is a minimal HTTP boundary for Pi orchestration.
    # The actual MedSAM/MONAI bundle inference should be added here (GPU recommended).
    if not req.input.data.strip():
        raise HTTPException(status_code=400, detail="input.data is required")

    # Placeholder response so the gateway can degrade gracefully while the
    # production inference path is wired (MONAI bundle download + model load).
    return SegmentResponse(
        overlay_url=None,
        mask_base64=None,
        detail={"status": "not_implemented", "modality": req.input.modality, "mime_type": req.input.mime_type},
    )

