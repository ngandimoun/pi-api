# ROS2 Bridge (Pi) — Robotics sidecar

This service is a **Pi-managed sidecar** that provides a simple HTTP boundary for robot control/state.

It is intentionally **not** a full ROS2 stack; the goal is to keep the Pi API (Next.js) free of ROS dependencies.

## Endpoints

- `GET /healthz`
- `POST /v1/register`
- `GET /v1/state?robot_id=...`
- `POST /v1/command`

## Configuration

- `PORT` (default `8085`)
- `ROS2_MODE`:
  - `stub` (default): deterministic simulated responses
  - `rosbridge`: connect to `ROSBRIDGE_WS_URL` (future; not required for MVP)

## Notes

For local dev, run via Docker compose once it is wired into `docker-compose.surveillance.yml`.

