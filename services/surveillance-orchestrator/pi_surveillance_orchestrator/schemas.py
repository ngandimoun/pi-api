from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class Detection(BaseModel):
    cls: int
    label: str
    conf: float
    xyxy: tuple[float, float, float, float]


class Track(BaseModel):
    track_id: int
    conf: float
    cls: int | None = None
    xyxy: tuple[float, float, float, float]


class ActionPrediction(BaseModel):
    label: str
    score: float


class PerceptionResult(BaseModel):
    object: Literal["surveillance.perception"] = "surveillance.perception"
    stream_id: str = Field(..., min_length=1)
    frame_index: int = Field(..., ge=0)
    detections: list[Detection] = Field(default_factory=list)
    tracks: list[Track] = Field(default_factory=list)
    actions: list[ActionPrediction] = Field(default_factory=list)
    anomaly_score: float | None = None
    meta: dict[str, Any] | None = None

