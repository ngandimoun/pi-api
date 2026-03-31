# Pi YOLO detection service (Python)

Isolated environment for **Ultralytics YOLOv8** detection. This does **not** run inside the Next.js app; the Pi API gateway should call this service via internal HTTP / workers.

## Reminder (locks, Windows, CI)

- **`requirements*.lock.txt` are Linux-oriented** (compiled with `--python-platform linux`). Prefer **WSL2** for locked installs on Windows, or use **editable installs** from this folder on Windows.
- **CI** will use **`requirements-ci.lock.txt`** (CPU).

## Requirements

- **Python:** **3.11–3.13** (we standardize on **3.11** for Docker/CI)
- **OS:** Linux for production containers

## Install (editable)

```bash
cd services/yolo-detection
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -U pip
pip install -e ".[dev]"
```

## Smoke test

```bash
python scripts/smoke_imports.py
```

## Unit tests

```bash
pytest -q
```

## Docker

From repo root:

```bash
docker build -f services/yolo-detection/Dockerfile -t pi-yolo-detection .
docker run --rm -p 8081:8081 pi-yolo-detection
```

Health:

```bash
curl http://localhost:8081/healthz
```
