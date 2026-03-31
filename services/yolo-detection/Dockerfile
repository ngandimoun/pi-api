# YOLO detection service: default CPU lock (`requirements-ci.lock.txt`).
# For GPU hosts, rebuild with: --build-arg YOLO_LOCK=requirements.lock.txt
FROM python:3.11-bookworm

ARG YOLO_LOCK=requirements-ci.lock.txt

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# OpenCV runtime deps (cv2 needs libGL on Debian slim/base images)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY services/yolo-detection/${YOLO_LOCK} ./requirements.lock.txt
RUN pip install --upgrade pip \
    && if [ "$YOLO_LOCK" = "requirements-ci.lock.txt" ]; then \
         pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.lock.txt; \
       else \
         pip install -r requirements.lock.txt; \
       fi

COPY services/yolo-detection/scripts ./scripts
COPY services/yolo-detection/pi_yolo_detection ./pi_yolo_detection

RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser

RUN python scripts/smoke_imports.py

EXPOSE 8081
ENV PORT=8081

CMD ["python", "-m", "uvicorn", "pi_yolo_detection.api:app", "--host", "0.0.0.0", "--port", "8081"]
