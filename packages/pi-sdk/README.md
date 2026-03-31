# `@pi-api/sdk`

The agentic intelligence layer for the physical world — voice, vision, robotics, health, and neuro APIs in a single TypeScript SDK.

## Install

```bash
npm install @pi-api/sdk
```

## Usage (BYOK: bring your own keys)

```ts
import { createPiClient } from '@pi-api/sdk';

const pi = createPiClient({
  apiKey: process.env.PI_API_KEY!,
  baseUrl: 'https://api.example.com',
  providerKeys: {
    gemini: process.env.GEMINI_API_KEY,
    firecrawl: process.env.FIRECRAWL_API_KEY,
    livekit: process.env.LIVEKIT_API_KEY
      ? { apiKey: process.env.LIVEKIT_API_KEY, apiSecret: process.env.LIVEKIT_API_SECRET! }
      : undefined,
  },
});

// Async jobs
const job = await pi.brands.extract({ url: 'https://example.com' });
const completed = await pi.jobs.waitForCompletion((job as any).data.job_id);

// SSE (surveillance incidents)
for await (const msg of pi.surveillance.events({ stream_id: 'cam-1' })) {
  const event = msg.event ?? 'message';
  const data = JSON.parse(msg.data);
  console.log(event, data);
}
```

## Notes

- Authentication uses `Authorization: Bearer <pi_api_key>`.
- BYOK provider keys are forwarded as headers:
  - `X-Gemini-Api-Key`
  - `X-Firecrawl-Api-Key`
  - `X-LiveKit-Api-Key`
  - `X-LiveKit-Api-Secret`
