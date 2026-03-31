# MetaBCI runtime — Linux lockfile (PyTorch CUDA wheels). Use NVIDIA Container Toolkit on GPU nodes.
# CPU-only: recompile requirements.lock.txt with PyTorch CPU index (see README.md).

FROM python:3.11-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgomp1 \
        libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY services/metabci-neuro/requirements.lock.txt ./requirements.lock.txt
RUN pip install --upgrade pip \
    && pip install -r requirements.lock.txt

COPY services/metabci-neuro/scripts ./scripts
COPY services/metabci-neuro/pi_metabci_neuro ./pi_metabci_neuro

RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser

# Verify imports (brainstim optional unless PI_METABCI_SMOKE_STRICT_BRAINSTIM=1)
RUN python scripts/smoke_imports.py

CMD ["python", "scripts/smoke_imports.py"]
