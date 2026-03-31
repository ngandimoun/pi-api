from __future__ import annotations

from typing import Any, Literal

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .tracker import ByteTrackLite


class Detection(BaseModel):
    xyxy: tuple[float, float, float, float] = Field(..., description="Bounding box [x1,y1,x2,y2].")
    conf: float = Field(..., ge=0.0, le=1.0)
    cls: int | None = Field(default=None)


class TrackParams(BaseModel):
    track_thresh: float = Field(default=0.5, ge=0.0, le=1.0)
    low_thresh: float = Field(default=0.1, ge=0.0, le=1.0)
    match_thresh: float = Field(default=0.3, ge=0.0, le=1.0)
    max_time_lost: int = Field(default=30, ge=1, le=300)


class TrackFrame(BaseModel):
    frame_index: int = Field(..., ge=0)
    detections: list[Detection]


class TrackRequest(BaseModel):
    stream_id: str = Field(..., min_length=1)
    frames: list[TrackFrame] = Field(..., min_length=1)
    params: TrackParams | None = None


class TrackOut(BaseModel):
    track_id: int
    xyxy: tuple[float, float, float, float]
    conf: float
    cls: int | None = None


class TrackFrameOut(BaseModel):
    frame_index: int
    tracks: list[TrackOut]


class TrackResponse(BaseModel):
    object: Literal["surveillance.tracks"] = "surveillance.tracks"
    stream_id: str
    frames: list[TrackFrameOut]
    meta: dict[str, Any] | None = None


app = FastAPI(title="pi-bytetrack-tracker", version="0.1.0")

_trackers: dict[str, ByteTrackLite] = {}


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/track", response_model=TrackResponse)
def track(req: TrackRequest) -> TrackResponse:
    if not req.stream_id.strip():
        raise HTTPException(status_code=400, detail="stream_id is required")

    params = req.params or TrackParams()
    tracker = _trackers.get(req.stream_id)
    if tracker is None:
        tracker = ByteTrackLite(
            track_thresh=params.track_thresh,
            low_thresh=params.low_thresh,
            match_thresh=params.match_thresh,
            max_time_lost=params.max_time_lost,
        )
        _trackers[req.stream_id] = tracker

    out_frames: list[TrackFrameOut] = []
    for f in req.frames:
        dets = f.detections
        det_xyxy = np.array([d.xyxy for d in dets], dtype=np.float32) if dets else np.zeros((0, 4), dtype=np.float32)
        det_conf = np.array([d.conf for d in dets], dtype=np.float32) if dets else np.zeros((0,), dtype=np.float32)
        det_cls = (
            np.array([(-1 if d.cls is None else int(d.cls)) for d in dets], dtype=np.int32)
            if dets
            else None
        )

        active = tracker.step(det_xyxy, det_conf, det_cls)
        tracks_out = [
            TrackOut(
                track_id=t.track_id,
                xyxy=tuple(float(x) for x in t.to_xyxy().tolist()),
                conf=float(t.score),
                cls=(None if t.cls is None or t.cls < 0 else int(t.cls)),
            )
            for t in active
        ]
        out_frames.append(TrackFrameOut(frame_index=f.frame_index, tracks=tracks_out))

    return TrackResponse(
        stream_id=req.stream_id,
        frames=out_frames,
        meta={"backend": "bytetrack-lite"},
    )

