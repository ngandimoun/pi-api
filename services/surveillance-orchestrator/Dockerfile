# Surveillance orchestrator: coordinates perception services over HTTP.
FROM python:3.11-bookworm

ARG ORCH_LOCK=requirements-ci.lock.txt

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY services/surveillance-orchestrator/${ORCH_LOCK} ./requirements.lock.txt
RUN pip install --upgrade pip \
    && pip install -r requirements.lock.txt

COPY services/surveillance-orchestrator/scripts ./scripts
COPY services/surveillance-orchestrator/pi_surveillance_orchestrator ./pi_surveillance_orchestrator

RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser

RUN python scripts/smoke_imports.py

EXPOSE 8080
ENV PORT=8080

CMD ["python", "-m", "uvicorn", "pi_surveillance_orchestrator.api:app", "--host", "0.0.0.0", "--port", "8080"]
