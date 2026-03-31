# Pi MetaBCI neuro service (Python)

Isolated environment for **[MetaBCI](https://github.com/TBC-TJU/MetaBCI)** (`metabci` on PyPI). This does **not** run inside the Next.js app; the Pi API gateway will call this stack via future internal HTTP/workers (see [`docs/integrations/metabci.md`](../../docs/integrations/metabci.md)).

### Reminder (read before building health / neuro APIs)

- **`requirements.lock.txt` is Linux-only.** Installing it on **native Windows** often fails (platform-specific Qt / PsychoPy wheels and related stack). Use **WSL2** (Ubuntu) for locked installs, or on Windows use **`pip install -e ".[dev]"`** (editable install from this folder) instead of the full lock.
- **CI:** [`.github/workflows/metabci-neuro-smoke.yml`](../../.github/workflows/metabci-neuro-smoke.yml) validates the **slim** API lock on **`ubuntu-latest`** (see below).
- **Slim API / decode-only containers:** use [`requirements-api.lock.txt`](./requirements-api.lock.txt) (`metabci[brainda,brainflow]` + **Braindecode** + **MOABB** — no **brainstim** / PsychoPy). Regenerate from [`requirements-api.in`](./requirements-api.in). Full lab stack remains [`requirements.lock.txt`](./requirements.lock.txt) (`metabci[all]` + Braindecode + MOABB).

## Requirements

- **Python:** **3.11–3.13** (Braindecode ≥ 1.3.x requires **≥ 3.11**; we standardize on **3.11** for Docker and CI).
- **OS:** Linux for production containers. On **Windows**, use **WSL2 (Ubuntu)** or **conda**; native Windows is best-effort for scientific wheels.

## Install (editable, matches `pyproject.toml`)

```bash
cd services/metabci-neuro
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -U pip
pip install -e ".[dev]"
```

## Install (locked, Linux / Docker)

[`requirements.lock.txt`](./requirements.lock.txt) and [`requirements-api.lock.txt`](./requirements-api.lock.txt) are compiled for **`--python-platform linux`** (reproducible Linux servers and Docker). **CI** uses [`requirements-api.lock.txt`](./requirements-api.lock.txt) only. Neither full lock is guaranteed to install on **native Windows**; prefer **WSL2** for locked installs, or use the **editable** install above.

Regenerate after changing lock inputs:

```bash
# Full stack (metabci[all])
uv pip compile requirements.in -o requirements.lock.txt --python-version 3.11 --python-platform linux

# API-only (metabci[brainda,brainflow])
uv pip compile requirements-api.in -o requirements-api.lock.txt --python-version 3.11 --python-platform linux
```

Then:

```bash
pip install -r requirements.lock.txt
# or
pip install -r requirements-api.lock.txt
```

### PyTorch: CUDA vs CPU

The default lock resolves **PyTorch with CUDA-related wheels** suitable for **GPU hosts**. For **CPU-only** images, recompile with PyTorch’s CPU index, for example:

```bash
uv pip compile requirements.in -o requirements.lock.txt \
  --python-version 3.11 --python-platform linux \
  --extra-index-url https://download.pytorch.org/whl/cpu \
  --index-strategy unsafe-best-match
```

(Resolution can be slow; pin and commit the result once satisfied.)

## Smoke test

```bash
python scripts/smoke_imports.py
```

On headless servers, `brainstim` (PsychoPy) may fail to import. By default the script **warns and continues**. To **fail** if `brainstim` does not import:

```bash
export PI_METABCI_SMOKE_STRICT_BRAINSTIM=1
python scripts/smoke_imports.py
```

## Docker

**Full stack** (includes brainstim / PsychoPy transitive deps — larger image):

```bash
docker build -f services/metabci-neuro/Dockerfile -t pi-metabci-neuro .
```

Uses [`requirements.lock.txt`](./requirements.lock.txt).

**API / decode-only** (smaller — `brainda` + `brainflow` only):

```bash
docker build -f services/metabci-neuro/Dockerfile.api -t pi-metabci-neuro-api .
```

Uses [`requirements-api.lock.txt`](./requirements-api.lock.txt).

Ensure the host (or orchestrator) provides **NVIDIA runtime** if you rely on GPU-backed PyTorch from these locks.

## Upstream

- MetaBCI: [metabci.readthedocs.io](https://metabci.readthedocs.io/) — **GPL-2.0**.
- Braindecode: [braindecode.org](https://braindecode.org/) — **BSD-3-Clause** (see upstream `LICENSE` / `NOTICE`). [`docs/integrations/braindecode.md`](../../docs/integrations/braindecode.md).
- MOABB: [moabb.neurotechx.com](https://moabb.neurotechx.com/) — **BSD-3-Clause**. [`docs/integrations/moabb.md`](../../docs/integrations/moabb.md).
