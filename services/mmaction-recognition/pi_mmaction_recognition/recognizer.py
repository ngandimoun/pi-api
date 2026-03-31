from __future__ import annotations

from typing import Any


def recognize_actions_smoketest() -> dict[str, Any]:
    """
    Smoke boundary: verify the MMAction2 stack is importable inside the container / env.
    We intentionally keep the MVP inference path minimal because MMAction2 configs/checkpoints
    are large and will be added in a later step (with model download caching).
    """

    # Imports should succeed in Docker/CI (Linux lockfiles).
    import mmengine  # noqa: WPS433

    try:
        import mmaction  # type: ignore  # noqa: WPS433
    except Exception:  # noqa: BLE001
        # Some installs expose mmaction2 as a package without top-level `mmaction`.
        mmaction = None  # type: ignore[assignment]

    return {
        "status": "ok",
        "mmengine": getattr(mmengine, "__version__", None),
        "mmaction": getattr(mmaction, "__version__", None) if mmaction is not None else None,
    }

