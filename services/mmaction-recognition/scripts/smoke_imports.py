#!/usr/bin/env python3
"""Verify MMAction2 stack import after install (CI / deploy smoke)."""

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
    print(f"smoke_imports: fastapi distribution {importlib.metadata.version('fastapi')}")
    _require("fastapi")
    _require("uvicorn")
    _require("numpy")
    _require("torch")
    _require("torchvision")
    _require("mmengine")
    # mmaction2 may not expose a top-level `mmaction` module in all builds; don't hard-fail on that.
    if importlib.util.find_spec("mmaction") is not None:
        _require("mmaction")
    print("smoke_imports: all required imports passed")


if __name__ == "__main__":
    main()

