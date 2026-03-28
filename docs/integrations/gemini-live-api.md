# Gemini Live API (3.1 Flash Live Preview) — internal stack

> [!WARNING]
> **Preview:** Gemini Live API is in preview. Expect breaking changes and handle disconnects/resets.

## Policy (piii)

- **Allowed model**: `gemini-3.1-flash-live-preview` only.
- **Response modality**: native audio output models support **AUDIO-only**. For text, enable transcriptions.
- **Tool use**: allowed (manual handling required):
  - function calling (synchronous only)
  - Google Search grounding
- **Not supported in 3.1 Flash Live** (do not implement): async function calling (`NON_BLOCKING`), proactive audio, affective dialog, code execution, URL context.

## Where code lives

Use the internal stack:
- `src/lib/gemini/live/config.ts` (strict model guard + env keys)
- `src/lib/gemini/live/sdk.ts` (SDK connect helper)
- `src/lib/gemini/live/ws.ts` (raw WebSocket message helpers)
- `src/lib/gemini/live/tools.ts` (tool config helpers + guardrails)
- `src/lib/gemini/live/ephemeral.ts` (ephemeral token provisioning, internal-only)
- `src/lib/gemini/live/audio.ts` (PCM16/base64 helpers)

## Authentication approaches (we support both)

### Client-direct (recommended)

- Backend provisions an **ephemeral token** (v1alpha).
- Client connects directly to Live WebSocket using:
  - `access_token=<ephemeral-token>`
- Benefits: lowest latency; no streaming proxy on our infra.

**Pi Voice REST API:** `POST /api/v1/voice/sessions` returns both LiveKit and Gemini Live connection payloads. See `docs/integrations/livekit.md` for the dual-connection model, **`max_duration_seconds`** (client-side auto-end), and **`ttl_seconds`** (token / room window).

### Server-proxy

- Backend holds long-lived API key and maintains the Live WebSocket session.
- Client streams audio/video/text to backend; backend forwards to Gemini Live.
- Benefits: simpler client; more server cost/latency.

## Audio formats (required)

- **Input**: raw 16-bit PCM, little-endian. Native input rate is **16kHz**.
  - Send MIME type like `audio/pcm;rate=16000`.
- **Output**: raw 16-bit PCM, little-endian, **24kHz**.

## Streaming best practices

- Send audio in small chunks (20–100ms).
- Do not buffer 1s+ before sending.
- On `interrupted: true`, immediately stop playback and discard queued audio.

## Tool calling loop (3.1 Flash Live)

- Live API does **not** auto-handle tool responses.
- Tool calls are **sequential**: the model will wait for tool results.

## 3.1 Live message handling gotcha

In `gemini-3.1-flash-live-preview`, a single server event can contain **multiple content parts**
(e.g. `inlineData` audio + transcription). Always iterate all parts to avoid missing data.

## Session management essentials

- Sessions have time limits (audio-only ~15 min; audio+video ~2 min).
- Connections may reset (~10 min). Implement:
  - **GoAway** handling (timeLeft)
  - **Session resumption** (store handle from updates; reconnect with it)
  - **Context window compression** (audio tokens accumulate quickly)

