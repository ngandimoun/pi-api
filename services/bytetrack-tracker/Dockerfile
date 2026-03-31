# ByteTrack-style tracker service (CPU only).
FROM python:3.11-bookworm

ARG TRACKER_LOCK=requirements-ci.lock.txt

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY services/bytetrack-tracker/${TRACKER_LOCK} ./requirements.lock.txt
RUN pip install --upgrade pip \
    && pip install -r requirements.lock.txt

COPY services/bytetrack-tracker/scripts ./scripts
COPY services/bytetrack-tracker/pi_bytetrack_tracker ./pi_bytetrack_tracker

RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser

RUN python scripts/smoke_imports.py

EXPOSE 8082
ENV PORT=8082

CMD ["python", "-m", "uvicorn", "pi_bytetrack_tracker.api:app", "--host", "0.0.0.0", "--port", "8082"]
