from __future__ import annotations

import os
import time
from typing import Any

from fastapi import FastAPI, HTTPException, Query

from .schemas import (
    CommandRequest,
    CommandResponse,
    RegisterRequest,
    RegisterResponse,
    RobotState,
)


def _env(name: str, default: str) -> str:
    return os.environ.get(name, default).strip()


ROS2_MODE = _env("ROS2_MODE", "stub")

app = FastAPI(title="Pi ROS2 Bridge", version="0.1.0")

# In-memory registry/state (MVP). Persisting is the Pi API's job.
_registry: dict[str, dict[str, Any]] = {}


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    return {"ok": True, "mode": ROS2_MODE}


@app.post("/v1/register", response_model=RegisterResponse)
def register_robot(body: RegisterRequest) -> RegisterResponse:
    _registry[body.robot_id] = {
        "ros_namespace": body.ros_namespace,
        "metadata": body.metadata,
        "registered_at": int(time.time()),
    }
    return RegisterResponse(robot_id=body.robot_id, mode=ROS2_MODE)


@app.get("/v1/state", response_model=RobotState)
def get_state(robot_id: str = Query(..., min_length=1, max_length=128)) -> RobotState:
    reg = _registry.get(robot_id)
    now = int(time.time())
    if not reg:
        return RobotState(robot_id=robot_id, status="offline", last_seen_at=None, metadata={"registered": False})
    return RobotState(
        robot_id=robot_id,
        status="idle",
        last_seen_at=now,
        battery_pct=100.0,
        position={"frame": "map", "x": 0.0, "y": 0.0, "heading_deg": 0.0},
        metadata={"registered": True, **(reg.get("metadata") or {})},
    )


@app.post("/v1/command", response_model=CommandResponse)
def command(body: CommandRequest) -> CommandResponse:
    if ROS2_MODE not in ("stub", "rosbridge"):
        raise HTTPException(status_code=400, detail="Invalid ROS2_MODE")

    # MVP: deterministic stub responses. Real integration can be added without changing the Pi API surface.
    if body.robot_id not in _registry:
        raise HTTPException(status_code=404, detail="Robot not registered")

    return CommandResponse(
        robot_id=body.robot_id,
        command=body.command,
        mode=ROS2_MODE,
        detail={
            "accepted": True,
            "target": body.target.model_dump() if body.target else None,
            "message": body.message,
            "params": body.params,
        },
    )

