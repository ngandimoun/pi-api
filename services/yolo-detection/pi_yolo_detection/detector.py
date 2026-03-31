from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
from ultralytics import YOLO


@dataclass(frozen=True)
class YoloDetection:
    cls: int
    label: str
    conf: float
    xyxy: tuple[float, float, float, float]


class YoloDetector:
    def __init__(self, model_id: str = "yolov8n.pt") -> None:
        # Ultralytics will download this weight the first time if not present.
        self._model_id = model_id
        self._model = YOLO(model_id)

    @property
    def model_id(self) -> str:
        return self._model_id

    def detect(
        self,
        rgb: np.ndarray,
        *,
        conf: float = 0.25,
        iou: float = 0.7,
        max_det: int = 300,
        classes: list[int] | None = None,
        imgsz: int = 640,
        device: str | None = None,
    ) -> list[YoloDetection]:
        if rgb.ndim != 3 or rgb.shape[2] != 3:
            raise ValueError("rgb must be HxWx3")

        # Ultralytics accepts numpy arrays directly.
        results = self._model.predict(
            source=rgb,
            conf=conf,
            iou=iou,
            max_det=max_det,
            classes=classes,
            imgsz=imgsz,
            device=device,
            verbose=False,
        )
        if not results:
            return []

        r = results[0]
        names: dict[int, str] = getattr(r, "names", {}) or {}
        boxes = getattr(r, "boxes", None)
        if boxes is None:
            return []

        out: list[YoloDetection] = []
        for b in boxes:
            cls = int(b.cls.item())  # type: ignore[attr-defined]
            conf_v = float(b.conf.item())  # type: ignore[attr-defined]
            xyxy_arr = b.xyxy.squeeze().tolist()  # type: ignore[attr-defined]
            x1, y1, x2, y2 = (float(x) for x in xyxy_arr)
            out.append(
                YoloDetection(
                    cls=cls,
                    label=names.get(cls, str(cls)),
                    conf=conf_v,
                    xyxy=(x1, y1, x2, y2),
                )
            )
        return out

    def model_meta(self) -> dict[str, Any]:
        # Keep this minimal and stable; the TS layer can treat it as opaque.
        return {"model_id": self._model_id, "backend": "ultralytics"}

