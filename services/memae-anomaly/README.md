# Pi MemAE anomaly service (Python)

Anomaly scoring service (MemAE-style autoencoder baseline) for video surveillance.

This does **not** run inside the Next.js app; the Pi API gateway should call this service via internal HTTP / workers.

## Reminder (locks, Windows, CI)

- **Lockfiles are Linux-oriented** (`--python-platform linux`). On **Windows**, prefer Docker/WSL2 for reproducible installs.
- **CI** uses **CPU torch** wheels.

## Smoke test (Linux / Docker / CI)

```bash
python scripts/smoke_imports.py
```

## Docker

From repo root:

```bash
docker build -f services/memae-anomaly/Dockerfile -t pi-memae-anomaly .
docker run --rm -p 8084:8084 pi-memae-anomaly
```

Health:

```bash
curl http://localhost:8084/healthz
```
