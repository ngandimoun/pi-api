import { describe, expect, it, vi } from 'vitest';

import { createRequester } from '../request.js';
import { PiApiError } from '../errors.js';

describe('requester', () => {
  it('adds Authorization and BYOK headers', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const { request } = createRequester({
      apiKey: 'pi_test',
      baseUrl: 'https://example.com',
      providerKeys: {
        gemini: 'gemini_key',
        firecrawl: 'firecrawl_key',
        livekit: { apiKey: 'lk_key', apiSecret: 'lk_secret' },
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await request('/api/v1/jobs/job_123');

    const [, init] = fetchImpl.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer pi_test');
    expect(headers['X-Gemini-Api-Key']).toBe('gemini_key');
    expect(headers['X-Firecrawl-Api-Key']).toBe('firecrawl_key');
    expect(headers['X-LiveKit-Api-Key']).toBe('lk_key');
    expect(headers['X-LiveKit-Api-Secret']).toBe('lk_secret');
  });

  it('throws PiApiError on Pi error envelope', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            type: 'invalid_request_error',
            code: 'bad',
            message: 'nope',
            request_id: 'req_1',
          },
        }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );
    });

    const { request } = createRequester({
      apiKey: 'pi_test',
      baseUrl: 'https://example.com',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(request('/api/v1/brands')).rejects.toBeInstanceOf(PiApiError);
  });
});
