from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.optimize import linear_sum_assignment

from .geometry import iou_xyxy
from .kalman import KalmanFilterXYAH


def _xyxy_to_xyah(box: np.ndarray) -> np.ndarray:
    x1, y1, x2, y2 = box
    w = max(0.0, x2 - x1)
    h = max(0.0, y2 - y1)
    cx = x1 + 0.5 * w
    cy = y1 + 0.5 * h
    a = w / max(h, 1e-6)
    return np.array([cx, cy, a, h], dtype=np.float32)


def _xyah_to_xyxy(xyah: np.ndarray) -> np.ndarray:
    cx, cy, a, h = (float(v) for v in xyah[:4])
    w = a * h
    x1 = cx - 0.5 * w
    y1 = cy - 0.5 * h
    x2 = cx + 0.5 * w
    y2 = cy + 0.5 * h
    return np.array([x1, y1, x2, y2], dtype=np.float32)


@dataclass
class TrackState:
    track_id: int
    mean: np.ndarray
    cov: np.ndarray
    hits: int = 1
    age: int = 1
    time_since_update: int = 0
    score: float = 0.0
    cls: int | None = None

    def to_xyxy(self) -> np.ndarray:
        return _xyah_to_xyxy(self.mean)


class ByteTrackLite:
    """
    A lightweight ByteTrack-style tracker:
    - High/low confidence split
    - IoU association via Hungarian assignment
    - Simple Kalman filter in XYAH space

    This is intentionally minimal and dependency-light (numpy+scipy),
    designed for a stable HTTP boundary in Pi.
    """

    def __init__(
        self,
        *,
        track_thresh: float = 0.5,
        match_thresh: float = 0.3,
        low_thresh: float = 0.1,
        max_time_lost: int = 30,
    ) -> None:
        self.track_thresh = track_thresh
        self.low_thresh = low_thresh
        self.match_thresh = match_thresh
        self.max_time_lost = max_time_lost

        self._kf = KalmanFilterXYAH()
        self._next_id = 1
        self._tracks: list[TrackState] = []

    def reset(self) -> None:
        self._next_id = 1
        self._tracks = []

    @property
    def tracks(self) -> list[TrackState]:
        return list(self._tracks)

    def step(self, det_xyxy: np.ndarray, det_score: np.ndarray, det_cls: np.ndarray | None = None) -> list[TrackState]:
        if det_xyxy.ndim != 2 or det_xyxy.shape[1] != 4:
            raise ValueError("det_xyxy must be Nx4")
        if det_score.ndim != 1 or det_score.shape[0] != det_xyxy.shape[0]:
            raise ValueError("det_score must be N")
        if det_cls is not None and (det_cls.ndim != 1 or det_cls.shape[0] != det_xyxy.shape[0]):
            raise ValueError("det_cls must be N when provided")

        # Predict existing tracks
        for t in self._tracks:
            t.mean, t.cov = self._kf.predict(t.mean, t.cov)
            t.age += 1
            t.time_since_update += 1

        # Split detections
        high_mask = det_score >= self.track_thresh
        low_mask = (det_score >= self.low_thresh) & ~high_mask

        high_xyxy, high_score = det_xyxy[high_mask], det_score[high_mask]
        low_xyxy, low_score = det_xyxy[low_mask], det_score[low_mask]
        high_cls = det_cls[high_mask] if det_cls is not None else None
        low_cls = det_cls[low_mask] if det_cls is not None else None

        # First association with high conf detections
        self._associate_and_update(high_xyxy, high_score, high_cls, iou_threshold=self.match_thresh)

        # Second association: try to update unmatched tracks with low conf
        self._associate_and_update(low_xyxy, low_score, low_cls, iou_threshold=self.match_thresh * 0.8)

        # Create new tracks from remaining high detections (unmatched)
        # (We mark unmatched detections by returning indices from association)
        # To keep implementation simple, rerun matching and check which detections got matched.
        matched_det = self._matched_detection_mask(high_xyxy)
        for i in range(high_xyxy.shape[0]):
            if matched_det[i]:
                continue
            mean, cov = self._kf.initiate(_xyxy_to_xyah(high_xyxy[i]))
            cls_val = int(high_cls[i]) if high_cls is not None else None
            self._tracks.append(
                TrackState(
                    track_id=self._next_id,
                    mean=mean,
                    cov=cov,
                    hits=1,
                    age=1,
                    time_since_update=0,
                    score=float(high_score[i]),
                    cls=cls_val,
                )
            )
            self._next_id += 1

        # Prune lost tracks
        self._tracks = [t for t in self._tracks if t.time_since_update <= self.max_time_lost]

        # Return active tracks (updated recently)
        return [t for t in self._tracks if t.time_since_update == 0]

    def _associate_and_update(
        self,
        det_xyxy: np.ndarray,
        det_score: np.ndarray,
        det_cls: np.ndarray | None,
        *,
        iou_threshold: float,
    ) -> None:
        if det_xyxy.shape[0] == 0 or len(self._tracks) == 0:
            return

        track_boxes = np.stack([t.to_xyxy() for t in self._tracks], axis=0).astype(np.float32)
        ious = iou_xyxy(track_boxes, det_xyxy.astype(np.float32))
        cost = 1.0 - ious

        row_ind, col_ind = linear_sum_assignment(cost)
        for r, c in zip(row_ind.tolist(), col_ind.tolist(), strict=False):
            if ious[r, c] < iou_threshold:
                continue
            t = self._tracks[r]
            z = _xyxy_to_xyah(det_xyxy[c])
            t.mean, t.cov = self._kf.update(t.mean, t.cov, z)
            t.hits += 1
            t.time_since_update = 0
            t.score = float(det_score[c])
            if det_cls is not None:
                t.cls = int(det_cls[c])

    def _matched_detection_mask(self, det_xyxy: np.ndarray) -> np.ndarray:
        """
        Conservative check: a detection is considered matched if it has IoU >= match_thresh
        with any track that was updated this step.
        """
        if det_xyxy.shape[0] == 0:
            return np.zeros((0,), dtype=bool)
        updated_tracks = [t for t in self._tracks if t.time_since_update == 0]
        if not updated_tracks:
            return np.zeros((det_xyxy.shape[0],), dtype=bool)

        track_boxes = np.stack([t.to_xyxy() for t in updated_tracks], axis=0).astype(np.float32)
        ious = iou_xyxy(track_boxes, det_xyxy.astype(np.float32))
        return (ious.max(axis=0) >= self.match_thresh).astype(bool)

