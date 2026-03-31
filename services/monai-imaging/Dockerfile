# MONAI imaging service: default CPU PyTorch (`requirements-ci.lock.txt`). For GPU hosts,
# build with: --build-arg MONAI_LOCK=requirements.lock.txt
FROM python:3.11-bookworm

ARG MONAI_LOCK=requirements-ci.lock.txt

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY services/monai-imaging/${MONAI_LOCK} ./requirements.lock.txt
# CPU lock uses +cpu wheels from PyTorch index; GPU lock uses default PyPI resolution.
RUN pip install --upgrade pip \
    && if [ "$MONAI_LOCK" = "requirements-ci.lock.txt" ]; then \
         pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.lock.txt; \
       else \
         pip install -r requirements.lock.txt; \
       fi

COPY services/monai-imaging/scripts ./scripts
COPY services/monai-imaging/pi_monai_imaging ./pi_monai_imaging

RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser

RUN python scripts/smoke_imports.py

CMD ["python", "scripts/smoke_imports.py"]
