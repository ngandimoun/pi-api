from __future__ import annotations

from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .pipeline import PerceptionPipeline
from .schemas import PerceptionResult


class PerceiveInput(BaseModel):
    image_base64: str = Field(..., min_length=1, description="Image bytes as base64 (optionally data: URL).")
    mime_type: str | None = None


class PerceiveRequest(BaseModel):
    stream_id: str = Field(..., min_length=1)
    frame_index: int = Field(default=0, ge=0)
    input: PerceiveInput


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"


app = FastAPI(title="pi-surveillance-orchestrator", version="0.1.0")

_pipe: PerceptionPipeline | None = None


def _pipeline() -> PerceptionPipeline:
    global _pipe
    if _pipe is None:
        _pipe = PerceptionPipeline()
    return _pipe


@app.get("/healthz", response_model=HealthResponse)
def healthz() -> HealthResponse:
    return HealthResponse()


@app.get("/healthz/deps")
def healthz_deps() -> dict[str, object]:
    return {"status": "ok", "deps": _pipeline().health()}


@app.post("/v1/perceive", response_model=PerceptionResult)
def perceive(req: PerceiveRequest) -> PerceptionResult:
    if not req.stream_id.strip():
        raise HTTPException(status_code=400, detail="stream_id is required")
    if not req.input.image_base64.strip():
        raise HTTPException(status_code=400, detail="input.image_base64 is required")

    try:
        out = _pipeline().perceive_one(
            stream_id=req.stream_id,
            frame_index=req.frame_index,
            image_base64=req.input.image_base64,
            mime_type=req.input.mime_type,
        )
    except httpx.HTTPError as e:  # type: ignore[name-defined]  # noqa: F821
        raise HTTPException(status_code=502, detail=f"downstream error: {e}") from e
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e)) from e

    return PerceptionResult.model_validate(out)

