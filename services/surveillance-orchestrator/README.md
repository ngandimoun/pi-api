# Pi surveillance orchestrator (Python)

Coordinates the perception microservices:

- YOLO detection (`pi-yolo-detection`)
- ByteTrack tracker (`pi-bytetrack-tracker`)
- MMAction2 recognition (`pi-mmaction-recognition`)
- MemAE anomaly (`pi-memae-anomaly`)

This orchestrator exposes **perception-only** output (`/v1/perceive`). The TypeScript layer then calls **Gemini 3.1 Flash** to narrate events and produce alerts.

## Docker

From repo root:

```bash
docker build -f services/surveillance-orchestrator/Dockerfile -t pi-surveillance-orchestrator .
docker run --rm -p 8080:8080 \
  -e YOLO_SERVICE_URL=http://host.docker.internal:8081 \
  -e BYTETRACK_SERVICE_URL=http://host.docker.internal:8082 \
  -e MMACTION_SERVICE_URL=http://host.docker.internal:8083 \
  -e MEMAE_SERVICE_URL=http://host.docker.internal:8084 \
  pi-surveillance-orchestrator
```

Health:

```bash
curl http://localhost:8080/healthz
```
