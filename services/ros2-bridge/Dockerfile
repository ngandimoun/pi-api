# ROS2 bridge service: default lock (`requirements-ci.lock.txt`).
# This is a stub-by-default boundary; real robot integration can be provided via a ROS bridge in the network.
FROM python:3.11-bookworm

ARG ROS2_LOCK=requirements-ci.lock.txt

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY services/ros2-bridge/${ROS2_LOCK} ./requirements.lock.txt
RUN pip install --upgrade pip \
    && pip install -r requirements.lock.txt

COPY services/ros2-bridge/scripts ./scripts
COPY services/ros2-bridge/pi_ros2_bridge ./pi_ros2_bridge

RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser

RUN PYTHONPATH=/app python scripts/smoke_imports.py

EXPOSE 8085
ENV PORT=8085

CMD ["python", "-m", "uvicorn", "pi_ros2_bridge.api:app", "--host", "0.0.0.0", "--port", "8085"]

