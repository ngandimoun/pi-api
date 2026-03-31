#!/usr/bin/env python3
"""Verify orchestrator deps import after install (CI / deploy smoke)."""

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
    print(f"smoke_imports: httpx distribution {importlib.metadata.version('httpx')}")
    _require("fastapi")
    _require("httpx")
    _require("pydantic")
    print("smoke_imports: all required imports passed")


if __name__ == "__main__":
    main()

