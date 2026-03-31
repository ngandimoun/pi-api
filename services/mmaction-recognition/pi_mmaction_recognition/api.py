from __future__ import annotations

from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .recognizer import recognize_actions_smoketest


class ActionInput(BaseModel):
    # MVP: we accept a base64 mp4, but the current implementation is a smoke boundary only.
    video_base64: str = Field(..., min_length=1, description="Video bytes as base64 (mp4 recommended).")
    mime_type: str | None = Field(default="video/mp4")


class ActionRequest(BaseModel):
    input: ActionInput


class ActionPrediction(BaseModel):
    label: str
    score: float


class ActionResponse(BaseModel):
    object: Literal["surveillance.actions"] = "surveillance.actions"
    predictions: list[ActionPrediction]
    meta: dict[str, Any] | None = None


app = FastAPI(title="pi-mmaction-recognition", version="0.1.0")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/action", response_model=ActionResponse)
def action(req: ActionRequest) -> ActionResponse:
    if not req.input.video_base64.strip():
        raise HTTPException(status_code=400, detail="input.video_base64 is required")

    # MVP: enforce install correctness and return a deterministic placeholder prediction.
    meta = recognize_actions_smoketest()
    return ActionResponse(
        predictions=[ActionPrediction(label="unknown", score=0.0)],
        meta=meta,
    )

