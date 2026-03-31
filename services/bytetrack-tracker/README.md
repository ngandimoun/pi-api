# Pi ByteTrack tracker service (Python)

ByteTrack-style multi-object tracking over detector outputs (bounding boxes + confidence).

This does **not** run inside the Next.js app; the Pi API gateway should call this service via internal HTTP / workers.

## Install (editable)

```bash
cd services/bytetrack-tracker
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
docker build -f services/bytetrack-tracker/Dockerfile -t pi-bytetrack-tracker .
docker run --rm -p 8082:8082 pi-bytetrack-tracker
```

Health:

```bash
curl http://localhost:8082/healthz
```
