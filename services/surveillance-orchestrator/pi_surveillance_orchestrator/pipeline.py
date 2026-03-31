from __future__ import annotations

import os
from typing import Any

import httpx


def _env(name: str, default: str) -> str:
    v = os.environ.get(name, default).strip()
    return v.rstrip("/")


class PerceptionPipeline:
    def __init__(self) -> None:
        self.yolo_url = _env("YOLO_SERVICE_URL", "http://localhost:8081")
        self.bytetrack_url = _env("BYTETRACK_SERVICE_URL", "http://localhost:8082")
        self.mmaction_url = _env("MMACTION_SERVICE_URL", "http://localhost:8083")
        self.memae_url = _env("MEMAE_SERVICE_URL", "http://localhost:8084")

        self._client = httpx.Client(timeout=httpx.Timeout(10.0, connect=5.0))

    def health(self) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for name, base in (
            ("yolo", self.yolo_url),
            ("bytetrack", self.bytetrack_url),
            ("mmaction", self.mmaction_url),
            ("memae", self.memae_url),
        ):
            try:
                r = self._client.get(f"{base}/healthz")
                out[name] = {"ok": r.status_code == 200}
            except Exception as e:  # noqa: BLE001
                out[name] = {"ok": False, "error": str(e)}
        return out

    def perceive_one(
        self,
        *,
        stream_id: str,
        frame_index: int,
        image_base64: str,
        mime_type: str | None,
    ) -> dict[str, Any]:
        # 1) detect
        det_r = self._client.post(
            f"{self.yolo_url}/v1/detect",
            json={"input": {"data": image_base64, "mime_type": mime_type}},
        )
        det_r.raise_for_status()
        det = det_r.json()

        # 2) track (single-frame update still yields IDs once stable across calls)
        frame = {
            "frame_index": frame_index,
            "detections": [
                {"xyxy": d["xyxy"], "conf": d["conf"], "cls": d.get("cls")} for d in det.get("detections", [])
            ],
        }
        trk_r = self._client.post(
            f"{self.bytetrack_url}/v1/track",
            json={"stream_id": stream_id, "frames": [frame]},
        )
        trk_r.raise_for_status()
        trk = trk_r.json()
        tracks = (trk.get("frames") or [{}])[0].get("tracks") or []

        # 3) action (MVP: schema boundary only)
        act_r = self._client.post(
            f"{self.mmaction_url}/v1/action",
            json={"input": {"video_base64": "ZmFrZQ==", "mime_type": "video/mp4"}},
        )
        act_r.raise_for_status()
        act = act_r.json()

        # 4) anomaly
        an_r = self._client.post(
            f"{self.memae_url}/v1/anomaly",
            json={"input": {"data": image_base64, "mime_type": mime_type}},
        )
        an_r.raise_for_status()
        an = an_r.json()

        return {
            "object": "surveillance.perception",
            "stream_id": stream_id,
            "frame_index": frame_index,
            "detections": det.get("detections", []),
            "tracks": tracks,
            "actions": act.get("predictions", []),
            "anomaly_score": an.get("score"),
            "meta": {
                "services": {
                    "yolo": det.get("meta"),
                    "bytetrack": trk.get("meta"),
                    "mmaction": act.get("meta"),
                    "memae": an.get("meta"),
                }
            },
        }

