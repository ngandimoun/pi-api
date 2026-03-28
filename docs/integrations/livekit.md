# LiveKit — internal stack (voice agents)

## Why LiveKit in Pi

LiveKit gives Pi a **production-grade WebRTC transport + session layer** for realtime voice/video/data:
- low latency audio/video to/from users
- robust networking (ICE/TURN fallbacks)
- rooms/participants/tracks primitives
- webhooks + server APIs for orchestration

In our architecture:
- **LiveKit** = realtime transport + sessions + rooms
- **Gemini Live (3.1 Flash Live Preview only)** = the voice “brain” (see `docs/integrations/gemini-live-api.md`)

## Hosting recommendation

Default to **LiveKit Cloud** for production speed and reliability, but keep everything **env-driven** so you can self-host without code changes.

## Where code lives (use this, don’t re-implement)

All LiveKit helpers live under:
- `src/lib/livekit/*`

Key modules:
- `src/lib/livekit/env.ts`: env accessors
- `src/lib/livekit/tokens.ts`: token minting (user + hidden agent tokens)
- `src/lib/livekit/room-service.ts`: RoomServiceClient wrappers
- `src/lib/livekit/webhooks.ts`: webhook verification (raw body required)

## Environment variables

Required (server):
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Optional (recommended for webhook signing isolation):
- `LIVEKIT_WEBHOOK_API_KEY` (defaults to `LIVEKIT_API_KEY`)
- `LIVEKIT_WEBHOOK_API_SECRET` (defaults to `LIVEKIT_API_SECRET`)

## Frontend connect (web)

LiveKit clients connect with:
- `wsUrl`: your LiveKit project URL (`LIVEKIT_URL`)
- `token`: JWT minted server-side via `src/lib/livekit/tokens.ts`

Reference pattern:
- create room name + identity on server
- mint token with appropriate grants
- send token + url to client
- client calls `Room.connect(wsUrl, token)`

## LiveKit Transport (WebRTC layer) — internal guidance

LiveKit is not only “agents”; it’s a **transport + SDK ecosystem** for realtime apps (voice, video, data) across many platforms.

### SDK ecosystem (what matters for Pi)

- **Realtime client SDKs**: user-facing apps that join rooms (web, mobile, desktop, embedded).
- **Server-side SDKs**: backend orchestration and media processing (token minting, room/participant control, webhooks, raw track processing).

In this repo today we use:
- **Web client**: `livekit-client` (see `src/app/internal/livekit-example/*`)
- **Server**: `livekit-server-sdk` wrappers under `src/lib/livekit/*`

### Key transport concepts to keep in mind

- **Unified room model**: rooms/participants/tracks are consistent across SDKs.
- **Media**: publish/subscribe audio/video/screen share; server-side raw track processing exists for deeper integrations.
- **Data**: text streams, byte streams (files), RPC, data packets, and shared state sync patterns.
- **Encryption**: optional end-to-end encryption (E2EE) for media + data (plan early; it affects architecture).
- **Hosting**: LiveKit Cloud vs self-hosted; Pi keeps config env-driven either way.

### Useful LiveKit transport docs links

- Transport overview: `https://docs.livekit.io/transport.md`
- SDK platforms quickstarts: `https://docs.livekit.io/transport/sdk-platforms.md`
- Media overview: `https://docs.livekit.io/transport/media.md`
- Data overview: `https://docs.livekit.io/transport/data.md`
- Encryption (E2EE): `https://docs.livekit.io/transport/encryption.md`
- Self-hosting: `https://docs.livekit.io/transport/self-hosting.md`

## Self-hosting (servers + agents) — internal guidance

We default to **LiveKit Cloud**, but Pi’s LiveKit integration is designed so we can **self-host** by changing env vars and infra, not code.

### Cloud vs self-host (high level)

- **Cloud**: managed global mesh SFU, built-in dashboards/observability, managed agent hosting, and LiveKit Inference.
- **Self-host**: full control over infra/config/data; you run the SFU, TURN, scaling, metrics, and (optionally) your agent servers.

### Operational gotchas (self-hosting)

- **TLS is mandatory** for production endpoints (`wss://...`) with a trusted CA cert.
- **WebRTC requires UDP ports** and correct public IP advertisement; plan firewall + NAT carefully.
- **TURN** is often required for corporate networks; consider TURN/TLS on `443` for best reach.
- For production, **Redis** is commonly recommended in LiveKit configs.

### Useful LiveKit self-hosting docs links

- Self-hosting overview: `https://docs.livekit.io/transport/self-hosting.md`
- Deployment guide: `https://docs.livekit.io/transport/self-hosting/deployment.md`
- Running locally: `https://docs.livekit.io/transport/self-hosting/local.md`
- Kubernetes: `https://docs.livekit.io/transport/self-hosting/kubernetes.md`
- Ports/firewall: `https://docs.livekit.io/transport/self-hosting/ports-firewall.md`
- Ingress/Egress self-hosting: `https://docs.livekit.io/transport/self-hosting/ingress.md`, `https://docs.livekit.io/transport/self-hosting/egress.md`

## Media (tracks) — internal guidance

LiveKit media is built around **tracks**. Participants **publish** and **subscribe** to audio/video tracks, and apps decide how to render/play them.

### Voice agent topology (media)

For a basic AI voice agent room:
- **End-user** publishes their microphone track and subscribes to the agent’s audio track.
- **Agent** subscribes to the user’s microphone track and publishes an audio track (synth speech).

This maps cleanly to our “LiveKit transport + Gemini Live brain” split.

### Video + screenshare

- Video and screenshare are just video tracks (often 2 tracks per participant if both camera + screenshare).
- Agents/programmatic participants can subscribe to video for vision tasks, and can also publish synthetic video if needed.

### Advanced media notes (future)

- **Selective subscription**: disable `autoSubscribe` when you need explicit control over which tracks a participant receives.
- **Adaptive stream / simulcast / dynacast**: important for scaling video; avoid sending high-res video to tiny/hidden UI tiles.
- **Noise/echo cancellation**: WebRTC baseline everywhere; enhanced options exist on LiveKit Cloud and are often critical for voice UX.
- **Raw track processing**: server-side SDKs can iterate per-frame audio/video for custom pipelines (monitoring, effects, transcription bridges).
- **Ingress/Egress**: import RTMP/WHIP or export/record rooms and tracks.

### Useful LiveKit media docs links

- Media overview: `https://docs.livekit.io/transport/media.md`
- Publish camera/mic: `https://docs.livekit.io/transport/media/publish.md`
- Screen sharing: `https://docs.livekit.io/transport/media/screenshare.md`
- Subscribe/render tracks: `https://docs.livekit.io/transport/media/subscribe.md`
- Raw tracks: `https://docs.livekit.io/transport/media/raw-tracks.md`
- Noise cancellation: `https://docs.livekit.io/transport/media/noise-cancellation.md`
- Codecs/simulcast/dynacast/hi-fi audio: `https://docs.livekit.io/transport/media/advanced.md`
- Ingress/Egress: `https://docs.livekit.io/transport/media/ingress-egress.md`

## Data (text/bytes/RPC/state) — internal guidance

LiveKit provides realtime data exchange alongside media. Prefer the **highest-level primitive** that fits the use case:

- **Text streams**: chunked text by topic (chat, transcripts, streaming LLM output).
- **Byte streams**: files/images/binary blobs with progress (images from client → agent, attachments).
- **RPC**: request/response calls to another participant (agent tool forwarding to frontend UI/data).
- **Data packets**: low-level reliable/lossy packets (only for advanced/high-frequency needs).
- **State sync**: participant attributes/metadata + room metadata (low-frequency shared state).

### Voice-agent mapping

- **Transcripts + chat**: text streams (topics like `lk.chat`, `lk.transcription` are common patterns).
- **User-provided images**: byte streams from frontend to an agent/programmatic participant.
- **Tool forwarding to frontend**: RPC (agent calls frontend method; frontend responds with JSON string).
- **Session state**: store durable state in DB; use attributes/metadata for small, low-frequency shared flags.

### Useful LiveKit data docs links

- Data overview: `https://docs.livekit.io/transport/data.md`
- Text streams: `https://docs.livekit.io/transport/data/text-streams.md`
- Byte streams: `https://docs.livekit.io/transport/data/byte-streams.md`
- RPC: `https://docs.livekit.io/transport/data/rpc.md`
- Data packets: `https://docs.livekit.io/transport/data/packets.md`
- State sync overview: `https://docs.livekit.io/transport/data/state.md`

## Webhooks (important)

LiveKit webhooks must be verified using the **raw request body string** (not parsed JSON).

In this repo use:
- `verifyAndParseLiveKitWebhook({ rawBody, authorizationHeader })`

## How this pairs with Gemini Live

### Shipped Pi REST voice API (client-direct)

`POST /api/v1/voice/sessions` returns **two** connections:

- **LiveKit** (`connection.livekit`): WebRTC room + JWT for the end user (recording, multi-party, future features).
- **Gemini Live** (`connection.gemini_live`): WebSocket URL + ephemeral token so the **client** opens a **direct** session to Gemini (`gemini-3.1-flash-live-preview` only; see `docs/integrations/gemini-live-api.md`).

There is **no** long-lived Pi server process bridging audio between LiveKit and Gemini in this slice. The developer’s app must connect to **both** transports and mix/route audio as needed (e.g. play model audio to the user while sending mic audio to Gemini).

### Optional: LiveKit participant as audio bridge

A different topology (LiveKit Agents, or a custom worker) is:

- user joins LiveKit room (WebRTC)
- agent joins as a participant (hidden is common)
- worker bridges audio frames into Gemini Live and publishes model audio back into the room

Use that when you want a **single** WebRTC surface for the user and centralized control on the server. It requires an **always-on** worker, not serverless request/response alone.

## Voice session duration (`max_duration_seconds` and `ttl_seconds`)

The Voice API exposes an explicit **maximum call length** so clients can auto-end reliably:

- **`max_duration_seconds`** — Returned on `POST /api/v1/voice/sessions` and `GET /api/v1/voice/sessions/:id`. Resolved from the voice agent’s `behaviors.max_duration_seconds` or from an optional **per-session** override in the create body (see `src/contracts/voice-session-api.ts`). Stored on `voice_sessions.max_duration_seconds` in Postgres.
- **`ttl_seconds`** — Session provisioning window: drives LiveKit room **empty** timeout (`emptyTimeout`), LiveKit participant JWT TTL, and Gemini ephemeral token expiry. If both `ttl_seconds` and `max_duration_seconds` are set, the API requires **`ttl_seconds >= max_duration_seconds`** so tokens do not expire before the intended call cap.

### Who enforces the cap?

Pi’s serverless API **does not** hang up the user’s microphone or WebRTC session by itself. **Enforcement is client-side:** when elapsed time since session start reaches `max_duration_seconds`, the client should disconnect the Gemini Live WebSocket, leave the LiveKit room, and call `POST /api/v1/voice/sessions/:id/complete` with the transcript for structured extraction.

Agent `behaviors.max_duration_seconds` is also reflected in the compiled **system instruction** as a soft hint to the model; the **hard** guarantee for billing/product limits is the **client timer** (plus your own backend policies if needed).

### Why `createLiveKitRoom` does not set a “max room duration”

The pinned **`livekit-server-sdk`** `CreateOptions` / protobuf `CreateRoomRequest` used in this repo **do not** include a field for maximum room lifetime. `src/lib/livekit/room-service.ts` documents that; the cap is still echoed in **room metadata JSON** (`max_duration_seconds` alongside `pi_voice_session_id`, `org_id`, `agent_id`) for observability and any future automation.

### If you need server-side teardown

To close rooms without trusting the client, add one of:

- a **LiveKit Agents** (or similar) worker that tracks elapsed time and removes participants or deletes the room;
- a **scheduled job** that calls RoomService `DeleteRoom` / disconnect APIs for sessions past `max_duration_seconds`;
- or a future LiveKit stack/SDK that exposes an explicit max room duration, if you adopt it end-to-end.

If you’re building a “few lines of code” experience on the **current** API: use **`max_duration_seconds` + a client timer**, keep **`ttl_seconds`** high enough, and complete the session with the transcript when the timer fires.

## Models strategy (LiveKit Agents vocabulary)

LiveKit’s docs describe two common patterns for voice agents:

- **STT → LLM → TTS pipeline**: best when you want specialized providers for each step (higher control, easier to swap pieces).
- **Realtime (speech-to-speech) model**: best when you want end-to-end low latency and natural voice (model handles turn-taking + voice output).

LiveKit also distinguishes:

- **LiveKit Inference**: access to models via LiveKit Cloud (no extra provider keys in your infra).
- **Plugins**: connect directly to providers using your own API keys (OpenAI, Google, Deepgram, Cartesia, etc).

### Pi policy (important)

- Our **Gemini Live voice agent policy is strict**: we only use **`gemini-3.1-flash-live-preview`** for realtime voice via our stack in `src/lib/gemini/live/*`.
- LiveKit Agents supports many models/providers, but **do not** add “pick any realtime model” behavior to Pi voice agents unless we explicitly decide to.

### Useful LiveKit docs links

- Models overview: `https://docs.livekit.io/agents/models.md`
- LiveKit Inference: `https://docs.livekit.io/agents/models/inference.md`
- Realtime models (includes Gemini Live): `https://docs.livekit.io/agents/models/realtime.md`
- Gemini Live API plugin (LiveKit Agents): `https://docs.livekit.io/agents/models/realtime/plugins/gemini.md`

## LiveKit Agents framework (logic & structure) — internal guidance

We are intentionally **not vendoring the full LiveKit Agents SDK in this repo yet**. However, when you design voice-agent logic, LiveKit’s structure is useful vocabulary for planning APIs and services:

- **Agent sessions (`AgentSession`)**: the orchestrator for input (audio/text/video), pipeline decisions, and output delivery.
- **Tasks / TaskGroups**: short-lived, typed sub-flows (consent, address capture, stepwise collection) that temporarily take control until completion.
- **Workflows**: repeatable multi-agent patterns (handoffs, phases, routing) built from agents + tasks + tools.
- **Tools**: deterministic actions the model can call (API calls, DB ops, “handoff now”, frontend RPC).
- **Pipeline nodes & hooks**: customization points (STT/LLM/TTS nodes, `onEnter`, `onUserTurnCompleted`, transcription transforms).
- **Turn detection & interruptions**: how you choose when to respond vs wait, and how to handle barge-in.
- **External data / RAG**: preloading initial context + per-turn retrieval + tool-based data access.

### How this maps to Pi today

- **Transport/session layer**: LiveKit rooms + participants + tracks.
- **Model voice layer**: Gemini Live stack under `src/lib/gemini/live/*` with strict model policy.
- **Deterministic operations**: put DB/API calls behind typed helpers and/or Mastra Tools (Zod input/output).
- **Async work**: follow the existing `202 + job` patterns (Trigger.dev) for anything that can exceed ~5 seconds.

### LiveKit docs links (for future implementation)

- Logic & structure overview: `https://docs.livekit.io/agents/logic.md`
- Agent sessions: `https://docs.livekit.io/agents/logic/sessions.md`
- Tasks & task groups: `https://docs.livekit.io/agents/logic/tasks.md`
- Workflows: `https://docs.livekit.io/agents/logic/workflows.md`
- Tools: `https://docs.livekit.io/agents/logic/tools.md`
- Pipeline nodes: `https://docs.livekit.io/agents/logic/nodes.md`
- Turns/interruptions: `https://docs.livekit.io/agents/logic/turns.md`
- External data & RAG: `https://docs.livekit.io/agents/logic/external-data.md`

