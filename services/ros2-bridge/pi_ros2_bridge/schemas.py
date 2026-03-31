from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    robot_id: str = Field(min_length=1, max_length=128)
    ros_namespace: Optional[str] = Field(default=None, min_length=1, max_length=128)
    metadata: dict[str, Any] = Field(default_factory=dict)


class RegisterResponse(BaseModel):
    ok: bool = True
    robot_id: str
    mode: str


class StateRequest(BaseModel):
    robot_id: str = Field(min_length=1, max_length=128)


class RobotState(BaseModel):
    object: Literal["robot.state"] = "robot.state"
    robot_id: str
    status: Literal["offline", "idle", "busy", "error"] = "idle"
    battery_pct: Optional[float] = None
    position: dict[str, Any] | None = None
    last_seen_at: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class CommandTarget(BaseModel):
    frame: str | None = "map"
    x: float | None = None
    y: float | None = None
    zone: str | None = None
    track_id: int | None = None


class CommandRequest(BaseModel):
    robot_id: str = Field(min_length=1, max_length=128)
    command: str = Field(min_length=1, max_length=64)
    target: CommandTarget | None = None
    message: str | None = Field(default=None, max_length=2000)
    params: dict[str, Any] = Field(default_factory=dict)


class CommandResponse(BaseModel):
    ok: bool = True
    robot_id: str
    command: str
    mode: str
    detail: dict[str, Any] = Field(default_factory=dict)

