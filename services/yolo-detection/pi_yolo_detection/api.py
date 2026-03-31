from __future__ import annotations

from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .detector import YoloDetector
from .image_io import decode_image_to_rgb_np


class DetectInput(BaseModel):
    data: str = Field(..., min_length=1, description="Image data as base64 (optionally data: URL).")
    mime_type: str | None = Field(default=None, description="Optional image mime type hint.")


class DetectParams(BaseModel):
    conf: float = Field(default=0.25, ge=0.0, le=1.0)
    iou: float = Field(default=0.7, ge=0.0, le=1.0)
    max_det: int = Field(default=300, ge=1, le=3000)
    imgsz: int = Field(default=640, ge=32, le=2048)
    classes: list[int] | None = Field(default=None, description="Optional COCO class ids to filter.")


class DetectRequest(BaseModel):
    input: DetectInput
    params: DetectParams | None = None


class Detection(BaseModel):
    cls: int
    label: str
    conf: float
    xyxy: tuple[float, float, float, float]


class DetectResponse(BaseModel):
    object: Literal["surveillance.detections"] = "surveillance.detections"
    model: str
    detections: list[Detection]
    meta: dict[str, Any] | None = None


app = FastAPI(title="pi-yolo-detection", version="0.1.0")

_detector: YoloDetector | None = None


def _get_detector() -> YoloDetector:
    global _detector
    if _detector is None:
        _detector = YoloDetector()
    return _detector


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/detect", response_model=DetectResponse)
def detect(req: DetectRequest) -> DetectResponse:
    if not req.input.data.strip():
        raise HTTPException(status_code=400, detail="input.data is required")

    params = req.params or DetectParams()
    try:
        rgb = decode_image_to_rgb_np(req.input.data)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"invalid image data: {e}") from e

    det = _get_detector()
    detections = det.detect(
        rgb,
        conf=params.conf,
        iou=params.iou,
        max_det=params.max_det,
        classes=params.classes,
        imgsz=params.imgsz,
    )

    return DetectResponse(
        model=det.model_id,
        detections=[
            Detection(cls=d.cls, label=d.label, conf=d.conf, xyxy=d.xyxy) for d in detections
        ],
        meta=det.model_meta(),
    )

