#!/usr/bin/env python3
"""Verify MetaBCI, Braindecode, and MOABB import after install (CI / deploy smoke)."""

from __future__ import annotations

import importlib.metadata
import importlib.util
import os
import sys


def _require(name: str) -> None:
    if importlib.util.find_spec(name) is None:
        print(f"smoke_imports: missing package {name!r}", file=sys.stderr)
        raise SystemExit(1)
    importlib.import_module(name)
    print(f"smoke_imports: ok {name}")


def main() -> None:
    # Distribution pins
    print(f"smoke_imports: metabci distribution {importlib.metadata.version('metabci')}")
    print(f"smoke_imports: braindecode distribution {importlib.metadata.version('braindecode')}")
    print(f"smoke_imports: moabb distribution {importlib.metadata.version('moabb')}")
    _require("brainda")
    _require("brainflow")
    _require("braindecode")
    _require("moabb")

    # brainstim pulls PsychoPy; often fails on headless servers — optional unless enforced
    strict = os.environ.get("PI_METABCI_SMOKE_STRICT_BRAINSTIM", "").lower() in (
        "1",
        "true",
        "yes",
    )
    try:
        _require("brainstim")
    except SystemExit:
        if strict:
            raise
        print(
            "smoke_imports: brainstim skipped (set PI_METABCI_SMOKE_STRICT_BRAINSTIM=1 to fail on this)",
            file=sys.stderr,
        )

    print("smoke_imports: all required imports passed")


if __name__ == "__main__":
    main()
