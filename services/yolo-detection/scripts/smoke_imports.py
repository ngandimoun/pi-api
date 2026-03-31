#!/usr/bin/env python3
"""Verify Ultralytics YOLO imports and basic model load after install (CI / deploy smoke)."""

from __future__ import annotations

import importlib.metadata
import importlib.util
import sys


def _require(name: str) -> None:
    if importlib.util.find_spec(name) is None:
        print(f"smoke_imports: missing package {name!r}", file=sys.stderr)
        raise SystemExit(1)
    importlib.import_module(name)
    print(f"smoke_imports: ok {name}")


def main() -> None:
    print(f"smoke_imports: ultralytics distribution {importlib.metadata.version('ultralytics')}")
    _require("ultralytics")
    _require("numpy")
    _require("cv2")

    # Ensure a small default model can be instantiated. Ultralytics may download weights.
    from ultralytics import YOLO  # noqa: WPS433

    _ = YOLO("yolov8n.pt")
    print("smoke_imports: YOLO(yolov8n.pt) ok")
    print("smoke_imports: all required imports passed")


if __name__ == "__main__":
    main()

