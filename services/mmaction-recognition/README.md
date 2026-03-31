# Pi MMAction2 recognition service (Python)

Action / behavior recognition service using **MMAction2**.

This does **not** run inside the Next.js app; the Pi API gateway should call this service via internal HTTP / workers.

## Reminder (locks, Windows, CI)

- **Lockfiles are Linux-oriented** (`--python-platform linux`). MMAction2 + mmcv are especially sensitive to Python/torch/CUDA versions.
- On **Windows**, prefer **Docker** or **WSL2** for reproducible installs.

## Smoke test (Linux / Docker / CI)

```bash
python scripts/smoke_imports.py
```

## Docker

From repo root (default **CPU** lock):

```bash
docker build -f services/mmaction-recognition/Dockerfile -t pi-mmaction-recognition .
docker run --rm -p 8083:8083 pi-mmaction-recognition
```

Health:

```bash
curl http://localhost:8083/healthz
```
