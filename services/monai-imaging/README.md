# Pi MONAI imaging service (Python)

Isolated environment for **[MONAI Core](https://docs.monai.io/)** and the **[MONAI Model Zoo](https://monai.io/model-zoo)** (bundles via `python -m monai.bundle`). This does **not** run inside the Next.js app; the Pi API gateway should call this stack via internal HTTP or workers when you add imaging routes (see [`docs/integrations/monai.md`](../../docs/integrations/monai.md)).

## Reminder (locks, Windows, CI)

- **`requirements.lock.txt` is Linux-oriented** (compiled with `--python-platform linux`). Prefer **WSL2** for locked installs on Windows, or **`pip install -e ".[dev]"`** from this folder.
- **CI** uses **[`requirements-ci.lock.txt`](./requirements-ci.lock.txt)** (PyTorch **CPU** wheels — smaller/faster on GitHub runners). Regenerate from [`requirements-ci.in`](./requirements-ci.in) with the CPU index (see below).
- **GPU production:** use **[`requirements.lock.txt`](./requirements.lock.txt)** (default PyTorch resolution includes CUDA-related wheels). Recompile from [`requirements.in`](./requirements.in) when bumping pins.

## Requirements

- **Python:** **3.11–3.13** (aligned with `services/metabci-neuro`; MONAI supports **≥ 3.9**).
- **OS:** Linux for production containers.

## Install (editable)

```bash
cd services/monai-imaging
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -U pip
pip install -e ".[dev]"
```

## Regenerate lockfiles

```bash
# Default (GPU-oriented torch on Linux)
uv pip compile requirements.in -o requirements.lock.txt --python-version 3.11 --python-platform linux

# CI / CPU-only images
uv pip compile requirements-ci.in -o requirements-ci.lock.txt --python-version 3.11 --python-platform linux \
  --extra-index-url https://download.pytorch.org/whl/cpu --index-strategy unsafe-best-match
```

## Model Zoo bundle download

```bash
pip install -r requirements-ci.lock.txt   # or editable install with monai[fire]
python -m monai.bundle download "spleen_ct_segmentation" --bundle_dir "bundles/"
```

See `python -m monai.bundle download -h` for options. Each bundle may include its own **`docs/data_license.txt`** and weight licenses — comply with those terms. The zoo does **not** assert diagnostic or therapeutic suitability.

## Smoke test

```bash
python scripts/smoke_imports.py
```

## Docker

From repo root (default **CPU** lock):

```bash
docker build -f services/monai-imaging/Dockerfile -t pi-monai-imaging .
```

GPU-oriented lock:

```bash
docker build -f services/monai-imaging/Dockerfile --build-arg MONAI_LOCK=requirements.lock.txt -t pi-monai-imaging-gpu .
```

## Related ecosystem (not pinned here)

- **MONAI Label** (`monailabel`) — AI-assisted annotation; separate install.
- **MONAI Deploy** (`monai-deploy-app-sdk`) — clinical packaging / MAP workflow; separate install.
