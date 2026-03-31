# MemAE-style anomaly service: default CPU lock (`requirements-ci.lock.txt`).
# For GPU hosts, rebuild with: --build-arg MEMAE_LOCK=requirements.lock.txt
FROM python:3.11-bookworm

ARG MEMAE_LOCK=requirements-ci.lock.txt

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY services/memae-anomaly/${MEMAE_LOCK} ./requirements.lock.txt
RUN pip install --upgrade pip \
    && if [ "$MEMAE_LOCK" = "requirements-ci.lock.txt" ]; then \
         pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.lock.txt; \
       else \
         pip install -r requirements.lock.txt; \
       fi

COPY services/memae-anomaly/scripts ./scripts
COPY services/memae-anomaly/pi_memae_anomaly ./pi_memae_anomaly

RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser

RUN python scripts/smoke_imports.py

EXPOSE 8084
ENV PORT=8084

CMD ["python", "-m", "uvicorn", "pi_memae_anomaly.api:app", "--host", "0.0.0.0", "--port", "8084"]
