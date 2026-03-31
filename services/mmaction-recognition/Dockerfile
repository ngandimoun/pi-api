# MMAction2 recognition service: default CPU lock (`requirements-ci.lock.txt`).
# For GPU hosts, rebuild with: --build-arg MMACTION_LOCK=requirements.lock.txt
FROM python:3.11-bookworm

ARG MMACTION_LOCK=requirements-ci.lock.txt

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY services/mmaction-recognition/${MMACTION_LOCK} ./requirements.lock.txt
RUN pip install --upgrade pip \
    && if [ "$MMACTION_LOCK" = "requirements-ci.lock.txt" ]; then \
         pip install "setuptools==69.5.1" \
         && pip install --no-build-isolation --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.lock.txt; \
       else \
         pip install "setuptools==69.5.1" \
         && pip install --no-build-isolation -r requirements.lock.txt; \
       fi

COPY services/mmaction-recognition/scripts ./scripts
COPY services/mmaction-recognition/pi_mmaction_recognition ./pi_mmaction_recognition

RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser

RUN python scripts/smoke_imports.py

EXPOSE 8083
ENV PORT=8083

CMD ["python", "-m", "uvicorn", "pi_mmaction_recognition.api:app", "--host", "0.0.0.0", "--port", "8083"]
